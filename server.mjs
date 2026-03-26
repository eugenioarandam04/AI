import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

const assistantSystemPrompt = `
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
`;

createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendJson(res, 400, { error: "Invalid request." });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      const ready = Boolean(OPENAI_API_KEY);
      sendJson(res, ready ? 200 : 503, {
        ok: ready,
        model: MODEL,
        message: ready ? "Server is ready." : "OPENAI_API_KEY is missing.",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      if (!OPENAI_API_KEY) {
        sendJson(res, 503, {
          error: "OPENAI_API_KEY is missing. Add it to your environment before starting the server.",
        });
        return;
      }

      const body = await readJsonBody(req);
      const reply = await generateReply(body);
      sendJson(res, 200, { reply });
      return;
    }

    if (req.method === "GET") {
      await serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    sendJson(res, 500, { error: message });
  }
}).listen(PORT, () => {
  console.log(`LAWGEN running at http://localhost:${PORT}`);
});

async function generateReply(body) {
  const contextType = body?.contextType || "general";
  const contextData = body?.contextData || {};
  const messages = Array.isArray(body?.messages) ? body.messages : [];

  const contextMessage = buildContextMessage(contextType, contextData);

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: assistantSystemPrompt.trim() }],
        },
        {
          role: "system",
          content: [{ type: "input_text", text: contextMessage }],
        },
        ...messages.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: [{ type: "input_text", text: String(message.content || "") }],
        })),
      ],
    }),
  });

  const payload = await apiResponse.json();

  if (!apiResponse.ok) {
    const errorMessage = payload?.error?.message || "OpenAI request failed.";
    throw new Error(errorMessage);
  }

  const text = payload.output_text;
  if (!text) {
    throw new Error("The assistant returned an empty response.");
  }

  return text.trim();
}

function buildContextMessage(contextType, contextData) {
  const selectedContext = contextData?.[contextType] ?? {};

  return [
    `Current LAWGEN chat context: ${contextType}.`,
    "Use the following structured app data when it helps answer the user.",
    JSON.stringify(
      {
        selectedContext,
        allContexts: contextData,
      },
      null,
      2
    ),
  ].join("\n");
}

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = normalize(join(ROOT, safePath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  try {
    const contents = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(contents);
  } catch {
    sendJson(res, 404, { error: "Not found." });
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });

    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });

    req.on("error", () => {
      reject(new Error("Failed to read request body."));
    });
  });
}
