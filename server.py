from __future__ import annotations

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "3000"))


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()

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


class LawgenHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._handle_health()
            return

        self._serve_static()

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            self._send_json(404, {"error": "Not found."})
            return

        if not OPENAI_API_KEY:
            self._send_json(
                503,
                {"error": "OPENAI_API_KEY is missing. Add it in your environment or .env file."},
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"
            payload = json.loads(raw or "{}")
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON request body."})
            return

        try:
            reply = generate_reply(payload)
        except Exception as exc:  # noqa: BLE001
            self._send_json(500, {"error": str(exc)})
            return

        self._send_json(200, {"reply": reply})

    def _handle_health(self) -> None:
        ok = bool(OPENAI_API_KEY)
        self._send_json(
            200 if ok else 503,
            {
                "ok": ok,
                "model": OPENAI_MODEL,
                "message": "Server is ready." if ok else "OPENAI_API_KEY is missing.",
            },
        )

    def _serve_static(self) -> None:
        relative = "index.html" if self.path in ("/", "") else self.path.lstrip("/")
        target = (ROOT / relative).resolve()

        if ROOT not in target.parents and target != ROOT:
            self._send_json(403, {"error": "Forbidden."})
            return

        if not target.exists() or not target.is_file():
            self._send_json(404, {"error": "Not found."})
            return

        content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


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

    request = Request(
        "https://api.openai.com/v1/responses",
        method="POST",
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
    )

    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(parse_openai_error(detail) or f"OpenAI request failed with status {exc.code}.") from exc
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
    server = ThreadingHTTPServer(("127.0.0.1", PORT), LawgenHandler)
    print(f"LAWGEN running at http://127.0.0.1:{PORT}")
    server.serve_forever()
