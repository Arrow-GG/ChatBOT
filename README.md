# ArroneX Web App

Production-ready Flask app with:
- Marketing pages + animated UI
- AI sales chatbot
- Lead capture and admin dashboard
- Admin authentication (with Firebase support)

## Local Run

1. Create and activate virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run:

```bash
python app.py
```

4. Open:

`http://127.0.0.1:5000`

## Admin Login

Default local fallback credentials:
- Username: `admin`
- Password: `arronex@admin`

Set env vars to override:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Deploy (Render)

This repo includes `render.yaml` for one-click deploy.

### Steps

1. Push this project to GitHub.
2. In Render: **New +** -> **Blueprint**.
3. Select your repo.
4. Set required secret env vars in Render:
   - `ADMIN_PASSWORD`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (optional, for Firebase-backed admin users)
5. Deploy.

Render uses:
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app --workers 2 --threads 4 --timeout 120`

## Deploy (Other Hosts)

A `Procfile` is included:

```txt
web: gunicorn app:app --workers 2 --threads 4 --timeout 120
```

Use this on Railway/Heroku-style platforms.

## Environment Variables

### Required for production
- `FLASK_SECRET_KEY` (strong random string)
- `ADMIN_PASSWORD`

### Optional
- `ADMIN_USERNAME` (default `admin`)
- `FIREBASE_ADMIN_COLLECTION` (default `admin_users`)
- `FIREBASE_SERVICE_ACCOUNT_JSON` (raw JSON of Firebase service account)
- `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` (path-based credential alternative)

## Firebase Admin Accounts

If Firebase credentials are configured, admin login checks Firestore first:

- Collection: `admin_users`
- Document ID: username (example: `admin`)
- Fields:
  - `username`
  - `password_hash` (recommended, Werkzeug hash)
  - `active` (`true`/`false`)

If Firebase is unavailable, local env fallback (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) still works.

## Security Implemented for Admin

- Admin route protection (`/admin` requires login)
- Rate limiting on admin APIs (`/metrics`, `/leads`)
- Brute-force throttling + lockout on `/admin/login`
- CSRF token protection on admin login/logout forms

## Notes

- SQLite is used for local lead storage.
- For long-term production data persistence, use managed DB/Firestore.
