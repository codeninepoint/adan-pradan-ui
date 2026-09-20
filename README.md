# adan-pradan-ui

Next.js UI for Adan Pradan.

## Docker

```bash
# build UI image (context is ./app)
docker build -t adan-pradan-ui:latest -f app/Dockerfile app

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
