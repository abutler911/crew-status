# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Logins

The two access codes identify people, not permission levels: Babe-a's code
(`ADMIN_CODE`) opens his own personalized board plus the flight-deck screen for
publishing trips; Beth's code (`VIEW_CODE`) opens her board. Each board greets
its own person, shows the other person's latest note, and has a composer to
send a note back. Notes live in the shared `personal` record (Netlify Blobs) so
they survive a trip being cleared or republished.

## Push notifications

The app can push a notification to subscribed devices when a leg **departs**,
**lands**, or **falls behind schedule**, and when the other person leaves or
updates a **note**. Note pushes go only to the other person's devices —
subscriptions are tagged with who was signed in when the device subscribed.
Either person can opt in or out per device via the toggle in the footer.

### How it works

- `public/sw.js` — a service worker that receives the push and shows it.
- `netlify/functions/push.js` — stores/removes a device's push subscription
  (in Netlify Blobs) and serves the VAPID public key to the browser.
- `netlify/functions/notify.js` — a **scheduled function** (every 5 minutes)
  that polls AeroAPI for the current trip's near-term legs, diffs against the
  last-seen state, and fans a push out to every subscribed device on a real
  change. It exits immediately if push isn't configured or nobody is
  subscribed, so it costs nothing when idle.

### Required environment variables (Netlify)

Generate a VAPID key pair once:

```bash
npx web-push generate-vapid-keys
```

Then set these in the Netlify site (Site settings → Environment variables):

| Variable             | Value                                                         |
| -------------------- | ------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`   | the generated public key                                      |
| `VAPID_PRIVATE_KEY`  | the generated private key                                     |
| `VAPID_SUBJECT`      | a contact URL, e.g. `mailto:you@example.com`                  |
| `AEROAPI_KEY`        | FlightAware AeroAPI key (already used for live status)        |

If the VAPID variables are missing the notification toggle simply stays hidden
and the scheduler no-ops — the rest of the app is unaffected.

### iOS note

On iOS, web push only works when the app is **installed to the Home Screen**
(Add to Home Screen) and opened from there, on iOS 16.4 or later. In a regular
Safari tab the toggle won't appear.
