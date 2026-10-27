# SciSynth Demo

Design a study as a node workflow, then build tasks from it. The backend (FastAPI) runs
[scisynth](../../scisynth); the frontend (Nuxt) is the editor.

## Requirements

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node and [pnpm](https://pnpm.io/)
- scisynth checked out at `../../scisynth` (an editable path dependency)

## Backend

```sh
cd backend
uv sync
uv run uvicorn main:app --reload --port 8000
```

The API runs at http://127.0.0.1:8000 (health check: `/api/health`). Data is kept in
`backend/scisynth.db`, created on first start; set `SCISYNTH_DB` to use another file.

## Frontend

```sh
cd frontend
pnpm install
pnpm dev
```

The app runs at http://localhost:3000 and proxies `/api` to the backend on port 8000, so start the
backend first.

Other scripts: `pnpm build`, `pnpm preview`, `pnpm lint`, `pnpm typecheck`.

## Deploy (Railway)

The `Dockerfile` builds the frontend to static files and serves them from the backend, so the whole
app is one service on one port.

1. Push this repo to GitHub, then in Railway choose New Project, Deploy from GitHub repo.
2. Add a volume to the service, mounted at `/data`. The database is kept there (`SCISYNTH_DB`
   defaults to `/data/scisynth.db` in the image); without a volume, studies are lost on each deploy.
3. Under Networking, generate a public domain.

Railway sets `PORT`; the image uses it. scisynth is installed from
`github.com/khoa-l/scisynth` (`main`, pinned by `backend/uv.lock`); run `uv lock --upgrade-package
scisynth` to take newer commits. To work on scisynth next to this repo, run
`uv pip install -e ../../scisynth` in `backend` after `uv sync`.

There is no real sign-in (see the decisions), so anyone with the link can edit studies.

## Notes

Design choices are in [docs/decisions.md](docs/decisions.md).
