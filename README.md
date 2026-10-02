# adan-pradan-ui

Next.js UI for [Adan Pradan](https://github.com/codeninepoint/adaan-pradaan-core).

## Backend integration

The UI calls the core API at `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:8000`).

Auth / session flows wired today:

| UI route | API |
|----------|-----|
| `/signup` | `POST /auth/register` |
| `/signup/verify` | `POST /auth/verify-email` |
| `/login` | `POST /auth/token` then `GET /auth/me` |
| `/forgot-password` | `POST /auth/password/reset-request` |
| `/reset-password` | `POST /auth/password/reset` |
| `/app` | Session shell + AuthZ resource list/create (`GET`/`POST /api/v1/tenants/{tenant_id}/resources`) |
| `/app/members` | Members & roles (J10–J11 grant/revoke) |
| Sign out (header) | `DELETE /auth/session` |

Tokens live in `sessionStorage`. Access tokens auto-refresh via `POST /auth/token/refresh` before expiry / on 401. Authenticated users are redirected from `/login` and `/signup` to `/app`.

In **dev**, register returns `dev_otp` and reset-request returns `dev_reset_token` so email is not required.

### Local full stack

```bash
# terminal 1 — API + Postgres
cd ../adaan-pradaan-core
docker compose up --build

# terminal 2 — UI (dev)
cd ../adan-pradan-ui/app
cp .env.example .env.local   # if needed
pnpm install
pnpm dev
```

- UI: http://127.0.0.1:3000  
- API docs: http://127.0.0.1:8000/docs  

Core must allow the UI origin via `TENANT_CORS_ORIGINS` (default includes `http://localhost:3000`).

## Docker

```bash
# build UI image (context is ./app)
docker build -t adan-pradan-ui:latest \
  --build-arg NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 \
  -f app/Dockerfile app

# or
docker compose up --build
```

UI: http://127.0.0.1:3000

## CI/CD (GitHub Actions → Docker Hub)

On every push to `main`, GitHub Actions builds and pushes:

- `<DOCKERHUB_USERNAME>/adan-pradan-ui:latest`
- `<DOCKERHUB_USERNAME>/adan-pradan-ui:sha-<commit>`

Pull requests only **build** (no push).

### One-time setup

1. Docker Hub Access Token: https://hub.docker.com/settings/security
2. GitHub **Settings → Secrets and variables → Actions**:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`
3. Optional: create Docker Hub repo `adan-pradan-ui`.

```bash
docker pull <DOCKERHUB_USERNAME>/adan-pradan-ui:latest
```
