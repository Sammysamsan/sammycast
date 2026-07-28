from __future__ import annotations

import re
import subprocess
import wave
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel
from rapidfuzz import fuzz
from rapidfuzz.distance import Levenshtein

from .script_data import script_words


@dataclass
class WordHit:
    word: str
    start: float
    end: float
    probability: float


@dataclass
class SpeechResult:
    transcript: str
    words: list[WordHit]
    duration: float
    speech_ratio: float
    mean_rms: float
    rms_peaks: float
    silence_gaps: list[tuple[float, float]]
    words_per_minute: float
    alignment: dict


@lru_cache(maxsize=1)
def get_whisper(model_size: str = "base.en") -> WhisperModel:
    return WhisperModel(model_size, device="cpu", compute_type="int8")


def extract_audio(video_path: Path, wav_path: Path) -> float:
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video_path), "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", str(wav_path)],
        check=True,
        capture_output=True,
    )
    with wave.open(str(wav_path), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate() or 1)


def _load_pcm(wav_path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(wav_path), "rb") as wf:
        rate = wf.getframerate()
        audio = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return audio, rate


def analyze_audio_energy(wav_path: Path, min_gap: float = 0.75) -> dict:
    audio, rate = _load_pcm(wav_path)
    if audio.size == 0:
        return {"mean_rms": 0.0, "rms_peaks": 0.0, "speech_ratio": 0.0, "silence_gaps": [], "duration": 0.0}
    win = max(int(rate * 0.05), 1)
    n = audio.size // win
    if n == 0:
        rms = float(np.sqrt(np.mean(audio**2)))
        return {
            "mean_rms": rms,
            "rms_peaks": rms,
            "speech_ratio": 1.0 if rms > 0.02 else 0.0,
            "silence_gaps": [],
            "duration": audio.size / rate,
        }
    chunks = audio[: n * win].reshape(n, win)
    rms = np.sqrt(np.mean(chunks**2, axis=1))
    threshold = max(float(np.percentile(rms, 35)) * 1.35, 0.015)
    voiced = rms > threshold
    gaps: list[tuple[float, float]] = []
    start = None
    for i, is_voice in enumerate(voiced):
        t = i * 0.05
        if not is_voice and start is None:
            start = t
        if is_voice and start is not None:
            if t - start >= min_gap:
                gaps.append((round(start, 2), round(t, 2)))
            start = None
    if start is not None:
        end = len(voiced) * 0.05
        if end - start >= min_gap:
            gaps.append((round(start, 2), round(end, 2)))
    return {
        "mean_rms": float(np.mean(rms)),
        "rms_peaks": float(np.percentile(rms, 90)),
        "speech_ratio": float(np.mean(voiced)),
        "silence_gaps": gaps,
        "duration": audio.size / rate,
    }


def _normalize_word(word: str) -> str:
    return re.sub(r"[^a-z0-9']", "", word.lower())


def align_to_script(spoken_words: list[str], reference: list[str] | None = None) -> dict:
    reference = reference or script_words()
    hyp = [_normalize_word(w) for w in spoken_words if _normalize_word(w)]
    ref = reference
    if not ref or not hyp:
        return {
            "accuracy": 0.0,
            "wer": 1.0,
            "matched": 0,
            "substitutions": 0,
            "deletions": len(ref),
            "insertions": 0,
            "coverage": 0.0,
            "fuzzy": 0.0,
        }
    ops = Levenshtein.editops(ref, hyp)
    substitutions = sum(1 for op in ops if op.tag == "replace")
    deletions = sum(1 for op in ops if op.tag == "delete")
    insertions = sum(1 for op in ops if op.tag == "insert")
    matched = max(len(ref) - deletions - substitutions, 0)
    wer = (substitutions + deletions + insertions) / max(len(ref), 1)
    accuracy = max(0.0, 1.0 - min(wer, 1.0))
    fuzzy = fuzz.token_set_ratio(" ".join(ref), " ".join(hyp)) / 100.0
    return {
        "accuracy": round(accuracy * 0.65 + fuzzy * 0.35, 4),
        "wer": round(wer, 4),
        "matched": matched,
        "substitutions": substitutions,
        "deletions": deletions,
        "insertions": insertions,
        "coverage": round(matched / max(len(ref), 1), 4),
        "fuzzy": round(fuzzy, 4),
    }


def transcribe(wav_path: Path) -> tuple[str, list[WordHit]]:
    model = get_whisper()
    segments, _info = model.transcribe(str(wav_path), word_timestamps=True, vad_filter=True, beam_size=5)
    words: list[WordHit] = []
    parts: list[str] = []
    for segment in segments:
        parts.append(segment.text.strip())
        if not segment.words:
            continue
        for w in segment.words:
            token = _normalize_word(w.word)
            if not token:
                continue
            words.append(
                WordHit(
                    word=token,
                    start=float(w.start or 0.0),
                    end=float(w.end or 0.0),
                    probability=float(getattr(w, "probability", 0.0) or 0.0),
                )
            )
    return " ".join(p for p in parts if p).strip(), words


def analyze_speech(video_path: Path, work_dir: Path) -> SpeechResult:
    wav_path = work_dir / "audio.wav"
    duration = extract_audio(video_path, wav_path)
    energy = analyze_audio_energy(wav_path)
    transcript, words = transcribe(wav_path)
    if words:
        span = max(words[-1].end - words[0].start, 0.01)
        wpm = (len(words) / span) * 60.0
    else:
        wpm = 0.0
    return SpeechResult(
        transcript=transcript,
        words=words,
        duration=duration or energy["duration"],
        speech_ratio=energy["speech_ratio"],
        mean_rms=energy["mean_rms"],
        rms_peaks=energy["rms_peaks"],
        silence_gaps=energy["silence_gaps"],
        words_per_minute=wpm,
        alignment=align_to_script([w.word for w in words]),
    )
