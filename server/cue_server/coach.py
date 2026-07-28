from __future__ import annotations

import re
from typing import Any


def _metric(report: dict[str, Any], key: str) -> dict[str, Any] | None:
    for m in report.get("metrics", []):
        if m["key"] == key:
            return m
    return None


def answer_question(report: dict[str, Any], question: str) -> dict[str, Any]:
    q = question.lower().strip()
    signals = report.get("signals", {})
    align = signals.get("alignment", {})
    if not q:
        return {"answer": "Ask about timing, script accuracy, expressions, confidence, or what to fix first.", "citations": []}
    if any(k in q for k in ("script", "words", "accuracy", "lines", "dialogue text")):
        m = _metric(report, "scriptAccuracy")
        return {
            "answer": (
                f"Script word accuracy is {m['score'] if m else 'n/a'}/100. "
                f"WER {align.get('wer', '—')}: {align.get('substitutions', 0)} substitutions, "
                f"{align.get('deletions', 0)} deletions, {align.get('insertions', 0)} insertions. "
                f"{m['note'] if m else ''} Heard: “{(report.get('transcript') or '')[:220]}”"
            ),
            "citations": ["signals.alignment", "transcript"],
        }
    if any(k in q for k in ("lag", "pause", "timing", "pace", "tempo", "wpm")):
        m = _metric(report, "timing")
        lags = _metric(report, "lags")
        gaps = signals.get("silenceGaps", [])
        gap_txt = ", ".join(f"{a:.1f}–{b:.1f}s" for a, b in gaps[:5]) if gaps else "no major gaps"
        return {
            "answer": (
                f"Timing {m['score'] if m else 'n/a'}/100, lags {lags['score'] if lags else 'n/a'}/100. "
                f"Speech rate ≈ {signals.get('wordsPerMinute', 0)} WPM. Silence map: {gap_txt}. {m['note'] if m else ''}"
            ),
            "citations": ["signals.silenceGaps", "signals.wordsPerMinute"],
        }
    if any(k in q for k in ("face", "expression", "emotion", "react")):
        m = _metric(report, "expressions")
        r = _metric(report, "reactions")
        v = signals.get("vision", {})
        return {
            "answer": (
                f"Expressions {m['score'] if m else 'n/a'}/100, reactions {r['score'] if r else 'n/a'}/100. "
                f"Face in frame {v.get('faceDetectedRatio', 0)*100:.0f}% of samples, "
                f"expression activity {v.get('expressionActivity', 0):.3f}, reaction spikes {v.get('reactionSpikes', 0)}. "
                f"{m['note'] if m else ''}"
            ),
            "citations": ["signals.vision"],
        }
    if any(k in q for k in ("confidence", "bold", "attitude", "presence")):
        conf = _metric(report, "confidence")
        bold = _metric(report, "boldness")
        att = _metric(report, "attitude")
        return {
            "answer": (
                f"Confidence {conf['score'] if conf else 'n/a'}, boldness {bold['score'] if bold else 'n/a'}, "
                f"attitude {att['score'] if att else 'n/a'}. Derived from voice energy, gaze stability, and expression activity. "
                f"Focus line: {att['note'] if att else ''}"
            ),
            "citations": ["metrics.confidence", "metrics.boldness", "metrics.attitude"],
        }
    if any(k in q for k in ("fix", "improve", "weak", "next", "mistake")):
        fixes = report.get("improvements", [])[:3]
        findings = report.get("findings", [])
        detail = " ".join(f["detail"] for f in findings[:2])
        return {
            "answer": "Priority fixes from measured signals:\n" + "\n".join(f"• {item}" for item in fixes) + (f"\nEvidence: {detail}" if detail else ""),
            "citations": ["improvements", "findings"],
        }
    if "transcript" in q or "say" in q or "said" in q:
        return {"answer": f"ASR transcript:\n{report.get('transcript') or '(no speech detected)'}", "citations": ["transcript"]}
    return {
        "answer": (
            f"This take scores {report.get('overall')}/100, reading mainly as {report.get('roleGuess')}. "
            f"{report.get('summary', '')} Ask me about script accuracy, timing/lags, expressions, or what to fix first."
        ),
        "citations": ["summary", "overall"],
    }


def suggested_prompts(report: dict[str, Any]) -> list[str]:
    prompts = [
        "How accurate was I to the script?",
        "Where are my timing lags?",
        "How were my expressions and reactions?",
        "What should I fix first?",
    ]
    if report.get("transcript"):
        prompts.insert(0, "What did you hear me say?")
    return [p for p in prompts if re.search(r"[a-zA-Z]", p)]
