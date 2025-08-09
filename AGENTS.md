# Repository Guidelines

## Project Structure & Module Organization
- Root scripts: `server.js` (Express web UI), `index.js` (CLI generator), `local-generator.js` (generate and auto-open), `monitor.js`/`simple-monitor.js` (health-check + auto-restart).
- Templates live in `templates/` (base HTML in `templates/base.html`).
- Generated pages are saved to `output/` and are served at `/output` when the server runs.
- Configuration is via `.env` (see Security & Config).

## Build, Run, and Development Commands
- Install: `npm install` — install Node dependencies.
- Start server: `npm start` (alias: `npm run dev`) — launches Express on `PORT` or 3000.
- CLI generation: `npm run cli "女性、30代、健康志向"` — streams generation and writes to `output/`.
- Local generate + open: `npm run open "男性、来週彼女が誕生日"` — saves and opens the file.
- Monitor server: `npm run monitor` — keeps the server alive with health checks.
- Health check: `curl http://localhost:3000/health` — verifies the server is healthy.

## Coding Style & Naming Conventions
- ESM only (`"type": "module"`); prefer `import`/`export` and `async/await`.
- Indentation: 2 spaces; keep lines readable (~100 chars).
- Filenames: use `kebab-case.js` for new multi-word modules; keep existing names.
- Identifiers: `camelCase` for variables/functions; `UPPER_SNAKE_CASE` for constants.
- Formatting: run Prettier defaults if available; do not introduce new tools without discussion.

## Testing Guidelines
- No formal test suite yet. Smoke test flows:
  - Server: `npm start`, visit `/`, and hit `/health`.
  - Direct generate: open `http://localhost:3000/?status=女性30歳誕生日&save=true`.
- If adding tests, prefer Jest with ESM; name files `*.test.js` and colocate or use `__tests__/`.

## Commit & Pull Request Guidelines
- Commits: imperative, concise, and scoped (e.g., `server: handle dynamic port retry`).
- PRs: include purpose, steps to run, example commands, and screenshots of generated output; link related issues; note any env/config changes.
- Ensure no secrets or `.env` are committed; large or transient artifacts in `output/` should be excluded from PRs.

## Security & Config
- Required env: `GROQ_API_KEY` in `.env`; optional `PORT`.
- Never log API keys; `.env` is already ignored via `.gitignore`.
