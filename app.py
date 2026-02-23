from flask import Flask, jsonify, redirect, render_template, request, session, url_for
import os
import re
import sqlite3
import uuid
import json
import time
from threading import Lock
from datetime import datetime, timezone
from werkzeug.security import check_password_hash, generate_password_hash

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except Exception:  # pragma: no cover - optional dependency at runtime
    firebase_admin = None
    credentials = None
    firestore = None

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me-to-a-secure-key")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "arronex@admin")
FIREBASE_ADMIN_COLLECTION = os.environ.get("FIREBASE_ADMIN_COLLECTION", "admin_users")
ADMIN_LOGIN_WINDOW_SECONDS = int(os.environ.get("ADMIN_LOGIN_WINDOW_SECONDS", "300"))
ADMIN_LOGIN_MAX_ATTEMPTS = int(os.environ.get("ADMIN_LOGIN_MAX_ATTEMPTS", "5"))
ADMIN_LOCKOUT_SECONDS = int(os.environ.get("ADMIN_LOCKOUT_SECONDS", "600"))
ADMIN_API_WINDOW_SECONDS = int(os.environ.get("ADMIN_API_WINDOW_SECONDS", "60"))
ADMIN_API_MAX_REQUESTS = int(os.environ.get("ADMIN_API_MAX_REQUESTS", "90"))

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "app.db")
_firebase_db = None
_admin_login_attempts = {}
_admin_api_counters = {}
_security_lock = Lock()

SERVICES = {
    "business": {
        "name": "Business Website Development",
        "price": "from $499",
    },
    "ecommerce": {
        "name": "E-commerce Website Development",
        "price": "from $899",
    },
    "chatbot": {
        "name": "AI Chatbot Integration",
        "price": "from $599",
    },
    "automation": {
        "name": "Business Automation Systems",
        "price": "custom quote",
    },
    "uiux": {
        "name": "UI/UX Design",
        "price": "custom quote",
    },
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                name TEXT,
                email TEXT NOT NULL,
                phone TEXT,
                service TEXT,
                requirement TEXT,
                source TEXT,
                chat_session_id TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                chat_session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                selected_service TEXT
            )
            """
        )
        conn.commit()


def db_query(sql: str, params=(), one: bool = False):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(sql, params)
        rows = cur.fetchall()
    if one:
        return dict(rows[0]) if rows else None
    return [dict(r) for r in rows]


def db_execute(sql: str, params=()) -> int:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid


def reset_session(force: bool = False):
    if force or "state" not in session:
        session["state"] = "await_service"
        session["selected_service"] = None
        session["lead"] = {}
        session["chat_session_id"] = str(uuid.uuid4())


def is_positive_intent(msg: str) -> bool:
    text = msg.lower()
    keywords = [
        "interested",
        "hire",
        "start",
        "quote",
        "pricing",
        "price",
        "cost",
        "consultation",
        "consult",
    ]
    return any(k in text for k in keywords)


def match_service(msg: str):
    text = msg.lower()
    if "ecom" in text or "shop" in text or "store" in text:
        return "ecommerce"
    if "chatbot" in text or "bot" in text or "assistant" in text:
        return "chatbot"
    if "automation" in text or "automate" in text or "workflow" in text:
        return "automation"
    if "ui" in text or "ux" in text or "design" in text:
        return "uiux"
    if "site" in text or "website" in text or "business" in text:
        return "business"
    return None


def valid_email(email: str) -> bool:
    return bool(re.match(r"[^@\s]+@[^@\s]+\.[^@\s]+", email or ""))


def valid_phone(phone: str) -> bool:
    return bool(re.match(r"^[+0-9\-\s]{6,20}$", phone or ""))


def log_chat(role: str, message: str):
    chat_session_id = session.get("chat_session_id") or str(uuid.uuid4())
    session["chat_session_id"] = chat_session_id
    db_execute(
        """
        INSERT INTO chat_events (created_at, chat_session_id, role, message, selected_service)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            utc_now_iso(),
            chat_session_id,
            role,
            message,
            SERVICES.get(session.get("selected_service"), {}).get("name"),
        ),
    )


def render_page(template_name: str, active_page: str, **kwargs):
    reset_session(force=False)
    kwargs.setdefault("csrf_token", ensure_csrf_token())
    return render_template(template_name, active_page=active_page, **kwargs)


def get_client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def ensure_csrf_token() -> str:
    token = session.get("csrf_token")
    if not token:
        token = str(uuid.uuid4())
        session["csrf_token"] = token
    return token


def valid_csrf_token(token: str) -> bool:
    expected = session.get("csrf_token")
    return bool(expected and token and token == expected)


def _prune_security_maps(now_ts: float):
    expired_login = [k for k, v in _admin_login_attempts.items() if v.get("expires_at", 0) < now_ts]
    for key in expired_login:
        _admin_login_attempts.pop(key, None)

    expired_api = [k for k, v in _admin_api_counters.items() if v.get("window_start", 0) + ADMIN_API_WINDOW_SECONDS < now_ts]
    for key in expired_api:
        _admin_api_counters.pop(key, None)


def admin_login_rate_limited(client_ip: str, username: str):
    now_ts = time.time()
    key = f"{client_ip}:{(username or '').lower()}"
    with _security_lock:
        _prune_security_maps(now_ts)
        state = _admin_login_attempts.get(key, {"attempts": [], "lock_until": 0, "expires_at": now_ts + ADMIN_LOCKOUT_SECONDS})
        if state["lock_until"] > now_ts:
            return True, int(max(1, state["lock_until"] - now_ts))
        state["attempts"] = [t for t in state["attempts"] if now_ts - t <= ADMIN_LOGIN_WINDOW_SECONDS]
        _admin_login_attempts[key] = state
        return False, 0


def record_admin_login_failure(client_ip: str, username: str):
    now_ts = time.time()
    key = f"{client_ip}:{(username or '').lower()}"
    with _security_lock:
        state = _admin_login_attempts.get(key, {"attempts": [], "lock_until": 0, "expires_at": now_ts + ADMIN_LOCKOUT_SECONDS})
        state["attempts"] = [t for t in state["attempts"] if now_ts - t <= ADMIN_LOGIN_WINDOW_SECONDS]
        state["attempts"].append(now_ts)
        if len(state["attempts"]) >= ADMIN_LOGIN_MAX_ATTEMPTS:
            state["lock_until"] = now_ts + ADMIN_LOCKOUT_SECONDS
            state["attempts"] = []
        state["expires_at"] = now_ts + ADMIN_LOCKOUT_SECONDS
        _admin_login_attempts[key] = state


def clear_admin_login_failures(client_ip: str, username: str):
    key = f"{client_ip}:{(username or '').lower()}"
    with _security_lock:
        _admin_login_attempts.pop(key, None)


def admin_api_rate_limited(client_ip: str, endpoint_name: str):
    now_ts = time.time()
    key = f"{client_ip}:{endpoint_name}"
    with _security_lock:
        _prune_security_maps(now_ts)
        state = _admin_api_counters.get(key, {"count": 0, "window_start": now_ts})
        if now_ts - state["window_start"] > ADMIN_API_WINDOW_SECONDS:
            state = {"count": 0, "window_start": now_ts}
        state["count"] += 1
        _admin_api_counters[key] = state
        if state["count"] > ADMIN_API_MAX_REQUESTS:
            retry = int(max(1, ADMIN_API_WINDOW_SECONDS - (now_ts - state["window_start"])))
            return True, retry
        return False, 0


def init_firebase_db():
    global _firebase_db
    if _firebase_db is not None:
        return _firebase_db
    if firebase_admin is None or firestore is None:
        return None
    try:
        if not firebase_admin._apps:
            service_account = os.environ.get("FIREBASE_SERVICE_ACCOUNT") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
            if service_account_json:
                cred = credentials.Certificate(json.loads(service_account_json))
                firebase_admin.initialize_app(cred)
            elif service_account and os.path.exists(service_account):
                cred = credentials.Certificate(service_account)
                firebase_admin.initialize_app(cred)
            else:
                # Uses ADC (Application Default Credentials) when available.
                firebase_admin.initialize_app()
        _firebase_db = firestore.client()
        return _firebase_db
    except Exception:
        return None


def get_firebase_admin_user(username: str):
    db = init_firebase_db()
    if not db or not username:
        return None
    try:
        doc = db.collection(FIREBASE_ADMIN_COLLECTION).document(username).get()
        if not doc.exists:
            return None
        payload = doc.to_dict() or {}
        payload["username"] = username
        return payload
    except Exception:
        return None


def ensure_default_admin_in_firebase():
    db = init_firebase_db()
    if not db:
        return
    try:
        ref = db.collection(FIREBASE_ADMIN_COLLECTION).document(ADMIN_USERNAME)
        if not ref.get().exists:
            ref.set(
                {
                    "username": ADMIN_USERNAME,
                    "password_hash": generate_password_hash(ADMIN_PASSWORD),
                    "source": "bootstrap_env",
                    "active": True,
                    "created_at": utc_now_iso(),
                }
            )
    except Exception:
        # If bootstrap fails, app still works with env fallback.
        pass


def verify_admin_credentials(username: str, password: str) -> bool:
    firebase_user = get_firebase_admin_user(username)
    if firebase_user:
        if firebase_user.get("active") is False:
            return False
        stored_hash = firebase_user.get("password_hash")
        stored_password = firebase_user.get("password")
        if stored_hash and check_password_hash(stored_hash, password):
            return True
        if stored_password and stored_password == password:
            return True
        return False
    # Fallback for local development when Firebase is not configured.
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD


def is_admin_authenticated() -> bool:
    return bool(session.get("admin_authenticated"))


@app.route("/", methods=["GET"])
def index():
    return render_page("index.html", "home")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        message = request.form.get("message", "").strip()
        if email and valid_email(email):
            db_execute(
                """
                INSERT INTO leads (created_at, name, email, phone, service, requirement, source, chat_session_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    utc_now_iso(),
                    request.form.get("name", "Website Inquiry"),
                    email,
                    "",
                    "Consultation Request",
                    message,
                    "login_form",
                    session.get("chat_session_id"),
                ),
            )
        return render_page("login.html", "login", success=True, email=email)
    return render_page("login.html", "login", success=False)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json or {}
    msg = (data.get("message") or "").strip()

    reset_session(force=False)
    state = session["state"]

    if msg:
        log_chat("user", msg)

    if msg == "__start__":
        session["state"] = "await_service"
        reply = (
            "Hello. I am your ArroneX assistant. "
            "Which service are you looking for today: Business Website, E-commerce, AI Chatbot, Automation, or UI/UX? "
            "Typical delivery is 1-3 weeks and we offer a free consultation."
        )
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    if state == "await_service":
        service_key = match_service(msg)
        if service_key:
            session["selected_service"] = service_key
            session["state"] = "decide_next"
            info = SERVICES[service_key]
            reply = (
                f"Great choice. {info['name']} is {info['price']}. "
                "Would you like a free consultation or a detailed quote?"
            )
        else:
            reply = (
                "Please choose one service: Business Website, E-commerce, "
                "AI Chatbot, Automation, or UI/UX."
            )
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    if state == "decide_next":
        if is_positive_intent(msg):
            session["state"] = "collect_name"
            reply = "Perfect. What is your full name?"
        else:
            service_key = session.get("selected_service")
            info = SERVICES.get(service_key, {})
            reply = (
                f"{info.get('name', 'This service')} can usually ship in 1-3 weeks. "
                "Say 'quote' or 'consultation' and I will collect your details."
            )
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    if state == "collect_name":
        session["lead"]["name"] = msg
        session["state"] = "collect_email"
        reply = "Thanks. What is your best email address?"
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    if state == "collect_email":
        if not valid_email(msg):
            reply = "That email format looks invalid. Please enter a valid email address."
            log_chat("assistant", reply)
            return jsonify({"reply": reply})
        session["lead"]["email"] = msg
        session["state"] = "collect_phone"
        reply = "Got it. What phone number should we contact?"
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    if state == "collect_phone":
        if not valid_phone(msg):
            reply = "Please share a valid phone number (digits, spaces, +, -)."
            log_chat("assistant", reply)
            return jsonify({"reply": reply})
        session["lead"]["phone"] = msg
        session["state"] = "collect_requirement"
        reply = "Please share a short summary of your project goals."
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    if state == "collect_requirement":
        session["lead"]["requirement"] = msg
        session["state"] = "confirm"
        lead = session["lead"]
        service_name = SERVICES.get(session.get("selected_service"), {}).get("name", "N/A")
        reply = (
            "Please confirm this info: "
            f"Name: {lead.get('name')}, "
            f"Email: {lead.get('email')}, "
            f"Phone: {lead.get('phone')}, "
            f"Service: {service_name}, "
            f"Requirement: {lead.get('requirement')}. "
            "Reply 'yes' to confirm or 'no' to edit."
        )
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    if state == "confirm":
        if msg.lower() in ("yes", "y", "confirm"):
            session["state"] = "done"
            lead = session.get("lead", {})
            payload = {
                "name": lead.get("name"),
                "email": lead.get("email"),
                "phone": lead.get("phone"),
                "requirement": lead.get("requirement"),
                "service": SERVICES.get(session.get("selected_service"), {}).get("name"),
                "timestamp": utc_now_iso(),
                "source": "chatbot",
                "chat_session_id": session.get("chat_session_id"),
            }
            reply = "Thanks. Your request is confirmed. Our team will contact you within 24 hours."
            log_chat("assistant", reply)
            return jsonify({"reply": reply, "lead": payload})
        session["state"] = "collect_requirement"
        reply = "No problem. Please re-enter your project requirement."
        log_chat("assistant", reply)
        return jsonify({"reply": reply})

    reply = "I can help with web, e-commerce, chatbot, automation, and UI/UX. Which service do you need?"
    log_chat("assistant", reply)
    return jsonify({"reply": reply})


@app.route("/save_lead", methods=["POST"])
def save_lead():
    data = request.json or {}
    email = (data.get("email") or "").strip()
    if not valid_email(email):
        return jsonify({"ok": False, "error": "valid email is required"}), 400

    lead_id = db_execute(
        """
        INSERT INTO leads (created_at, name, email, phone, service, requirement, source, chat_session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data.get("timestamp") or utc_now_iso(),
            data.get("name", ""),
            email,
            data.get("phone", ""),
            data.get("service", ""),
            data.get("requirement", ""),
            data.get("source", "chatbot"),
            data.get("chat_session_id") or session.get("chat_session_id"),
        ),
    )
    return jsonify({"ok": True, "id": lead_id})


@app.route("/leads", methods=["GET"])
def leads():
    if not is_admin_authenticated():
        return jsonify({"error": "unauthorized"}), 401
    limited, retry = admin_api_rate_limited(get_client_ip(), "leads")
    if limited:
        return jsonify({"error": "rate_limited", "retry_after_seconds": retry}), 429
    rows = db_query(
        """
        SELECT id, created_at AS timestamp, name, email, phone, service, requirement, source, chat_session_id
        FROM leads
        ORDER BY created_at DESC, id DESC
        """
    )
    return jsonify(rows)


@app.route("/metrics", methods=["GET"])
def metrics():
    if not is_admin_authenticated():
        return jsonify({"error": "unauthorized"}), 401
    limited, retry = admin_api_rate_limited(get_client_ip(), "metrics")
    if limited:
        return jsonify({"error": "rate_limited", "retry_after_seconds": retry}), 429
    lead_total = db_query("SELECT COUNT(*) AS total FROM leads", one=True)["total"]
    chat_total = db_query("SELECT COUNT(*) AS total FROM chat_events", one=True)["total"]
    chat_sessions = db_query(
        "SELECT COUNT(DISTINCT chat_session_id) AS total FROM chat_events",
        one=True,
    )["total"]
    latest_lead = db_query(
        "SELECT created_at FROM leads ORDER BY created_at DESC, id DESC LIMIT 1",
        one=True,
    )
    source_rows = db_query(
        """
        SELECT COALESCE(source, 'unknown') AS source, COUNT(*) AS total
        FROM leads
        GROUP BY COALESCE(source, 'unknown')
        ORDER BY total DESC
        """
    )
    return jsonify(
        {
            "lead_total": lead_total,
            "chat_event_total": chat_total,
            "chat_sessions": chat_sessions,
            "latest_lead_at": latest_lead["created_at"] if latest_lead else None,
            "lead_sources": source_rows,
        }
    )


@app.route("/admin")
def admin():
    if not is_admin_authenticated():
        return redirect(url_for("admin_login", next="/admin"))
    return render_page("admin.html", "admin", enable_chat=False)


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if is_admin_authenticated():
        return redirect(url_for("admin"))

    error = None
    next_path = request.values.get("next", "/admin")
    if request.method == "POST":
        token = request.form.get("csrf_token", "")
        if not valid_csrf_token(token):
            return "Invalid CSRF token", 400
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        client_ip = get_client_ip()
        blocked, retry_after = admin_login_rate_limited(client_ip, username)
        if blocked:
            error = f"Too many login attempts. Try again in {retry_after} seconds."
        elif verify_admin_credentials(username, password):
            session["admin_authenticated"] = True
            clear_admin_login_failures(client_ip, username)
            if not next_path.startswith("/"):
                next_path = "/admin"
            return redirect(next_path)
        else:
            record_admin_login_failure(client_ip, username)
            error = "Invalid admin username or password."

    return render_page(
        "admin_login.html",
        "admin",
        enable_chat=False,
        error=error,
        next_path=next_path,
    )


@app.route("/admin/logout", methods=["POST"])
def admin_logout():
    token = request.form.get("csrf_token", "")
    if not valid_csrf_token(token):
        return "Invalid CSRF token", 400
    session.pop("admin_authenticated", None)
    return redirect(url_for("admin_login"))


@app.route("/about")
def about():
    return render_page("about.html", "about")


@app.route("/contacts")
def contacts():
    return render_page("contacts.html", "contacts")


@app.route("/info")
def info():
    return render_page("info.html", "info")


@app.route("/chatbot")
def chatbot_page():
    reset_session(force=True)
    return render_page("index.html", "chatbot")


init_db()
ensure_default_admin_in_firebase()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
