from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .pipeline import run_submission, warmup
from .platform import (
    UPLOAD_DIR,
    close_thread,
    create_submission,
    create_thread,
    get_company,
    get_submission,
    get_thread,
    get_user,
    init_db,
    leaderboard,
    list_messages,
    list_submissions,
    list_threads,
    login,
    public_replies,
    send_invite,
    set_decision,
    update_company,
    update_user,
)
from .store import init_db as init_legacy

MAX_BYTES = 100 * 1024 * 1024
ALLOWED_EXT = {".mp4", ".mov", ".webm", ".m4v"}

app = FastAPI(title="Sammy API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
executor = ThreadPoolExecutor(max_workers=1)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    init_legacy()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / "media").mkdir(parents=True, exist_ok=True)
    executor.submit(warmup)


app.mount("/api/media", StaticFiles(directory=str(UPLOAD_DIR / "media")), name="media")


def _user_from_header(x_user_id: str | None) -> dict[str, Any]:
    if not x_user_id:
        raise HTTPException(401, "Login required")
    user = get_user(x_user_id)
    if not user:
        raise HTTPException(401, "Invalid session")
    return user


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "sammy"}


class LoginBody(BaseModel):
    email: str
    password: str
    role: str = Field(pattern="^(production|talent)$")


@app.post("/api/auth/login")
def auth_login(body: LoginBody) -> dict[str, Any]:
    user = login(body.email, body.password, body.role)
    if not user:
        raise HTTPException(401, "Invalid email, password, or role")
    company = get_company(user["companyId"]) if user.get("companyId") else None
    return {"user": user, "company": company}


@app.get("/api/me")
def me(x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    company = get_company(user["companyId"]) if user.get("companyId") else None
    return {"user": user, "company": company}


@app.get("/api/companies/{company_id}")
def company(company_id: str) -> dict[str, Any]:
    row = get_company(company_id)
    if not row:
        raise HTTPException(404, "Company not found")
    return row


@app.get("/api/threads")
def threads(
    status: str | None = None,
    mine: bool = False,
    x_user_id: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    company_id = None
    if mine:
        user = _user_from_header(x_user_id)
        if user["role"] != "production":
            raise HTTPException(403, "Production only")
        company_id = user["companyId"]
    return list_threads(status=status, company_id=company_id)


@app.get("/api/threads/{thread_id}")
def thread_detail(thread_id: str) -> dict[str, Any]:
    row = get_thread(thread_id)
    if not row:
        raise HTTPException(404, "Thread not found")
    row["publicReplies"] = public_replies(thread_id)
    return row


class ThreadBody(BaseModel):
    roleTitle: str
    characterBrief: str
    scriptText: str
    language: str
    city: str = ""
    genre: str = "Drama"
    deadline: str
    visibilityDefault: str = Field(pattern="^(public|private)$")


@app.post("/api/threads")
def new_thread(body: ThreadBody, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production" or not user.get("companyId"):
        raise HTTPException(403, "Production company required")
    return create_thread(user["companyId"], body.model_dump())


@app.post("/api/threads/{thread_id}/close")
def thread_close(thread_id: str, x_user_id: str | None = Header(default=None)) -> dict[str, str]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production":
        raise HTTPException(403, "Production only")
    close_thread(thread_id)
    return {"status": "closed"}


@app.get("/api/threads/{thread_id}/submissions")
def thread_subs(thread_id: str, x_user_id: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production":
        raise HTTPException(403, "Production only")
    return list_submissions(thread_id=thread_id)


@app.get("/api/submissions/mine")
def my_subs(x_user_id: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = _user_from_header(x_user_id)
    if user["role"] != "talent":
        raise HTTPException(403, "Talent only")
    return list_submissions(talent_id=user["id"])


@app.get("/api/submissions/{sub_id}")
def sub_detail(sub_id: str) -> dict[str, Any]:
    row = get_submission(sub_id)
    if not row:
        raise HTTPException(404, "Submission not found")
    return row


@app.post("/api/threads/{thread_id}/submit")
async def submit_tape(
    thread_id: str,
    video: UploadFile = File(...),
    visibility: str = Form(...),
    x_user_id: str | None = Header(default=None),
) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "talent":
        raise HTTPException(403, "Talent only")
    if visibility not in {"public", "private"}:
        raise HTTPException(400, "Choose public or private visibility")
    thread = get_thread(thread_id)
    if not thread or thread["status"] != "open":
        raise HTTPException(400, "Thread is not open")
    name = video.filename or "take.mp4"
    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED_EXT:
        raise HTTPException(400, "Use MP4, MOV, WebM, or M4V.")
    data = await video.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(400, "File empty or over 100 MB.")
    sub_id = create_submission(thread_id, user["id"], visibility, name)
    dest_dir = UPLOAD_DIR / sub_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"source{suffix}"
    dest.write_bytes(data)
    loop = asyncio.get_running_loop()
    loop.run_in_executor(executor, run_submission, sub_id, dest, thread_id, user["id"])
    return {"id": sub_id, "status": "queued"}


class DecisionBody(BaseModel):
    decision: str = Field(pattern="^(shortlist|pass|pending)$")


@app.post("/api/submissions/{sub_id}/decision")
def decide(sub_id: str, body: DecisionBody, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production":
        raise HTTPException(403, "Production only")
    set_decision(sub_id, body.decision)
    return get_submission(sub_id)  # type: ignore[return-value]


@app.get("/api/messages")
def messages(x_user_id: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = _user_from_header(x_user_id)
    if user["role"] == "production":
        return list_messages(company_id=user["companyId"])
    return list_messages(talent_id=user["id"])


class InviteBody(BaseModel):
    talentId: str
    threadId: str | None = None
    body: str


@app.post("/api/messages/invite")
def invite(body: InviteBody, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production" or not user.get("companyId"):
        raise HTTPException(403, "Production only")
    return send_invite(user["companyId"], body.talentId, body.threadId, body.body)


@app.get("/api/leaderboard")
def board() -> list[dict[str, Any]]:
    return leaderboard()


@app.get("/api/talent/{talent_id}")
def talent_profile(talent_id: str) -> dict[str, Any]:
    user = get_user(talent_id)
    if not user or user["role"] != "talent":
        raise HTTPException(404, "Talent not found")
    subs = list_submissions(talent_id=talent_id)
    return {"profile": user, "auditions": [s for s in subs if s["status"] == "complete"][:12]}


class CompanyUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    genres: str | None = None
    banner: str | None = None
    logo: str | None = None
    showreel: str | None = None
    about: str | None = None
    website: str | None = None
    plan: str | None = None
    coverPosition: str | None = None


class TalentUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    languages: str | None = None
    bio: str | None = None
    skills: str | None = None
    coverPosition: str | None = None


def _save_image_bytes(
    data: bytes,
    filename: str | None,
    prefix: str,
    content_type: str | None = None,
) -> str:
    suffix = Path(filename or "").suffix.lower()
    ctype = (content_type or "").split(";")[0].strip().lower()
    if not suffix:
        suffix = {
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
        }.get(ctype, ".jpg")
    if suffix == ".jpeg":
        suffix = ".jpg"
    if suffix not in {".jpg", ".png", ".webp", ".gif"}:
        raise HTTPException(
            400,
            "Unsupported image type. Please use JPG, PNG, or WebP (not HEIC).",
        )
    if not data:
        raise HTTPException(400, "Empty image file.")
    # Phone cover photos are often 8–12 MB; allow headroom before client compression.
    if len(data) > 16 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 16 MB.")
    name = f"{prefix}_{uuid_hex()}{suffix}"
    dest = UPLOAD_DIR / "media" / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return f"/api/media/{name}"


def uuid_hex() -> str:
    import uuid

    return uuid.uuid4().hex[:12]


@app.patch("/api/company/me")
def patch_company(body: CompanyUpdate, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production" or not user.get("companyId"):
        raise HTTPException(403, "Production only")
    updated = update_company(user["companyId"], body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "Company not found")
    return updated


@app.post("/api/company/me/logo")
async def company_logo(file: UploadFile = File(...), x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production" or not user.get("companyId"):
        raise HTTPException(403, "Production only")
    url = _save_image_bytes(await file.read(), file.filename, "logo", file.content_type)
    return update_company(user["companyId"], {"logoUrl": url})  # type: ignore[return-value]


@app.post("/api/company/me/cover")
async def company_cover(file: UploadFile = File(...), x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "production" or not user.get("companyId"):
        raise HTTPException(403, "Production only")
    url = _save_image_bytes(await file.read(), file.filename, "cover", file.content_type)
    return update_company(user["companyId"], {"coverUrl": url, "coverPosition": "50 50"})  # type: ignore[return-value]


@app.patch("/api/talent/me")
def patch_talent(body: TalentUpdate, x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "talent":
        raise HTTPException(403, "Talent only")
    updated = update_user(user["id"], body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(404, "User not found")
    return updated


@app.post("/api/talent/me/avatar")
async def talent_avatar(file: UploadFile = File(...), x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "talent":
        raise HTTPException(403, "Talent only")
    url = _save_image_bytes(await file.read(), file.filename, "avatar", file.content_type)
    return update_user(user["id"], {"avatarUrl": url})  # type: ignore[return-value]


@app.post("/api/talent/me/cover")
async def talent_cover(file: UploadFile = File(...), x_user_id: str | None = Header(default=None)) -> dict[str, Any]:
    user = _user_from_header(x_user_id)
    if user["role"] != "talent":
        raise HTTPException(403, "Talent only")
    url = _save_image_bytes(await file.read(), file.filename, "tcover", file.content_type)
    return update_user(user["id"], {"coverUrl": url, "coverPosition": "50 50"})  # type: ignore[return-value]


@app.get("/api/pricing")
def pricing() -> dict[str, Any]:
    return {
        "talent": [
            {
                "id": "talent_free",
                "name": "Starter",
                "price": "₹0",
                "period": "forever",
                "blurb": "Discover threads, submit tapes, and build your Sammy Score.",
                "features": ["Open audition feed", "3 AI score reports / month", "Public profile", "Leaderboard access"],
            },
            {
                "id": "talent_pro",
                "name": "Pro Actor",
                "price": "₹499",
                "period": "/ month",
                "blurb": "Deeper coaching notes and priority placement in shortlists.",
                "features": [
                    "Unlimited AI score reports",
                    "Priority in AI shortlists",
                    "Verified badge eligibility",
                    "Advanced feedback breakdown",
                ],
                "popular": True,
            },
            {
                "id": "talent_elite",
                "name": "Elite",
                "price": "₹1,299",
                "period": "/ month",
                "blurb": "For working actors chasing callbacks and brand casting.",
                "features": [
                    "Everything in Pro",
                    "1 human review appeal / month",
                    "Showcase event access",
                    "Marketplace deal alerts",
                ],
            },
        ],
        "production": [
            {
                "id": "prod_indie",
                "name": "Indie",
                "price": "₹4,999",
                "period": "/ month",
                "blurb": "For boutique studios posting a handful of roles.",
                "features": ["5 open threads", "AI shortlist ranking", "Basic analytics", "2 team seats"],
            },
            {
                "id": "prod_studio",
                "name": "Studio",
                "price": "₹14,999",
                "period": "/ month",
                "blurb": "Unlimited casting velocity for series and features.",
                "features": [
                    "Unlimited threads",
                    "Advanced AI filters",
                    "Bulk invites",
                    "10 team seats",
                    "Priority support",
                ],
                "popular": True,
            },
            {
                "id": "prod_enterprise",
                "name": "Enterprise",
                "price": "Custom",
                "period": "annual contract",
                "blurb": "White-label pipelines for OTT platforms and large houses.",
                "features": [
                    "SSO & audit logs",
                    "Dedicated success manager",
                    "Custom score weights",
                    "Regional SLA & data residency",
                    "API access",
                ],
                "enterprise": True,
            },
        ],
    }
