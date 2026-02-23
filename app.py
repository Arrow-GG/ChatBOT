from flask import Flask, render_template, request, session, jsonify
import re
import csv
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = "change-me-to-a-secure-key"

SERVICES = {
    "business": {
        "name": "Business Website Development",
        "price": "from ₹15,000",
    },
    "ecommerce": {
        "name": "E-commerce Website Development",
        "price": "from ₹25,000",
    },
    "chatbot": {
        "name": "AI Chatbot Integration",
        "price": "from ₹18,000",
    },
    "automation": {
        "name": "Business Automation Systems",
        "price": "contact for pricing",
    },
    "uiux": {
        "name": "UI/UX Design",
        "price": "contact for pricing",
    },
}


def reset_session():
    session["state"] = "await_service"
    session["selected_service"] = None
    session["lead"] = {}


def is_positive_intent(msg):
    msg = msg.lower()
    keywords = ["interested", "hire", "start", "quote", "pricing", "price", "cost", "consultation", "consult"]
    return any(k in msg for k in keywords)


def is_greeting(msg):
    m = (msg or "").strip().lower()
    return m in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}


def asks_pricing(msg):
    m = (msg or "").lower()
    return any(k in m for k in ["price", "pricing", "cost", "budget", "charges", "fee"])


def service_menu_text():
    return (
        "We offer: Business Website Development (from ₹15,000), "
        "E-commerce (from ₹25,000), AI Chatbot Integration (from ₹18,000), "
        "Business Automation Systems, and UI/UX Design. "
        "Which service are you interested in?"
    )


def match_service(msg):
    s = msg.lower()
    if "ecom" in s or "shop" in s or "store" in s:
        return "ecommerce"
    if "chatbot" in s or "bot" in s:
        return "chatbot"
    if "automation" in s or "automate" in s:
        return "automation"
    if "ui" in s or "ux" in s or "design" in s:
        return "uiux"
    if "site" in s or "website" in s or "business" in s:
        return "business"
    return None


def valid_email(e):
    return re.match(r"[^@\s]+@[^@\s]+\.[^@\s]+", e or "")


def valid_phone(p):
    return re.match(r"^[+0-9\-\s]{6,20}$", p or "")


@app.route("/", methods=["GET"])
def index():
    reset_session()
    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        # collect simple form data (demo only)
        email = request.form.get("email")
        message = request.form.get("message")
        # log to server console - replace with DB/CRM in production
        print(f"[LOGIN FORM] Email={email!r}, Message={message!r}")
        return render_template("login.html", success=True, email=email)
    return render_template("login.html", success=False)


@app.route("/chat", methods=["POST"])
def chat():
    data = request.json or {}
    msg = (data.get("message") or "").strip()

    if "state" not in session:
        reset_session()

    if not msg:
        return jsonify({"reply": "Please type a message so I can help you."})

    state = session["state"]

    if msg.lower() in {"restart", "reset", "start over", "new chat"}:
        reset_session()
        return jsonify({"reply": "Sure — I restarted our chat. " + service_menu_text()})

    # Start trigger
    if msg == "__start__":
        session["state"] = "await_service"
        text = (
            "Hello — I’m the AI Sales Assistant for Arrow Digital Solutions."
            " Which service are you interested in? We offer: Business Website Development (from ₹15,000),"
            " E-commerce (from ₹25,000), AI Chatbot Integration (from ₹18,000), Business Automation Systems, and UI/UX Design."
            " Typical delivery: 7–14 days. Free consultation available."
        )
        return jsonify({"reply": text})

    # Awaiting service selection
    if state == "await_service":
        if is_greeting(msg):
            return jsonify({"reply": "Hello! " + service_menu_text()})
        if asks_pricing(msg):
            return jsonify({"reply": service_menu_text()})

        svc = match_service(msg)
        if svc:
            session["selected_service"] = svc
            info = SERVICES.get(svc, {})
            session["state"] = "decide_next"
            text = f"You picked {info.get('name')}. Pricing {info.get('price')}. Would you like a free consultation or a quote?"
            return jsonify({"reply": text})
        else:
            # ask clarifying
            session["state"] = "await_service"
            return jsonify({"reply": "Which of these services are you interested in: Business website, E-commerce, AI chatbot, Automation, or UI/UX?"})

    # After service chosen
    if state == "decide_next":
        if is_positive_intent(msg) or "consult" in msg or "quote" in msg:
            session["state"] = "collect_name"
            return jsonify({"reply": "Great — may I have your full name?"})
        else:
            # provide short details and prompt next step
            svc = session.get("selected_service")
            info = SERVICES.get(svc, {})
            return jsonify({"reply": f"{info.get('name')} typically delivers in 7–14 days. Would you like a free consultation or a quote?"})

    # Lead collection flow
    if state == "collect_name":
        if len(msg) < 2:
            return jsonify({"reply": "Please share your full name (at least 2 characters)."})
        session["lead"]["name"] = msg
        session["state"] = "collect_email"
        return jsonify({"reply": "Thanks. Please provide your email address."})

    if state == "collect_email":
        if not valid_email(msg):
            return jsonify({"reply": "That doesn't look like a valid email. Please enter a valid email address."})
        session["lead"]["email"] = msg
        session["state"] = "collect_phone"
        return jsonify({"reply": "Got it. What phone number can we reach you on?"})

    if state == "collect_phone":
        if not valid_phone(msg):
            return jsonify({"reply": "Please provide a valid phone number (digits, +, - allowed)."})
        session["lead"]["phone"] = msg
        session["state"] = "collect_requirement"
        return jsonify({"reply": "Thanks. Briefly describe your project or requirement."})

    if state == "collect_requirement":
        session["lead"]["requirement"] = msg
        session["state"] = "confirm"
        lead = session["lead"]
        svc = session.get("selected_service")
        svc_name = SERVICES.get(svc, {}).get("name") if svc else None
        summary = f"Please confirm: Name: {lead.get('name')}, Email: {lead.get('email')}, Phone: {lead.get('phone')}, Service: {svc_name or 'N/A'}, Requirement: {lead.get('requirement')} — Reply 'yes' to confirm." 
        return jsonify({"reply": summary})

    if state == "confirm":
        if msg.lower() in ("yes", "y", "confirm"):
            # In a real app we'd persist the lead or notify CRM — here we simply acknowledge
            session["state"] = "done"
            # Prepare lead payload to return to client so frontend can persist (Firebase or server)
            lead = session.get("lead", {})
            svc = session.get("selected_service")
            svc_name = SERVICES.get(svc, {}).get("name") if svc else None
            payload = {
                "name": lead.get('name'),
                "email": lead.get('email'),
                "phone": lead.get('phone'),
                "requirement": lead.get('requirement'),
                "service": svc_name,
                "timestamp": datetime.utcnow().isoformat() + 'Z'
            }
            return jsonify({
                "reply": "Thank you. Our team will contact you within 24 hours for a free consultation.",
                "lead": payload
            })
        if msg.lower() in ("no", "n", "edit", "change"):
            session["state"] = "collect_requirement"
            return jsonify({"reply": "No problem — please share the updated project requirement."})
        else:
            session["state"] = "collect_requirement"
            return jsonify({"reply": "Okay — please re-enter a brief project requirement."})

    # Fallback
    return jsonify({"reply": "I’m here to help. Which service are you interested in: Business website, E-commerce, AI chatbot, Automation, or UI/UX?"})


@app.route('/save_lead', methods=['POST'])
def save_lead():
    data = request.json or {}
    if not data.get('email'):
        return jsonify({'ok': False, 'error': 'missing email'}), 400
    # ensure data directory
    out_file = os.path.join(os.path.dirname(__file__), 'leads.csv')
    write_header = not os.path.exists(out_file)
    with open(out_file, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(['timestamp', 'name', 'email', 'phone', 'service', 'requirement'])
        writer.writerow([data.get('timestamp') or datetime.utcnow().isoformat() + 'Z', data.get('name',''), data.get('email',''), data.get('phone',''), data.get('service',''), data.get('requirement','')])
    return jsonify({'ok': True})


@app.route('/leads', methods=['GET'])
def leads():
    out_file = os.path.join(os.path.dirname(__file__), 'leads.csv')
    if not os.path.exists(out_file):
        return jsonify([])
    rows = []
    with open(out_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return jsonify(rows)


@app.route('/admin')
def admin():
    # admin dashboard uses client-side Firebase if configured, otherwise reads local leads via /leads
    return render_template('admin.html')


@app.route('/about')
def about():
    return render_template('about.html')


@app.route('/contacts')
def contacts():
    return render_template('contacts.html')


@app.route('/info')
def info():
    return render_template('info.html')


@app.route('/chatbot')
def chatbot_page():
    # reuse index template; JS will auto-open the chat modal based on path
    reset_session()
    return render_template('index.html')


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
