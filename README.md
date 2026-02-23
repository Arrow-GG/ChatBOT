# Arrow Digital Solutions — AI Sales Assistant (Demo)

This is a minimal demo of the AI Sales Assistant for Arrow Digital Solutions.

Features:
- Rule-based chat flow for service selection and lead qualification
- Collects Full Name, Email, Phone, and Brief Project Requirement
- Confirms submission and replies: "Thank you. Our team will contact you within 24 hours for a free consultation."

Quick start:

1. Create and activate a Python virtual environment (recommended)

```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install requirements

```bash
pip install -r requirements.txt
```

3. Run the app

```bash
python app.py
```

4. Open http://localhost:5000 in a browser and interact with the assistant.

Notes:
- This demo is rule-based and keeps lead data in the session (in-memory). Integrate with a CRM or database for production.
- Change `app.secret_key` to a secure value before deploying.

VS Code

- Open this folder in VS Code.
- Install the Python extension (if not installed).
- Create a virtual environment and install requirements as above.
- Use the Run view and select the `Run app.py` configuration, or press F5 to launch the app in the integrated terminal.

Troubleshooting

- If port 5000 is in use, stop the other process or change the port in `app.py`.
- For production, wire the lead capture to a database or CRM and secure the secret key.

Firebase integration

- To enable the admin dashboard to read/write leads from Firestore (client-side), create a Firebase project and a Firestore database.
- Create the file `static/firebase-config.js` and set `window.firebaseConfig` to your project's web config (see placeholder in the file).
- Ensure Firestore rules allow reads/writes from your admin environment or use proper authentication for production.

Server-side fallback

- The app stores incoming leads to `leads.csv` in the project folder by default when a lead is submitted. The admin dashboard will show this CSV when Firebase is not configured.
