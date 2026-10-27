# NearBite Backend

The Django REST API for NearBite.

## Install first

- [Python](https://www.python.org/downloads/) 3.12 or newer

The Python packages (Django, Django REST Framework, SimpleJWT, django-cors-headers, Pillow, python-dotenv) are installed with the commands below.

## Run the backend

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

On macOS or Linux, use `source venv/bin/activate` instead of `venv\Scripts\activate`.

The API runs at http://127.0.0.1:8000. Start the [frontend](../frontend/README.md) after this.

## Optional

- Emails need a Gmail app password: copy `.env.example` to `.env` and fill in `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD`. Without them everything else still works.
- Run the tests: `pip install -r requirements-dev.txt`, then `python -m pytest`.
