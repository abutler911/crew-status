// POST /api/auth  body: { code }  ->  { role: "admin" | "view" }  or 401
//
// The real codes live as environment variables on Netlify (and your local .env),
// never in the browser. Matching ignores case and spaces so phone keyboards
// don't cause false failures.

function norm(s) {
  return (s || "").replace(/\s+/g, "").toLowerCase();
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let code;
  try {
    code = (await req.json()).code;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const c = norm(code);
  if (c && c === norm(process.env.ADMIN_CODE)) {
    return Response.json({ role: "admin" });
  }
  if (c && c === norm(process.env.VIEW_CODE)) {
    return Response.json({ role: "view" });
  }
  return new Response("Invalid code", { status: 401 });
};
