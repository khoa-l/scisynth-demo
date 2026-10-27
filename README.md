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

The API runs at <http://127.0.0.1:8000> (health check: `/api/health`). Data is kept in
`backend/scisynth.db`, created on first start; set `SCISYNTH_DB` to use another file.

## Frontend

```sh
cd frontend
pnpm install
pnpm dev
```

The app runs at <http://localhost:3000> and proxies `/api` to the backend on port 8000, so start the
backend first.

Other scripts: `pnpm build`, `pnpm preview`, `pnpm lint`, `pnpm typecheck`.
