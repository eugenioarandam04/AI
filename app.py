from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini")

ASSISTANT_SYSTEM_PROMPT = """
You are LAWGEN, a legal and economic educational assistant inside a web app.
Your job is to explain lease, credit, and default-interest concepts clearly and calmly.
You are not a law firm and must not present yourself as a substitute for licensed legal advice.
Always:
- explain concepts in plain language first
- reference the user's provided calculator values when useful
- point out negotiation ideas or financial watchouts when relevant
- stay concise but warm
- avoid pretending to know jurisdiction-specific law unless the user explicitly provides the jurisdiction
If the user asks for legal advice, give educational guidance and recommend consulting a qualified lawyer for case-specific decisions.
""".strip()

app = Flask(__name__, static_folder=".", static_url_path="")


@app.get("/api/health")
def health() -> tuple[dict, int]:
    ok = bool(OPENAI_API_KEY)
    return (
        {
            "ok": ok,
            "model": OPENAI_MODEL,
            "message": "Server is ready." if ok else "OPENAI_API_KEY is missing.",
        },
        200 if ok else 503,
    )


@app.post("/api/chat")
def chat() -> tuple[dict, int]:
    if not OPENAI_API_KEY:
        return {
            "error": "OPENAI_API_KEY is missing. Add it in your environment or .env file."
        }, 503

    payload = request.get_json(silent=True) or {}

    try:
        reply = generate_reply(payload)
        return {"reply": reply}, 200
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}, 500


@app.get("/")
def index() -> object:
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:filename>")
def static_files(filename: str) -> object:
    return send_from_directory(ROOT, filename)


def generate_reply(payload: dict) -> str:
    context_type = payload.get("contextType", "general")
    context_data = payload.get("contextData", {})
    messages = payload.get("messages", [])

    input_messages = [
        {
            "role": "system",
            "content": [{"type": "input_text", "text": ASSISTANT_SYSTEM_PROMPT}],
        },
        {
            "role": "system",
            "content": [
                {
                    "type": "input_text",
                    "text": build_context_message(context_type, context_data),
                }
            ],
        },
    ]

    for message in messages:
        role = "assistant" if message.get("role") == "assistant" else "user"
        content_type = "output_text" if role == "assistant" else "input_text"
        input_messages.append(
            {
                "role": role,
                "content": [{"type": content_type, "text": str(message.get("content", ""))}],
            }
        )

    request_body = json.dumps(
        {
            "model": OPENAI_MODEL,
            "input": input_messages,
        }
    ).encode("utf-8")

    openai_request = Request(
        "https://api.openai.com/v1/responses",
        method="POST",
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
    )

    try:
        with urlopen(openai_request, timeout=60) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(
            parse_openai_error(detail) or f"OpenAI request failed with status {exc.code}."
        ) from exc
    except URLError as exc:
        raise RuntimeError("Could not reach OpenAI. Check your internet connection.") from exc

    data = json.loads(raw)
    text = data.get("output_text")
    if not text:
        raise RuntimeError("The assistant returned an empty response.")

    return text.strip()


def build_context_message(context_type: str, context_data: dict) -> str:
    selected_context = context_data.get(context_type, {})
    structured = {
        "selectedContext": selected_context,
        "allContexts": context_data,
    }
    return "\n".join(
        [
            f"Current LAWGEN chat context: {context_type}.",
            "Use the following structured app data when it helps answer the user.",
            json.dumps(structured, indent=2),
        ]
    )


def parse_openai_error(detail: str) -> str | None:
    try:
        data = json.loads(detail)
    except json.JSONDecodeError:
        return None

    return data.get("error", {}).get("message")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    app.run(host="0.0.0.0", port=port, debug=False)
