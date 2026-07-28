from __future__ import annotations

from typing import Any

from .speech import SpeechResult
from .vision import VisionResult


def _clamp(score: float, lo: float = 0.0, hi: float = 100.0) -> int:
    return int(round(max(lo, min(hi, score))))


def _note_for(score: int, low: str, mid: str, high: str) -> str:
    if score < 62:
        return low
    if score < 80:
        return mid
    return high


def build_report(*, file_name: str, scene: dict, speech: SpeechResult, vision: VisionResult) -> dict[str, Any]:
    """Sammy Intelligence — five casting dimensions + legacy detail metrics."""
    align = speech.alignment
    accuracy_pct = align["accuracy"] * 100.0
    avg_prob = float(sum(w.probability for w in speech.words) / len(speech.words)) if speech.words else 0.0
    wpm = speech.words_per_minute
    if wpm <= 0:
        wpm_score = 35
    elif 110 <= wpm <= 160:
        wpm_score = 92
    elif 90 <= wpm < 110 or 160 < wpm <= 185:
        wpm_score = 78
    else:
        wpm_score = 58

    script_accuracy = _clamp(accuracy_pct)
    delivery = _clamp(avg_prob * 55 + wpm_score * 0.45)
    long_gaps = [g for g in speech.silence_gaps if (g[1] - g[0]) >= 1.2]
    mild_gaps = [g for g in speech.silence_gaps if 0.75 <= (g[1] - g[0]) < 1.2]
    lags = _clamp(88 - min(45.0, len(long_gaps) * 10 + len(mild_gaps) * 4))
    timing = _clamp(0.55 * lags + 0.45 * (92 if 100 <= wpm <= 170 else 70 if 80 <= wpm <= 190 else 52))
    expressions = _clamp(
        vision.face_detected_ratio * 35
        + min(vision.expression_activity * 900, 40)
        + vision.brow_score * 120
        + vision.jaw_score * 80
    )
    reactions = _clamp(
        40
        + min(vision.reaction_spikes * 4.5, 35)
        + vision.expression_activity * 500
        + vision.face_detected_ratio * 15
    )
    reaction_expression = _clamp(0.55 * reactions + 0.45 * expressions)
    presence = min(speech.rms_peaks * 180, 40)
    screen_presence = _clamp(
        36
        + presence
        + vision.gaze_stability * 28
        + vision.face_detected_ratio * 18
        + min(speech.mean_rms * 160, 12)
    )

    dimensions = [
        {
            "key": "scriptAccuracy",
            "label": "Script accuracy",
            "score": script_accuracy,
            "note": _note_for(
                script_accuracy,
                f"Word accuracy ~{script_accuracy}% — stay closer to the page.",
                f"Mostly on-book (~{script_accuracy}%); clean the near-misses.",
                f"High fidelity to the written lines (~{script_accuracy}%).",
            ),
        },
        {
            "key": "dialogueDelivery",
            "label": "Dialogue delivery",
            "score": delivery,
            "note": _note_for(
                delivery,
                "Tone and clarity need sharpening — own the emotional colour.",
                "Delivery lands; push pacing and emphasis on key turns.",
                "Clear, playable delivery with usable dramatic colour.",
            ),
        },
        {
            "key": "timingRhythm",
            "label": "Timing & rhythm",
            "score": timing,
            "note": _note_for(
                timing,
                "Beats rush or stall; shape pauses so silence earns meaning.",
                "Rhythm is mostly right with a few early/late edges.",
                "Pauses and punchlines sit where the scene wants them.",
            ),
        },
        {
            "key": "reactionExpression",
            "label": "Reaction & expression",
            "score": reaction_expression,
            "note": _note_for(
                reaction_expression,
                "Face stays thin between thoughts — react in the gaps.",
                "Some reactive life; deepen micro-changes on emotional beats.",
                "Expression and reaction track the scene’s intent.",
            ),
        },
        {
            "key": "screenPresence",
            "label": "Screen presence",
            "score": screen_presence,
            "note": _note_for(
                screen_presence,
                "Camera energy is soft — eye-line and framing need commitment.",
                "Present enough; hold the frame with steadier gaze and voice.",
                "Owns the frame — eye-line, energy, and comfort read clearly.",
            ),
        },
    ]

    overall = _clamp(sum(d["score"] for d in dimensions) / len(dimensions))
    role_guess = scene.get("character") or "Performer"
    findings = []
    if align["substitutions"] or align["deletions"] or align["insertions"]:
        findings.append(
            {
                "type": "script",
                "title": "Script drift",
                "detail": (
                    f"{align['substitutions']} substitutions, {align['deletions']} deletions, "
                    f"{align['insertions']} insertions vs the sides."
                ),
            }
        )
    if long_gaps:
        findings.append(
            {
                "type": "timing",
                "title": "Dead air",
                "detail": "Long pauses at " + ", ".join(f"{a:.1f}–{b:.1f}s" for a, b in long_gaps[:4]),
            }
        )
    if vision.face_detected_ratio < 0.5:
        findings.append(
            {
                "type": "camera",
                "title": "Face coverage",
                "detail": f"Face detected in only {vision.face_detected_ratio * 100:.0f}% of sampled frames.",
            }
        )

    top = sorted(dimensions, key=lambda m: m["score"], reverse=True)[:2]
    low = sorted(dimensions, key=lambda m: m["score"])[:2]
    written = (
        f"Composite {overall}/100. "
        f"Strongest: {top[0]['label'].lower()}. "
        f"Coach next on {low[0]['label'].lower()} — {low[0]['note']}"
    )

    return {
        "overall": overall,
        "summary": written,
        "writtenFeedback": written,
        "roleGuess": role_guess,
        "durationSec": round(speech.duration, 2),
        "fileName": file_name,
        "sceneId": scene.get("id", "custom"),
        "sceneTitle": scene.get("title", "Audition"),
        "transcript": speech.transcript,
        "dimensions": dimensions,
        "metrics": dimensions,  # alias for older UI
        "highlights": [f"{m['label']}: {m['note']}" for m in top],
        "improvements": [f"{m['label']}: {m['note']}" for m in low],
        "findings": findings,
        "signals": {
            "wordsPerMinute": round(wpm, 1),
            "speechRatio": round(speech.speech_ratio, 3),
            "meanRms": round(speech.mean_rms, 4),
            "silenceGaps": speech.silence_gaps,
            "alignment": align,
            "vision": {
                "faceDetectedRatio": vision.face_detected_ratio,
                "expressionActivity": vision.expression_activity,
                "gazeStability": vision.gaze_stability,
                "movementEnergy": vision.movement_energy,
                "reactionSpikes": vision.reaction_spikes,
                "samples": vision.samples,
            },
        },
        "engine": {
            "speech": "faster-whisper base.en",
            "vision": "mediapipe face landmarker",
            "product": "Sammy Intelligence v1",
        },
    }


def composite_to_sammy_score(overall_0_100: int, consistency: float = 0.7, feedback: float = 0.6) -> int:
    """Map take quality into Sammy Score band 300–900."""
    base = 300 + overall_0_100 * 5.2
    boost = consistency * 40 + feedback * 30
    return int(max(300, min(900, round(base + boost))))
