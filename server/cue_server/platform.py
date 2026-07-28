from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .script_data import DEFAULT_SCENE, script_as_plain

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
UPLOAD_DIR = ROOT / "uploads"
DB_PATH = DATA_DIR / "sammy.db"
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    with _lock:
        conn = _connect()
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              email TEXT UNIQUE NOT NULL,
              password TEXT NOT NULL,
              role TEXT NOT NULL,
              name TEXT NOT NULL,
              city TEXT,
              languages TEXT,
              bio TEXT,
              skills TEXT,
              sammy_score INTEGER DEFAULT 620,
              verified INTEGER DEFAULT 0,
              company_id TEXT,
              followers INTEGER DEFAULT 0,
              avatar_url TEXT,
              cover_url TEXT,
              cover_position TEXT,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS companies (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              city TEXT,
              genres TEXT,
              banner TEXT,
              logo TEXT,
              logo_url TEXT,
              cover_url TEXT,
              cover_position TEXT,
              about TEXT,
              website TEXT,
              verified INTEGER DEFAULT 1,
              followers INTEGER DEFAULT 0,
              showreel TEXT,
              owner_user_id TEXT,
              plan TEXT DEFAULT 'Studio'
            );
            CREATE TABLE IF NOT EXISTS threads (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              role_title TEXT NOT NULL,
              character_brief TEXT NOT NULL,
              script_text TEXT NOT NULL,
              language TEXT NOT NULL,
              city TEXT,
              genre TEXT,
              deadline TEXT NOT NULL,
              visibility_default TEXT NOT NULL,
              status TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS submissions (
              id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL,
              talent_id TEXT NOT NULL,
              visibility TEXT NOT NULL,
              status TEXT NOT NULL,
              decision TEXT DEFAULT 'pending',
              file_name TEXT,
              progress REAL DEFAULT 0,
              stage TEXT DEFAULT '',
              error TEXT,
              report_json TEXT,
              overall INTEGER,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
              id TEXT PRIMARY KEY,
              company_id TEXT NOT NULL,
              talent_id TEXT NOT NULL,
              thread_id TEXT,
              direction TEXT NOT NULL,
              body TEXT NOT NULL,
              created_at TEXT NOT NULL,
              read INTEGER DEFAULT 0
            );
            """
        )
        conn.commit()
        # Lightweight migrations for existing DBs
        def _cols(table: str) -> set[str]:
            return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}

        ccols = _cols("companies")
        ucols = _cols("users")
        alters = []
        if "logo_url" not in ccols:
            alters.append("ALTER TABLE companies ADD COLUMN logo_url TEXT")
        if "cover_url" not in ccols:
            alters.append("ALTER TABLE companies ADD COLUMN cover_url TEXT")
        if "about" not in ccols:
            alters.append("ALTER TABLE companies ADD COLUMN about TEXT")
        if "website" not in ccols:
            alters.append("ALTER TABLE companies ADD COLUMN website TEXT")
        if "avatar_url" not in ucols:
            alters.append("ALTER TABLE users ADD COLUMN avatar_url TEXT")
        if "cover_url" not in ucols:
            alters.append("ALTER TABLE users ADD COLUMN cover_url TEXT")
        if "cover_position" not in ucols:
            alters.append("ALTER TABLE users ADD COLUMN cover_position TEXT")
        if "cover_position" not in ccols:
            alters.append("ALTER TABLE companies ADD COLUMN cover_position TEXT")
        for stmt in alters:
            conn.execute(stmt)
        conn.commit()
        count = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        conn.close()
    if count == 0:
        seed()
    ensure_demo_catalog()


def ensure_demo_catalog() -> None:
    """Idempotently expand demo companies/threads so Discover feels alive on existing DBs."""
    now = datetime.now(timezone.utc)
    companies = [
        (
            "co_monsoon",
            "Monsoon Frame",
            "Bengaluru",
            "Comedy, OTT, Romance",
            "Rain-soaked urban stories",
            "MF",
            "user_meera",
            "Indie",
        ),
        (
            "co_coastal",
            "Coastal Reel",
            "Kochi",
            "Malayalam, Drama, Crime",
            "Harbour light & long pauses",
            "CR",
            "user_meera",
            "Studio",
        ),
        (
            "co_metro",
            "Metro Casting Desk",
            "Mumbai",
            "Hindi, English, Thriller",
            "City glass & night shifts",
            "MC",
            "user_meera",
            "Enterprise",
        ),
    ]
    threads = [
        (
            "th_rain_window",
            "co_monsoon",
            "Ananya — Rain Window",
            "Mid-twenties. Wants to leave the city, but keeps watching the rain instead of packing. Soft humour under real dread.",
            "I told myself I'd leave before monsoon. Now the bags are packed and I'm still standing at this window, counting buses I will not take.",
            "English",
            "Bengaluru",
            "Romance",
            2,
            "public",
        ),
        (
            "th_bus_stop",
            "co_monsoon",
            "Kiran — Last Bus",
            "Early thirties. Comic timing with a dry edge — sells a joke, then lands the loneliness under it.",
            "This stop used to mean home. Now it just means I missed another bus and somehow that feels like a personality trait.",
            "Kannada",
            "Bengaluru",
            "Comedy",
            6,
            "public",
        ),
        (
            "th_harbour",
            "co_coastal",
            "Meera — Harbour Call",
            "Late twenties. Controlled voice until the phone rings. Looking for stillness that still reads on camera.",
            "Don't pick up. If you pick up, the harbour becomes a map again — every boat a place you said you'd never go back to.",
            "Malayalam",
            "Kochi",
            "Drama",
            1,
            "public",
        ),
        (
            "th_office_glass",
            "co_metro",
            "Vikram — Glass Floor",
            "Thirties. Corporate thriller read. Measured delivery, then one crack that shows the panic.",
            "They can see me from the street. I can see them seeing me. That is the job — looking calm while the floor turns to glass.",
            "Hindi",
            "Mumbai",
            "Thriller",
            4,
            "private",
        ),
        (
            "th_kitchen_fight",
            "co_metro",
            "Sara — Kitchen Fight",
            "Twenties–thirties. Domestic drama. Heat without shouting — want the argument in the eyes first.",
            "You keep washing the same plate. I keep asking the same question. We are both pretending this is about the sink.",
            "English",
            "Mumbai",
            "Drama",
            7,
            "public",
        ),
        (
            "th_temple_steps",
            "co_southlight",
            "Karthik — Temple Steps",
            "Period-leaning Tamil read. Dignity in posture. Looking for quiet devotion that can tip into anger.",
            "They told me to wait on the steps. I have been waiting long enough to learn every crack in this stone.",
            "Tamil",
            "Coimbatore",
            "Period",
            3,
            "public",
        ),
        (
            "th_podcast_guest",
            "co_monsoon",
            "Guest — Hot Mic",
            "Improvy comedy energy. Talk-show guest who realises the joke is on them halfway through.",
            "Wait — is this still recording? Okay cool. So the story starts with me being confident, which is already a lie.",
            "English",
            "Hyderabad",
            "Comedy",
            8,
            "public",
        ),
        (
            "th_night_shift",
            "co_coastal",
            "Arun — Night Shift",
            "Crime procedural. Exhausted nurse / security guard energy. Truth leaks out between clock punches.",
            "At 3am the hospital sounds honest. Everyone else is asleep, so the secrets finally have room to stand.",
            "English",
            "Kochi",
            "Crime",
            2,
            "private",
        ),
    ]
    with _lock:
        conn = _connect()
        for cid, name, city, genres, banner, logo, owner, plan in companies:
            exists = conn.execute("SELECT 1 FROM companies WHERE id = ?", (cid,)).fetchone()
            if not exists:
                conn.execute(
                    """
                    INSERT INTO companies (id, name, city, genres, banner, logo, verified, followers, showreel, owner_user_id, plan)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?, '', ?, ?)
                    """,
                    (cid, name, city, genres, banner, logo, 40 + abs(hash(cid)) % 200, owner, plan),
                )
        for (
            tid,
            company_id,
            role,
            brief,
            script,
            language,
            city,
            genre,
            days,
            visibility,
        ) in threads:
            exists = conn.execute("SELECT 1 FROM threads WHERE id = ?", (tid,)).fetchone()
            if exists:
                continue
            # Skip if parent company missing (fresh DB order)
            if not conn.execute("SELECT 1 FROM companies WHERE id = ?", (company_id,)).fetchone():
                continue
            deadline = (now + timedelta(days=days)).isoformat()
            conn.execute(
                """
                INSERT INTO threads (id, company_id, role_title, character_brief, script_text, language, city, genre, deadline, visibility_default, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
                """,
                (tid, company_id, role, brief, script, language, city, genre, deadline, visibility, _now()),
            )
        # Keep the original cafe demo call open for Discover filters
        conn.execute(
            "UPDATE threads SET status = 'open', deadline = ? WHERE id = 'th_cafe_scene'",
            ((now + timedelta(days=5)).isoformat(),),
        )
        conn.commit()
        conn.close()


def seed() -> None:
    company_id = "co_southlight"
    prod_id = "user_meera"
    talent_id = "user_arjun"
    talent2 = "user_priya"
    talent3 = "user_rahul"
    thread_id = "th_last_train"
    thread2 = "th_cafe_scene"
    deadline = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    with _lock:
        conn = _connect()
        conn.execute(
            """
            INSERT INTO companies (id, name, city, genres, banner, logo, verified, followers, showreel, owner_user_id, plan)
            VALUES (?, ?, ?, ?, ?, ?, 1, 248, ?, ?, 'Studio')
            """,
            (
                company_id,
                "Southlight Films",
                "Chennai",
                "Drama, Tamil, OTT",
                "Midnight trains & coastal stories",
                "SL",
                "Showreel · 3 featured clips",
                prod_id,
            ),
        )
        users = [
            (prod_id, "production@sammy.app", "demo", "production", "Meera Krishnan", "Chennai", "Tamil, English", "Casting coordinator", "Casting", 0, 1, company_id, 0),
            (talent_id, "talent@sammy.app", "demo", "talent", "Arjun R", "Coimbatore", "Tamil, English", "Aspiring actor · weekends only. Looking for honest first-round reads.", "Drama, Monologue", 742, 0, None, 128),
            (talent2, "priya@sammy.app", "demo", "talent", "Priya Nair", "Kochi", "Malayalam, English", "Theatre + OTT", "Drama", 710, 0, None, 96),
            (talent3, "rahul@sammy.app", "demo", "talent", "Rahul Menon", "Bengaluru", "Kannada, English", "Screen actor", "Comedy, Drama", 688, 0, None, 74),
        ]
        for u in users:
            conn.execute(
                """
                INSERT INTO users (id, email, password, role, name, city, languages, bio, skills, sammy_score, verified, company_id, followers, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (*u, _now()),
            )
        conn.execute(
            """
            INSERT INTO threads (id, company_id, role_title, character_brief, script_text, language, city, genre, deadline, visibility_default, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'public', 'open', ?)
            """,
            (
                thread_id,
                company_id,
                "Alex — The Last Train",
                "Late-twenties. Soft-spoken until the monologue breaks. Looking for vulnerability without collapse — someone who can hold a silent beat.",
                script_as_plain(DEFAULT_SCENE),
                "English",
                "Chennai",
                "Drama",
                deadline,
                _now(),
            ),
        )
        conn.execute(
            """
            INSERT INTO threads (id, company_id, role_title, character_brief, script_text, language, city, genre, deadline, visibility_default, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', 'open', ?)
            """,
            (
                thread2,
                company_id,
                "Server — Night Cafe",
                "Early twenties. Quick humour, then a sudden freeze when an old customer walks in.",
                "I remember your order. Same as always — black coffee, no sugar. Funny how the body keeps rituals even when the heart has moved on.",
                "Tamil",
                "Chennai",
                "Drama",
                (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
                _now(),
            ),
        )
        # Seed scored submissions for AI shortlist demo
        seeded_subs = [
            (talent2, 88, "pending"),
            (talent3, 81, "pending"),
        ]
        for tid, score, decision in seeded_subs:
            dims = [
                {"key": "scriptAccuracy", "label": "Script accuracy", "score": score - 2, "note": "Clean against the page."},
                {"key": "dialogueDelivery", "label": "Dialogue delivery", "score": score + 1, "note": "Natural cadence."},
                {"key": "timingRhythm", "label": "Timing & rhythm", "score": score - 5, "note": "Mostly right."},
                {"key": "reactionExpression", "label": "Reaction & expression", "score": score - 8, "note": "Readable emotion."},
                {"key": "screenPresence", "label": "Screen presence", "score": score, "note": "Holds the frame."},
            ]
            report = {
                "overall": score,
                "summary": f"Demo shortlist tape scored {score}.",
                "writtenFeedback": f"Strong presence at {score}/100 — invite for chemistry if shortlisting.",
                "dimensions": dims,
                "metrics": dims,
                "transcript": "Seeded transcript for demo ranking.",
                "findings": [],
                "highlights": [],
                "improvements": [],
                "engine": {"product": "Sammy Intelligence v1"},
            }
            conn.execute(
                """
                INSERT INTO submissions (id, thread_id, talent_id, visibility, status, decision, file_name, progress, stage, report_json, overall, created_at)
                VALUES (?, ?, ?, 'public', 'complete', ?, 'seed-take.mp4', 1, 'Done', ?, ?, ?)
                """,
                (uuid.uuid4().hex, thread_id, tid, decision, json.dumps(report), score, _now()),
            )
        conn.execute(
            """
            INSERT INTO messages (id, company_id, talent_id, thread_id, direction, body, created_at, read)
            VALUES (?, ?, ?, ?, 'production_to_talent', ?, ?, 0)
            """,
            (
                uuid.uuid4().hex,
                company_id,
                talent_id,
                thread_id,
                "Arjun — loved the vulnerability on the silent beat. Can you come in Thursday 4pm for a chemistry read?",
                _now(),
            ),
        )
        conn.commit()
        conn.close()


def login(email: str, password: str, role: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? AND password = ? AND role = ?",
            (email.strip().lower(), password, role),
        ).fetchone()
        conn.close()
    return _user(row) if row else None


def get_user(user_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
    return _user(row) if row else None


def get_company(company_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
        open_threads = conn.execute(
            "SELECT COUNT(*) AS c FROM threads WHERE company_id = ? AND status = 'open'",
            (company_id,),
        ).fetchone()["c"]
        conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "city": row["city"],
        "genres": row["genres"],
        "banner": row["banner"],
        "logo": row["logo"],
        "logoUrl": row["logo_url"] if "logo_url" in row.keys() else None,
        "coverUrl": row["cover_url"] if "cover_url" in row.keys() else None,
        "coverPosition": row["cover_position"] if "cover_position" in row.keys() else None,
        "about": row["about"] if "about" in row.keys() else None,
        "website": row["website"] if "website" in row.keys() else None,
        "verified": bool(row["verified"]),
        "followers": row["followers"],
        "showreel": row["showreel"],
        "plan": row["plan"],
        "openThreads": open_threads,
    }


def list_threads(*, status: str | None = None, company_id: str | None = None) -> list[dict[str, Any]]:
    q = "SELECT t.*, c.name AS company_name, c.verified AS company_verified, c.city AS company_city FROM threads t JOIN companies c ON c.id = t.company_id WHERE 1=1"
    args: list[Any] = []
    if status:
        q += " AND t.status = ?"
        args.append(status)
    if company_id:
        q += " AND t.company_id = ?"
        args.append(company_id)
    q += " ORDER BY t.created_at DESC"
    with _lock:
        conn = _connect()
        rows = conn.execute(q, args).fetchall()
        out = []
        for row in rows:
            reply_count = conn.execute(
                "SELECT COUNT(*) AS c FROM submissions WHERE thread_id = ? AND status = 'complete'",
                (row["id"],),
            ).fetchone()["c"]
            item = _thread(row)
            item["replyCount"] = reply_count
            item["companyName"] = row["company_name"]
            item["companyVerified"] = bool(row["company_verified"])
            out.append(item)
        conn.close()
    return out


def get_thread(thread_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute(
            """
            SELECT t.*, c.name AS company_name, c.verified AS company_verified
            FROM threads t JOIN companies c ON c.id = t.company_id WHERE t.id = ?
            """,
            (thread_id,),
        ).fetchone()
        conn.close()
    if not row:
        return None
    item = _thread(row)
    item["companyName"] = row["company_name"]
    item["companyVerified"] = bool(row["company_verified"])
    return item


def create_thread(company_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    thread_id = "th_" + uuid.uuid4().hex[:10]
    with _lock:
        conn = _connect()
        conn.execute(
            """
            INSERT INTO threads (id, company_id, role_title, character_brief, script_text, language, city, genre, deadline, visibility_default, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
            """,
            (
                thread_id,
                company_id,
                payload["roleTitle"],
                payload["characterBrief"],
                payload["scriptText"],
                payload["language"],
                payload.get("city") or "",
                payload.get("genre") or "Drama",
                payload["deadline"],
                payload["visibilityDefault"],
                _now(),
            ),
        )
        conn.commit()
        conn.close()
    return get_thread(thread_id)  # type: ignore[return-value]


def close_thread(thread_id: str) -> None:
    with _lock:
        conn = _connect()
        conn.execute("UPDATE threads SET status = 'closed' WHERE id = ?", (thread_id,))
        conn.commit()
        conn.close()


def create_submission(thread_id: str, talent_id: str, visibility: str, file_name: str) -> str:
    sub_id = uuid.uuid4().hex
    with _lock:
        conn = _connect()
        conn.execute(
            """
            INSERT INTO submissions (id, thread_id, talent_id, visibility, status, decision, file_name, progress, stage, created_at)
            VALUES (?, ?, ?, ?, 'queued', 'pending', ?, 0.02, 'Queued', ?)
            """,
            (sub_id, thread_id, talent_id, visibility, file_name, _now()),
        )
        conn.commit()
        conn.close()
    return sub_id


def update_submission(
    sub_id: str,
    *,
    status: str | None = None,
    progress: float | None = None,
    stage: str | None = None,
    error: str | None = None,
    report: dict[str, Any] | None = None,
    overall: int | None = None,
    decision: str | None = None,
) -> None:
    fields: list[str] = []
    values: list[Any] = []
    for key, val in (
        ("status", status),
        ("progress", progress),
        ("stage", stage),
        ("error", error),
        ("overall", overall),
        ("decision", decision),
    ):
        if val is not None:
            fields.append(f"{key} = ?")
            values.append(val)
    if report is not None:
        fields.append("report_json = ?")
        values.append(json.dumps(report))
    if not fields:
        return
    values.append(sub_id)
    with _lock:
        conn = _connect()
        conn.execute(f"UPDATE submissions SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        conn.close()


def get_submission(sub_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute(
            """
            SELECT s.*, u.name AS talent_name, u.city AS talent_city, u.languages AS talent_languages,
                   u.sammy_score AS talent_score, t.role_title
            FROM submissions s
            JOIN users u ON u.id = s.talent_id
            JOIN threads t ON t.id = s.thread_id
            WHERE s.id = ?
            """,
            (sub_id,),
        ).fetchone()
        conn.close()
    return _submission(row) if row else None


def list_submissions(thread_id: str | None = None, talent_id: str | None = None) -> list[dict[str, Any]]:
    q = """
      SELECT s.*, u.name AS talent_name, u.city AS talent_city, u.languages AS talent_languages,
             u.sammy_score AS talent_score, t.role_title
      FROM submissions s
      JOIN users u ON u.id = s.talent_id
      JOIN threads t ON t.id = s.thread_id
      WHERE 1=1
    """
    args: list[Any] = []
    if thread_id:
        q += " AND s.thread_id = ?"
        args.append(thread_id)
    if talent_id:
        q += " AND s.talent_id = ?"
        args.append(talent_id)
    q += " ORDER BY COALESCE(s.overall, 0) DESC, s.created_at DESC"
    with _lock:
        conn = _connect()
        rows = conn.execute(q, args).fetchall()
        conn.close()
    return [_submission(r) for r in rows]


def set_decision(sub_id: str, decision: str) -> None:
    update_submission(sub_id, decision=decision)


def list_messages(company_id: str | None = None, talent_id: str | None = None) -> list[dict[str, Any]]:
    q = """
      SELECT m.*, u.name AS talent_name, c.name AS company_name
      FROM messages m
      JOIN users u ON u.id = m.talent_id
      JOIN companies c ON c.id = m.company_id
      WHERE 1=1
    """
    args: list[Any] = []
    if company_id:
        q += " AND m.company_id = ?"
        args.append(company_id)
    if talent_id:
        q += " AND m.talent_id = ?"
        args.append(talent_id)
    q += " ORDER BY m.created_at DESC"
    with _lock:
        conn = _connect()
        rows = conn.execute(q, args).fetchall()
        conn.close()
    return [
        {
            "id": r["id"],
            "companyId": r["company_id"],
            "talentId": r["talent_id"],
            "threadId": r["thread_id"],
            "direction": r["direction"],
            "body": r["body"],
            "createdAt": r["created_at"],
            "read": bool(r["read"]),
            "talentName": r["talent_name"],
            "companyName": r["company_name"],
        }
        for r in rows
    ]


def send_invite(company_id: str, talent_id: str, thread_id: str | None, body: str) -> dict[str, Any]:
    msg_id = uuid.uuid4().hex
    with _lock:
        conn = _connect()
        conn.execute(
            """
            INSERT INTO messages (id, company_id, talent_id, thread_id, direction, body, created_at, read)
            VALUES (?, ?, ?, ?, 'production_to_talent', ?, ?, 0)
            """,
            (msg_id, company_id, talent_id, thread_id, body, _now()),
        )
        conn.commit()
        conn.close()
    return list_messages(company_id=company_id)[0]


def leaderboard(limit: int = 20) -> list[dict[str, Any]]:
    with _lock:
        conn = _connect()
        rows = conn.execute(
            """
            SELECT id, name, city, languages, sammy_score, followers, verified
            FROM users WHERE role = 'talent'
            ORDER BY sammy_score DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
        conn.close()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "city": r["city"],
            "languages": r["languages"],
            "sammyScore": r["sammy_score"],
            "followers": r["followers"],
            "verified": bool(r["verified"]),
        }
        for r in rows
    ]


def bump_sammy_score(talent_id: str, overall: int) -> int:
    from .metrics import composite_to_sammy_score

    with _lock:
        conn = _connect()
        row = conn.execute("SELECT sammy_score FROM users WHERE id = ?", (talent_id,)).fetchone()
        current = row["sammy_score"] if row else 620
        target = composite_to_sammy_score(overall)
        # Blend toward new take so score grows with evidence
        updated = int(round(current * 0.82 + target * 0.18))
        updated = max(300, min(900, updated))
        conn.execute("UPDATE users SET sammy_score = ? WHERE id = ?", (updated, talent_id))
        conn.commit()
        conn.close()
    return updated


def public_replies(thread_id: str) -> list[dict[str, Any]]:
    return [s for s in list_submissions(thread_id=thread_id) if s["visibility"] == "public" and s["status"] == "complete"]


def _user(row: sqlite3.Row) -> dict[str, Any]:
    keys = row.keys()
    return {
        "id": row["id"],
        "email": row["email"],
        "role": row["role"],
        "name": row["name"],
        "city": row["city"],
        "languages": row["languages"],
        "bio": row["bio"],
        "skills": row["skills"],
        "sammyScore": row["sammy_score"],
        "verified": bool(row["verified"]),
        "companyId": row["company_id"],
        "followers": row["followers"],
        "avatarUrl": row["avatar_url"] if "avatar_url" in keys else None,
        "coverUrl": row["cover_url"] if "cover_url" in keys else None,
        "coverPosition": row["cover_position"] if "cover_position" in keys else None,
    }


def update_company(company_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {
        "name": "name",
        "city": "city",
        "genres": "genres",
        "banner": "banner",
        "logo": "logo",
        "showreel": "showreel",
        "about": "about",
        "website": "website",
        "plan": "plan",
        "logoUrl": "logo_url",
        "coverUrl": "cover_url",
        "coverPosition": "cover_position",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, col in allowed.items():
        if key in fields and fields[key] is not None:
            sets.append(f"{col} = ?")
            values.append(fields[key])
    if not sets:
        return get_company(company_id)
    values.append(company_id)
    with _lock:
        conn = _connect()
        conn.execute(f"UPDATE companies SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
        conn.close()
    return get_company(company_id)


def update_user(user_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {
        "name": "name",
        "city": "city",
        "languages": "languages",
        "bio": "bio",
        "skills": "skills",
        "avatarUrl": "avatar_url",
        "coverUrl": "cover_url",
        "coverPosition": "cover_position",
    }
    sets: list[str] = []
    values: list[Any] = []
    for key, col in allowed.items():
        if key in fields and fields[key] is not None:
            sets.append(f"{col} = ?")
            values.append(fields[key])
    if not sets:
        return get_user(user_id)
    values.append(user_id)
    with _lock:
        conn = _connect()
        conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", values)
        conn.commit()
        conn.close()
    return get_user(user_id)


def _thread(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "companyId": row["company_id"],
        "roleTitle": row["role_title"],
        "characterBrief": row["character_brief"],
        "scriptText": row["script_text"],
        "language": row["language"],
        "city": row["city"],
        "genre": row["genre"],
        "deadline": row["deadline"],
        "visibilityDefault": row["visibility_default"],
        "status": row["status"],
        "createdAt": row["created_at"],
    }


def _submission(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "threadId": row["thread_id"],
        "talentId": row["talent_id"],
        "visibility": row["visibility"],
        "status": row["status"],
        "decision": row["decision"],
        "fileName": row["file_name"],
        "progress": row["progress"],
        "stage": row["stage"],
        "error": row["error"],
        "overall": row["overall"],
        "createdAt": row["created_at"],
        "report": json.loads(row["report_json"]) if row["report_json"] else None,
        "talentName": row["talent_name"],
        "talentCity": row["talent_city"],
        "talentLanguages": row["talent_languages"],
        "talentScore": row["talent_score"],
        "roleTitle": row["role_title"],
    }
