# MCP Push Notification Settings Synchronization

A centralized FastAPI-based backend for MCP end users to manage push notification settings across multiple devices, ensuring consistent preferences, prevention of duplicate alerts, and secure handling of settings updates.

---

## Features

- **Centralized management** of push notification settings per user
- **Synchronization** of settings across all devices linked to a user account
- **Per-device enable/disable** of push notifications
- **Prevention of duplicate notifications** for users with multiple devices
- **Secure transmission and storage** (encryption in transit and at rest)
- **JWT-based authentication** and session validation
- **Audit logging** of all settings changes and security events
- **Automated tests** for synchronization, duplicate prevention, and security
- **OpenAPI/Swagger** documentation

---

## Tech Stack

- **Backend:** Python 3.11, FastAPI
- **Database:** PostgreSQL
- **ORM:** SQLAlchemy, Alembic (migrations)
- **Authentication:** JWT (python-jose, passlib)
- **Testing:** Pytest
- **Containerization:** Docker
- **Other:** SQLAlchemy-Utils (UUID, EncryptedType), Cryptography

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repo-url>
cd <repo-directory>
```

### 2. Set Environment Variables

Create a `.env` file in the project root with at least:

```
DATABASE_URL=postgresql+psycopg2://mcp_user:mcp_password@localhost:5432/mcp_db
MCP_JWT_SECRET=your_jwt_secret_key
MCP_ENCRYPTION_KEY=your_fernet_key  # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Build and Run with Docker

```bash
docker build -t mcp-push-sync .
docker run --env-file .env -p 8000:8000 mcp-push-sync
```

### 4. Run Database Migrations

If running outside Docker:

```bash
alembic upgrade head
```

---

## Development

### Install Dependencies

```bash
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Run the API

```bash
uvicorn src.main:app --reload
```

### Run Tests

```bash
pytest --cov=src
```

---

## API Documentation

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Security Notes

- All sensitive data is encrypted in transit (HTTPS) and at rest (Fernet/EncryptedType).
- JWT tokens are used for authentication and session validation.
- Audit logs are maintained for all settings changes and security events.
- **Never commit secrets or keys to version control.**

---

## Project Structure

```
src/
  main.py           # FastAPI app entry point
  models.py         # SQLAlchemy models
  schemas.py        # Pydantic schemas
  crud.py           # CRUD/business logic
  auth.py           # JWT authentication/session
  notification.py   # Push notification logic
  audit.py          # Audit logging
alembic/            # DB migrations
tests/              # Automated tests
Dockerfile          # Containerization
requirements.txt    # Python dependencies
README.md           # This file
```

---

## License

MIT License

---

## Contact

For questions or contributions, please open an issue or pull request.