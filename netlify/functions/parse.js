// Parses a pasted trip sheet into structured legs by calling Claude.
// POST /api/parse  body: { raw: "...paste..." }  ->  { legs: [...] }
//
// The Anthropic API key is read from an environment variable that lives only on
// Netlify's servers (and your local .env). It is never sent to the browser.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let raw;
  try {
    const body = await req.json();
    raw = body.raw;
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
- Include deadhead legs, but prefix the flight with "DH ".
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
