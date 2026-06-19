// The whole app talks to storage only through these three functions.
// Right now they read and write your browser's localStorage, which is perfect
// for local development. In step 4 we replace the insides of these functions
// with calls to Netlify (a real shared datastore), and App.jsx never changes.

const STORE_KEY = 'current-trip';

export async function getTrip() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveTrip(trip) {
  localStorage.setItem(STORE_KEY, JSON.stringify(trip));
}

export async function clearTrip() {
  localStorage.removeItem(STORE_KEY);
}
