# Sammy — run locally after unzip

## Requirements
- Node.js 20+
- Python 3.11+
- ffmpeg on PATH (for audition analysis)

## Frontend
```bash
npm install
npm run dev
```
App: http://127.0.0.1:5173

## Backend
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn cue_server.main:app --host 127.0.0.1 --port 8000 --app-dir .
```

Or from repo root:
```bash
npm run dev:all
```

## Demo logins
- Production: production@sammy.app / demo
- Talent: talent@sammy.app / demo

## Notes
- `node_modules`, Python venv, SQLite DB, and uploaded media were excluded from this zip.
- First API boot creates `server/data/sammy.db` and seeds demo data.
- Camera recording needs HTTPS or localhost.
