// Groq-powered fact checker (key hardcoded per user request)
const GROQ_API_KEY = "my api key";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";

export const getApiKey = () => GROQ_API_KEY;
export const setApiKey = (_: string) => {};

function stripFences(t: string): string {
  return t.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
}

function extractJson<T>(raw: string): T {
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Failed to parse model JSON");
  }
}

async function chat(prompt: string, system?: string): Promise<string> {
  const messages: { role: string; content: string }[] = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.2 }),
  });
  if (!res.ok) {
    const err = await res.text();
    let friendly = `Groq error ${res.status}`;
    if (res.status === 429) friendly = "Rate limit hit — wait a moment and try again.";
    else if (res.status === 401) friendly = "Groq API key rejected.";
    throw new Error(`${friendly} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export interface Claim {
  id: number;
  claim: string;
  category: string;
}

export interface Verdict {
  verdict: "Verified" | "Inaccurate" | "False";
  explanation: string;
  source: string;
}

export async function extractClaims(pdfText: string): Promise<Claim[]> {
  const trimmed = pdfText.slice(0, 24000);
  const text = await chat(
    "Extract up to 15 distinct, verifiable factual claims (statistics, dates, named events, attributions) from the text below. " +
      'Return ONLY a JSON array. Each item: {"id": number, "claim": string, "category": string}. No markdown.\n\nTEXT:\n' +
      trimmed,
    "You are a precise information extraction engine. Always return valid JSON only.",
  );
  const arr = extractJson<Claim[]>(text);
  return arr
    .filter((c) => c && c.claim)
    .map((c, i) => ({ id: c.id ?? i + 1, claim: c.claim, category: c.category || "General" }));
}

export async function verifyClaim(claim: string): Promise<Verdict> {
  const text = await chat(
    `Fact-check this claim: "${claim}"\n\nReturn ONLY JSON: {"verdict": "Verified" | "Inaccurate" | "False", "explanation": "1-2 sentence reasoning", "source": "best URL reference or empty string"}.`,
    "You are a careful fact-checker. Use your knowledge. Output JSON only.",
  );
  let parsed: Verdict;
  try {
    parsed = extractJson<Verdict>(text);
  } catch {
    parsed = { verdict: "Inaccurate", explanation: text.slice(0, 400), source: "" };
  }
  const allowed = ["Verified", "Inaccurate", "False"] as const;
  if (!allowed.includes(parsed.verdict)) parsed.verdict = "Inaccurate";
  return parsed;
}
