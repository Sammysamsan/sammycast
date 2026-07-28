from __future__ import annotations

import shutil
import traceback
from pathlib import Path

from .metrics import build_report
from .platform import bump_sammy_score, get_thread, update_submission
from .script_data import DEFAULT_SCENE
from .speech import analyze_speech, get_whisper
from .store import UPLOAD_DIR
from .vision import analyze_vision


def warmup() -> None:
    get_whisper()


def _scene_from_thread(thread_id: str) -> dict:
    thread = get_thread(thread_id)
    if not thread:
        return DEFAULT_SCENE
    return {
        "id": thread["id"],
        "title": thread["roleTitle"],
        "character": thread["roleTitle"].split("—")[0].strip() if "—" in thread["roleTitle"] else "Performer",
        "lines": [{"speaker": "Talent", "text": thread["scriptText"]}],
    }


def run_submission(sub_id: str, video_path: Path, thread_id: str, talent_id: str) -> None:
    scene = _scene_from_thread(thread_id)
    work_dir = UPLOAD_DIR / sub_id / "work"
    work_dir.mkdir(parents=True, exist_ok=True)
    try:
        update_submission(sub_id, status="analyzing", progress=0.08, stage="Extracting audio…")
        speech = analyze_speech(video_path, work_dir)
        update_submission(sub_id, progress=0.55, stage="Reading face, expression & presence…")
        vision = analyze_vision(video_path, work_dir)
        update_submission(sub_id, progress=0.88, stage="Sammy Intelligence scoring…")
        report = build_report(file_name=video_path.name, scene=scene, speech=speech, vision=vision)
        bump_sammy_score(talent_id, report["overall"])
        update_submission(
            sub_id,
            status="complete",
            progress=1.0,
            stage="Done",
            report=report,
            overall=report["overall"],
        )
    except Exception as exc:  # noqa: BLE001
        update_submission(
            sub_id,
            status="error",
            stage="Failed",
            error=f"{exc}\n{traceback.format_exc()[-1200:]}",
        )
    finally:
        frames = work_dir / "frames"
        if frames.exists():
            shutil.rmtree(frames, ignore_errors=True)
