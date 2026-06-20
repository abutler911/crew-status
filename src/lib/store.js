// Same three functions the UI already uses, with their insides swapped to talk
// to our serverless API instead of localStorage. Because the function names and
// shapes are identical, App.jsx does not change at all. This is the payoff of
// putting storage behind a seam back in step 1.

export async function getTrip() {
  try {
    const res = await fetch("/api/trip");
    if (!res.ok) return null;
    const data = await res.json();
    return data.trip || null;
  } catch {
    return null;
  }
}

export async function saveTrip(trip) {
  const res = await fetch("/api/trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trip }),
  });
  if (!res.ok) throw new Error("save failed (" + res.status + ")");
}

export async function clearTrip() {
  await fetch("/api/trip", { method: "DELETE" });
}
