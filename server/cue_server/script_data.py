from __future__ import annotations

# Default monologue used in seeded audition threads.
DEFAULT_SCENE = {
    "id": "the-last-train",
    "title": "Monologue — The Last Train",
    "logline": "Alone on a platform after midnight, a person finally says what they never said out loud.",
    "character": "Alex",
    "lines": [
        {"speaker": "Alex", "text": "You said you'd wait."},
        {
            "speaker": "Alex",
            "text": (
                "Not in a dramatic way. Not with fireworks or some big speech. Just… wait. "
                "Like people do when they mean it."
            ),
        },
        {
            "speaker": "Alex",
            "text": (
                "I counted the boards on this platform. Twice. I watched a moth throw itself "
                "at the light until it forgot what it was looking for. I told myself if the "
                "last train came and you weren't here, I would still be fine."
            ),
        },
        {"speaker": "Alex", "text": "I am not fine."},
        {
            "speaker": "Alex",
            "text": (
                "Funny, isn't it? How we practice being brave in empty rooms. How we rehearse "
                "the version of ourselves that doesn't call, doesn't chase, doesn't need. "
                "And then one delayed announcement cracks the whole performance open."
            ),
        },
        {
            "speaker": "Alex",
            "text": (
                "If you're hearing this—if somehow you turned around—I need you to know I "
                "wasn't asking you to save me. I was asking you to stay long enough for me "
                "to stop pretending I don't care."
            ),
        },
        {
            "speaker": "Alex",
            "text": (
                "The train is here. Doors open. People step on like nothing in the world is "
                "ending. Maybe nothing is. Maybe it's just me, standing here with my mouth "
                "full of everything I should have said when you were still close enough to hear it."
            ),
        },
        {
            "speaker": "Alex",
            "text": "I care. God help me—I care. And I'm getting on anyway.",
        },
    ],
}


def full_script_text(scene: dict | None = None) -> str:
    scene = scene or DEFAULT_SCENE
    return " ".join(line["text"] for line in scene["lines"])


def script_words(scene: dict | None = None) -> list[str]:
    import re

    return re.findall(r"[a-z0-9']+", full_script_text(scene).lower())


def script_as_plain(scene: dict | None = None) -> str:
    scene = scene or DEFAULT_SCENE
    return "\n\n".join(line["text"] for line in scene["lines"])
