# MCP Push Notification Settings Synchronization

A centralized module for MCP end users to manage and synchronize push notification settings across multiple devices, ensuring consistent preferences, prevention of duplicate alerts, and secure handling of settings updates.

---

## Features

- **Centralized management** of push notification settings per user account
- **Synchronization** of settings changes across all linked devices
- **Deduplication**: Prevents duplicate push notifications for users with multiple devices
- **Per-device enable/disable** for notifications
- **Secure transmission and storage** (encryption in transit and at rest)
- **Robust session management** and JWT-based authentication
- **Audit logging** of all settings changes
- **Scalable** architecture for large user/device counts

---

## Tech Stack

- **Backend:** Node.js (Express), TypeScript, TypeORM, PostgreSQL, Redis, JWT, OpenSSL
- **Frontend:** React, TypeScript
- **Testing:** Jest, Supertest
- **Documentation:** Swagger (OpenAPI), README
- **Code Quality:** ESLint, Prettier

---

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL (v13+)
- Redis (v6+)
- Yarn or npm

### Environment Variables

Create a `.env` file in the `backend/` directory with the following:

```
PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/mcp_notifications
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=32_byte_hex_or_ascii_key
CORS_ORIGIN=http://localhost:3000
AUDIT_LOG_PATH=./logs/audit.log
```

**Note:** `ENCRYPTION_KEY` must be exactly 32 bytes for AES-256-GCM.

---

### Backend Setup

1. **Install dependencies:**

   ```bash
   cd backend
   yarn install
   # or
   npm install
   ```

2. **Run database migrations:**

   ```bash
   yarn typeorm migration:run
   # or
   npm run typeorm migration:run
   ```

3. **Start the backend server:**

   ```bash
   yarn start
   # or
   npm start
   ```

4. **API Documentation:**

   Visit [http://localhost:4000/api-docs](http://localhost:4000/api-docs) for Swagger UI.

---

### Frontend Setup

1. **Install dependencies:**

   ```bash
   cd frontend
   yarn install
   # or
   npm install
   ```

2. **Configure API base URL:**

   Create a `.env` file in `frontend/`:

   ```
   REACT_APP_API_BASE_URL=http://localhost:4000/api/notification-settings
   ```

3. **Start the frontend app:**

   ```bash
   yarn start
   # or
   npm start
   ```

4. **Access the UI:**

   Open [http://localhost:3000/settings](http://localhost:3000/settings) in your browser.

---

## Testing

### Backend

Run automated tests (Jest):

```bash
cd backend
yarn test
# or
npm test
```

### Frontend

Run React tests:

```bash
cd frontend
yarn test
# or
npm test
```

---

## Security Notes

- All sensitive data is encrypted in transit (TLS) and at rest (AES-256-GCM).
- JWT-based authentication is enforced for all API endpoints.
- Audit logs are maintained for all settings changes.
- Session and authorization checks are robust and tested.

---

## API Reference

- See [backend/docs/swagger.yaml](backend/docs/swagger.yaml) or `/api-docs` endpoint for full OpenAPI specification.

---

## Project Structure

```
backend/
  src/
    controllers/
    middleware/
    models/
    services/
    utils/
  tests/
  docs/
frontend/
  src/
    api/
    pages/
    App.tsx
README.md
```

---

## License

MIT License

---

## Maintainers

- MCP Engineering Team

---