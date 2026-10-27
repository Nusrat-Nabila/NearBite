# NearBite

NearBite is a restaurant discovery website. Customers can search for restaurants and dishes near them, read and write reviews, save favourites and see daily deals. Restaurant owners manage their restaurant, menu and offers. Admins review restaurant sign-ups and look after the whole platform.

The project has two parts that run separately:

| Part | Folder | Built with |
| --- | --- | --- |
| Backend (REST API) | [`backend/`](backend/) | Python, Django 6, Django REST Framework, JWT login, SQLite |
| Frontend (website) | [`frontend/`](frontend/) | React 19, Vite 8 |

The frontend calls the backend through a proxy (`/api/...` and `/media/...` go to `http://127.0.0.1:8000`), so there are no CORS settings to change. **Start the backend first, then the frontend.**

## Features

**Customer**
- Sign up and log in, edit profile, reset a forgotten password by email
- Search restaurants and dishes, filter by cuisine, category, price and distance ("near me")
- Rate and review restaurants and dishes, save favourite restaurants, report a restaurant
- See daily deals

**Restaurant owner**
- Sign up with the business details and four PDF documents: TIN certificate, VAT certificate, trade licence and restaurant licence
- After the admin approves the request: manage profile, opening hours, menu, offers and temporary closing
- See their own documents on **My Profile** (and upload any that are still missing)

**Admin**
- Review restaurant requests and open the four PDFs, then approve or reject with a reason (the restaurant is emailed)
- Suspend or reactivate a customer or restaurant account, or delete it. The reason is written as an email to the user.
- Manage dietary tags, cuisines and food categories, handle reports, remove inappropriate reviews

**Accounts**
- Documents are private. Only the admin and the restaurant's own owner can open them.
- A suspended account cannot log in and a suspended restaurant is hidden from customers. Only an admin can reactivate it.
- Deleting an account (by the admin or by the user) takes 30 days. The user gets an email. If the **user** deleted their own account, logging in again within 30 days cancels the deletion. After 30 days the account is deleted automatically.

## What to install

| Tool | Version | Used for |
| --- | --- | --- |
| [Python](https://www.python.org/downloads/) | 3.12 or newer | Backend |
| [Node.js](https://nodejs.org/) (includes npm) | 20.19 or newer, or 22.12 or newer | Frontend |
| [Git](https://git-scm.com/) | any | Getting the code |

The Python and npm packages are installed with the commands below.

## Run the project

Open **two terminals**, one for the backend and one for the frontend.

### 1. Backend (terminal 1)

Commands are for Windows (PowerShell or Command Prompt).

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

On macOS or Linux, activate the environment with `source venv/bin/activate`.

The API runs at **http://127.0.0.1:8000**.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in the browser.

## Settings (optional)

Copy `backend/.env.example` to `backend/.env` and fill it in:

| Setting | What it does |
| --- | --- |
| `SECRET_KEY` | Django secret key. Use a long random string for anything other than local testing. |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | A Gmail address and its [app password](https://support.google.com/accounts/answer/185833). Needed to send emails (password reset, request approved or rejected, account suspended or deleted). Without them the website still works, but the emails are not sent. |
| `FRONTEND_URL` | Website address used in the links inside emails (default `http://localhost:5173`) |

## Create an admin account

There is no admin sign-up page. Create the first admin from the backend folder (with the virtual environment active):

```bash
python manage.py shell
```

```python
from account.models import Admin, UserAuth
Admin.objects.create(admin_name="Admin", admin_email="admin@example.com", admin_password="choose-a-password")
UserAuth.objects.create(user_name="Admin", user_email="admin@example.com", user_password="choose-a-password", user_role="admin")
```

Then log in on the website with the **Admin** role.

## Run the tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

Build the frontend for production with `npm run build` in the `frontend` folder.

## Project structure

```
NearBite/
├── backend/
│   ├── NearBite/      Django settings and URL list
│   ├── account/       Sign-up, login, restaurant requests, account status and deletion
│   ├── customer/      Customer profile, search, favourites, reviews, reports
│   ├── restaurant/    Restaurant profile, menu, offers, opening hours
│   ├── adminpanel/    Admin tools: tags, reports, reviews, dashboard numbers
│   ├── pytest_tests/  Automated tests
│   └── manage.py
└── frontend/
    └── src/
        ├── pages/        Website pages (home, explore, login, dashboards, ...)
        ├── components/   Shared parts (navbar, filters, documents, ...)
        └── api.js        Talks to the backend and keeps the login session
```

## Good to know

- **Passwords are stored as plain text.** This is how the project was built; it is fine for a demo or learning project but must be changed (hashed passwords) before real use.
- `backend/db.sqlite3` is committed to Git together with sample data. Uploaded documents are saved in `backend/private_media/` and are not committed.
- Accounts waiting for deletion are removed by a background job that runs while the backend server is running (about once an hour). You can also run it by hand: `python manage.py purge_deleted_accounts`.
- `npm run lint` reports a few "setState in effect" style warnings in older frontend files. They do not stop the website from working.
