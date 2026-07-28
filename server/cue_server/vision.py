from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL_PATH = Path(__file__).resolve().parent / "models" / "face_landmarker.task"


@dataclass
class VisionResult:
    face_detected_ratio: float
    expression_activity: float
    smile_score: float
    brow_score: float
    jaw_score: float
    gaze_stability: float
    movement_energy: float
    reaction_spikes: int
    samples: int
    notes: list[str]


def extract_frames(video_path: Path, frames_dir: Path, fps: float = 2.0) -> list[Path]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video_path), "-vf", f"fps={fps}", "-q:v", "3", str(frames_dir / "frame_%04d.jpg")],
        check=True,
        capture_output=True,
    )
    return sorted(frames_dir.glob("frame_*.jpg"))


def _blendshape_map(result) -> dict[str, float]:
    if not result.face_blendshapes:
        return {}
    return {c.category_name: float(c.score) for c in result.face_blendshapes[0]}


def _analyze_motion_only(frames: list[Path], note: str) -> VisionResult:
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    detected = 0
    prev_gray = None
    motion_vals: list[float] = []
    centers: list[tuple[float, float]] = []
    for frame_path in frames:
        bgr = cv2.imread(str(frame_path))
        if bgr is None:
            continue
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        if prev_gray is not None:
            motion_vals.append(float(np.mean(cv2.absdiff(gray, prev_gray)) / 255.0))
        prev_gray = gray
        faces = cascade.detectMultiScale(gray, 1.1, 4, minSize=(48, 48))
        if len(faces):
            detected += 1
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            centers.append(((x + w / 2) / gray.shape[1], (y + h / 2) / gray.shape[0]))
    samples = len(frames)
    face_ratio = detected / max(samples, 1)
    movement_energy = float(np.mean(motion_vals)) if motion_vals else 0.0
    if len(centers) >= 2:
        jumps = [np.hypot(centers[i][0] - centers[i - 1][0], centers[i][1] - centers[i - 1][1]) for i in range(1, len(centers))]
        gaze_stability = float(max(0.0, 1.0 - np.mean(jumps) * 8.0))
    else:
        gaze_stability = 0.0
    return VisionResult(
        face_detected_ratio=round(face_ratio, 4),
        expression_activity=round(min(movement_energy * 1.8, 0.08), 4),
        smile_score=0.0,
        brow_score=0.0,
        jaw_score=0.0,
        gaze_stability=round(gaze_stability, 4),
        movement_energy=round(movement_energy, 4),
        reaction_spikes=int(sum(1 for m in motion_vals if m > 0.04)),
        samples=samples,
        notes=[note],
    )


def analyze_vision(video_path: Path, work_dir: Path) -> VisionResult:
    frames = extract_frames(video_path, work_dir / "frames", fps=2.0)
    if not frames:
        return VisionResult(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0, 0, ["No frames could be extracted from the video."])
    try:
        options = mp_vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(MODEL_PATH)),
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            num_faces=1,
        )
        landmarker = mp_vision.FaceLandmarker.create_from_options(options)
    except Exception as exc:  # noqa: BLE001
        return _analyze_motion_only(frames, f"Face landmarker unavailable ({exc}). Used OpenCV face/motion fallback.")

    detected = 0
    smile_vals: list[float] = []
    brow_vals: list[float] = []
    jaw_vals: list[float] = []
    expr_series: list[float] = []
    centers: list[tuple[float, float]] = []
    prev_gray = None
    motion_vals: list[float] = []
    try:
        for frame_path in frames:
            bgr = cv2.imread(str(frame_path))
            if bgr is None:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
            if prev_gray is not None:
                motion_vals.append(float(np.mean(cv2.absdiff(gray, prev_gray)) / 255.0))
            prev_gray = gray
            if not result.face_landmarks:
                expr_series.append(0.0)
                continue
            detected += 1
            lm = result.face_landmarks[0]
            centers.append((float(np.mean([p.x for p in lm])), float(np.mean([p.y for p in lm]))))
            blends = _blendshape_map(result)
            smile = (blends.get("mouthSmileLeft", 0) + blends.get("mouthSmileRight", 0) + blends.get("mouthDimpleLeft", 0) + blends.get("mouthDimpleRight", 0)) / 4
            brow = (blends.get("browInnerUp", 0) + blends.get("browDownLeft", 0) + blends.get("browDownRight", 0) + blends.get("browOuterUpLeft", 0) + blends.get("browOuterUpRight", 0)) / 5
            jaw = (blends.get("jawOpen", 0) + blends.get("mouthFunnel", 0) + blends.get("mouthPucker", 0)) / 3
            smile_vals.append(smile)
            brow_vals.append(brow)
            jaw_vals.append(jaw)
            expr_series.append(float(np.mean(list(blends.values()))) if blends else 0.0)
    finally:
        landmarker.close()

    samples = len(frames)
    face_ratio = detected / max(samples, 1)
    expression_activity = float(np.std(expr_series)) if expr_series else 0.0
    if len(centers) >= 2:
        jumps = [np.hypot(centers[i][0] - centers[i - 1][0], centers[i][1] - centers[i - 1][1]) for i in range(1, len(centers))]
        gaze_stability = float(max(0.0, 1.0 - np.mean(jumps) * 8.0))
    else:
        gaze_stability = 0.0
    movement_energy = float(np.mean(motion_vals)) if motion_vals else 0.0
    reaction_spikes = 0
    if len(expr_series) >= 3:
        delta = np.abs(np.diff(np.array(expr_series, dtype=np.float32)))
        reaction_spikes = int(np.sum(delta >= max(float(np.percentile(delta, 75)), 0.01)))
    notes: list[str] = []
    if face_ratio < 0.35:
        notes.append("Face was often out of frame or poorly lit — expression scoring is limited.")
    if expression_activity < 0.01 and face_ratio > 0.5:
        notes.append("Facial expression stayed relatively flat across sampled frames.")
    if movement_energy > 0.08:
        notes.append("High frame motion detected — camera shake or large blocking shifts.")
    return VisionResult(
        face_detected_ratio=round(face_ratio, 4),
        expression_activity=round(expression_activity, 4),
        smile_score=round(float(np.mean(smile_vals)) if smile_vals else 0.0, 4),
        brow_score=round(float(np.mean(brow_vals)) if brow_vals else 0.0, 4),
        jaw_score=round(float(np.mean(jaw_vals)) if jaw_vals else 0.0, 4),
        gaze_stability=round(gaze_stability, 4),
        movement_energy=round(movement_energy, 4),
        reaction_spikes=reaction_spikes,
        samples=samples,
        notes=notes,
    )
