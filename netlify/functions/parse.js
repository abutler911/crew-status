// Parses a pasted trip sheet into structured legs by calling Claude.
// POST /api/parse  body: { raw }  ->  { legs: [...] }
// Requires the admin code in the "x-access-code" header, so only you can spend
// the API budget. The Anthropic key stays server-side and never reaches a browser.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Only the admin code may parse.
  const c = norm(req.headers.get("x-access-code"));
  if (!c || c !== norm(process.env.ADMIN_CODE)) {
    return new Response("Forbidden", { status: 403 });
  }

  let raw;
  try {
    raw = (await req.json()).raw;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (!raw || !raw.trim()) {
    return Response.json({ legs: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("Server missing ANTHROPIC_API_KEY", { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You parse an airline pilot's trip sheet / pairing into flight legs.
Today is ${today}. Extract every flight leg in order.

Return ONLY a JSON array. No markdown, no backticks, no prose. Shape of each item:
{"date":"YYYY-MM-DD","flight":"DL 1234","from":"SLC","to":"LAX","fromCity":"Salt Lake City","toCity":"Los Angeles","depart":"HH:MM","arrive":"HH:MM"}

Rules:
- depart and arrive are 24-hour HH:MM, using the local times shown on the sheet.
- from and to are 3-letter IATA airport codes, uppercase.
- Fill fromCity and toCity with the city names for those airports.
- If only day/month is given, infer the year from today's date.
- Include deadhead legs. Prefix a flight with "DH " ONLY when the sheet
  explicitly marks that leg as a deadhead: a DH / DHD code on the leg's own
  line, the word "deadhead", or a positioning/repositioning note. Crew seat
  codes, equipment codes, and anything ambiguous are NOT deadhead markers —
  when in doubt, do not add the prefix.
- Skip hotel, van, and ground lines.
- If you find no flight legs, return [].

Trip sheet:
"""${raw}"""`;

  let res;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    return new Response("Upstream request failed: " + e.message, {
      status: 502,
    });
  }

  if (!res.ok) {
    const detail = await res.text();
    return new Response("Anthropic error " + res.status + ": " + detail, {
      status: 502,
    });
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/```json|```/g, "")
    .trim();

  let legs;
  try {
    legs = JSON.parse(text);
  } catch {
    legs = [];
  }
  if (!Array.isArray(legs)) legs = [];

  return Response.json({ legs });
};
