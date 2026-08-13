// Real calls to the Groq API (OpenAI-compatible chat completions format —
// notably different from Anthropic's Messages API, which used a different
// request/response shape entirely). Groq is used here because it's free/
// low-cost and fast, which matters for a student project where every
// explain/question/evaluate/reteach step is a separate LLM call.
//
// Check https://console.groq.com/docs/models for the current recommended
// model — Groq's hosted model lineup changes as providers deprecate and add
// models, faster than most API providers.
import { ZodSchema } from "zod";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

interface CallLLMParams {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

function requireApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set — add it to .env.local (get one free at https://console.groq.com/keys)");
  }
  return apiKey;
}

// Non-streaming call — used for the structured JSON steps (concept map,
// checkpoint questions, gap detection), where the caller needs the full
// response before it can validate and parse it.
export async function callLLM({
  system,
  user,
  temperature = 0.5,
  maxTokens = 2000,
  jsonMode = false,
}: CallLLMParams): Promise<string> {
  const apiKey = requireApiKey();

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // Groq (like OpenAI) can be told to guarantee valid JSON output for
      // supported models — meaningfully reduces the malformed-JSON retry
      // rate for the structured steps. The system prompt must still mention
      // "JSON" somewhere for this to be accepted by the API.
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in Groq response");

  // Models sometimes wrap JSON in ```json fences despite instructions not to —
  // strip them defensively before the caller attempts JSON.parse.
  return (content as string).replace(/```json\s*|```\s*$/g, "").trim();
}

// Wraps callLLM for the structured-JSON steps: parses the response,
// validates it against a Zod schema, and — if either step fails — retries
// ONCE with an explicit correction instruction before giving up. Malformed
// JSON is common enough as a one-shot fluke that a blind failure here would
// make the product feel flaky for something usually fixed by asking again.
export async function callLLMJSON<T>(params: CallLLMParams, schema: ZodSchema<T>): Promise<T> {
  const first = await attemptJSON(params, schema);
  if (first.success) return first.data;

  const retryParams: CallLLMParams = {
    ...params,
    user: `${params.user}\n\nIMPORTANT: Your previous response could not be parsed as valid JSON matching the required schema. Respond with ONLY the JSON object — no markdown fences, no commentary, no leading/trailing text.`,
  };
  const second = await attemptJSON(retryParams, schema);
  if (second.success) return second.data;

  throw new Error(`Model did not return valid JSON after retry: ${second.error}`);
}

async function attemptJSON<T>(
  params: CallLLMParams,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  let raw: string;
  try {
    raw = await callLLM({ ...params, jsonMode: true });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "LLM call failed" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: "Response was not valid JSON syntax" };
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return { success: false, error: validated.error.message };
  }
  return { success: true, data: validated.data };
}

// Streaming call — used for natural-language explanation/reteach steps.
// Returns a ReadableStream of plain UTF-8 text chunks, suitable for
// returning directly as a streamed Response body.
export async function callLLMStream({
  system,
  user,
  temperature = 0.6,
  maxTokens = 1500,
}: CallLLMParams): Promise<ReadableStream<Uint8Array>> {
  const apiKey = requireApiKey();

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload);
            // OpenAI-compatible streaming shape: choices[0].delta.content
            const text = event.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // Malformed/partial SSE chunk — safe to skip, next chunk continues the buffer.
          }
        }
      }
      controller.close();
    },
  });
}
