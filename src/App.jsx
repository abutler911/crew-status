import React, { useState, useEffect, useMemo } from "react";
import * as store from "./lib/store.js";

// The access codes no longer live here. They are environment variables on the
// server, and the gate checks them through /api/auth. Nothing secret ships to
// the browser anymore.

const css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

.cs-root {
  --ink: #f4f1ec;
  --surface: #ffffff;
  --surface-2: #f7f5f1;
  --line: rgba(20,18,16,0.16);
  --text: #1b1a18;
  --muted: #524c45;
  --faint: #6e675f;
  --crimson: #be2639;
  --crimson-dim: rgba(190,38,57,0.10);
  min-height: 100vh;
  background: var(--ink);
  color: var(--text);
  font-family: 'Cormorant Garamond', Georgia, serif;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px 64px;
  overflow-x: hidden;
}

.mono { font-family: 'JetBrains Mono', monospace; }

.cs-shell { width: 100%; max-width: 560px; }
.cs-field .cs-btn { flex-shrink: 0; white-space: nowrap; }

.cs-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--crimson);
  margin-bottom: 18px;
}

/* ---- gate ---- */
.cs-gate { margin-top: 14vh; }
.cs-gate .cs-eyebrow { display: flex; align-items: center; gap: 12px; }
.cs-gate .cs-eyebrow::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}
.cs-gate h1 {
  font-size: 58px;
  font-weight: 500;
  line-height: 1.02;
  letter-spacing: -0.015em;
  margin-bottom: 14px;
}
.cs-gate h1 em {
  font-style: italic;
  font-weight: 500;
  color: var(--crimson);
}
.cs-gate p { color: var(--muted); font-size: 21px; margin-bottom: 32px; }
.cs-field { display: flex; gap: 10px; }
.cs-input {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  letter-spacing: 0.15em;
  padding: 15px 16px;
  outline: none;
  transition: border-color 0.18s ease;
}
.cs-input:focus { border-color: var(--crimson); }
.cs-input::placeholder { color: var(--faint); letter-spacing: 0.15em; }

.cs-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  background: var(--crimson);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0 20px;
  cursor: pointer;
  transition: filter 0.18s ease, transform 0.05s ease;
}
.cs-btn:hover { filter: brightness(1.12); }
.cs-btn:active { transform: translateY(1px); }
.cs-btn.ghost {
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--line);
}
.cs-btn.ghost:hover { color: var(--text); border-color: var(--muted); filter: none; }
.cs-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.cs-err {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--crimson);
  margin-top: 14px;
  letter-spacing: 0.04em;
}

/* ---- status header ---- */
.cs-status { margin-bottom: 4px; }
.cs-status .word {
  font-size: 60px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.015em;
}
.cs-status .sub {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 22px;
  line-height: 1.35;
  letter-spacing: 0;
  color: var(--text);
  margin-top: 12px;
}
.cs-rule { height: 1px; background: var(--line); margin: 30px 0; }

/* ---- legs ---- */
.cs-leg {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(20,18,16,0.05);
  padding: 22px 24px;
  margin-bottom: 14px;
  position: relative;
  opacity: 0;
  transform: translateY(10px);
  animation: rise 0.5s cubic-bezier(0.2,0.7,0.2,1) forwards;
}
@keyframes rise { to { opacity: 1; transform: none; } }
.cs-leg.active {
  border: 2px solid var(--crimson);
  background: #fff1f3;
  box-shadow: 0 0 0 4px rgba(190,38,57,0.12), 0 4px 14px rgba(190,38,57,0.18);
}
.cs-leg.done { opacity: 0.66; }
.cs-leg.done.flown { animation: none; opacity: 0.66; transform: none; }

.cs-legtop {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 16px;
}
.cs-flight { color: var(--text); font-weight: 500; }
a.cs-flight {
  text-decoration: none;
  border-bottom: 2px solid rgba(190,38,57,0.5);
  padding-bottom: 1px;
  transition: color 0.15s ease, border-color 0.15s ease;
}
a.cs-flight:hover, a.cs-flight:active { color: var(--crimson); border-bottom-color: var(--crimson); }
.cs-tag {
  color: var(--crimson);
  letter-spacing: 0.14em;
  font-weight: 700;
}
.cs-livedot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--crimson);
  margin-right: 7px;
  vertical-align: middle;
  animation: livepulse 1.4s ease-in-out infinite;
}
@keyframes livepulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.65); }
}

.cs-route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px; }
.cs-port { }
.cs-port.to { text-align: right; }
.cs-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
}
.cs-city {
  font-size: 15px;
  color: var(--muted);
  margin-top: 5px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cs-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  margin-top: 10px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cs-tzhint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--faint);
  margin-top: 3px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.cs-arrow { color: var(--faint); display: flex; align-items: center; justify-content: center; }
.cs-arrow svg { display: block; }
.cs-day {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--crimson);
  letter-spacing: 0.1em;
  margin-top: 6px;
}

.cs-foot {
  margin-top: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  letter-spacing: 0.06em;
  color: var(--faint);
}
.cs-link { color: var(--faint); cursor: pointer; text-decoration: none; }
.cs-link:hover { color: var(--muted); }

/* ---- admin ---- */
.cs-admin h2 { font-size: 34px; font-weight: 500; margin-bottom: 4px; }
.cs-admin .hint { color: var(--muted); font-size: 17px; margin-bottom: 26px; }
.cs-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}
.cs-grid.b { grid-template-columns: 1fr 1fr; }
.cs-lab {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
  margin: 0 0 6px 2px;
  display: block;
}
.cs-in {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  padding: 12px 13px;
  outline: none;
}
.cs-in:focus { border-color: var(--crimson); }
.cs-in::placeholder { color: var(--faint); }

.cs-pending {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 13px 16px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.04em;
  background: var(--surface);
}
.cs-x { color: var(--faint); cursor: pointer; font-size: 16px; padding-left: 12px; }
.cs-x:hover { color: var(--crimson); }

.cs-actions { display: flex; gap: 10px; margin-top: 22px; }
.cs-actions .cs-btn { padding: 13px 22px; }

.cs-saved {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #1f7a44;
  letter-spacing: 0.03em;
  margin-top: 16px;
  line-height: 1.5;
}

.cs-area {
  width: 100%;
  min-height: 160px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  line-height: 1.6;
  padding: 14px 16px;
  outline: none;
  resize: vertical;
}
.cs-area:focus { border-color: var(--crimson); }
.cs-area::placeholder { color: var(--faint); }

.cs-spin {
  display: inline-block;
  width: 11px; height: 11px;
  border: 1.5px solid rgba(255,255,255,0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 8px;
  vertical-align: -1px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.cs-or {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--faint);
  text-align: center;
  margin: 20px 0 4px;
}
.cs-manual-link {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.cs-manual-link:hover { color: var(--text); }

/* ---- date groups on the board ---- */
.cs-daygroup { margin-bottom: 30px; }
.cs-daygroup:last-of-type { margin-bottom: 0; }
.cs-dayhead {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 0 0 14px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.cs-dayhead .cs-daydate { color: var(--muted); font-size: 22px; font-weight: 500; }

/* relative-day chip in the header */
.cs-dayhead .cs-chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--crimson);
  color: #fff;
  align-self: center;
}
.cs-dayhead .cs-chip.soft { background: transparent; color: var(--crimson); border: 1.5px solid var(--crimson); padding: 3px 9px; }
.cs-dayhead .cs-chip.past { background: transparent; color: var(--faint); border: 1.5px solid var(--line); padding: 3px 9px; }

/* the whole "today" section is highlighted so it's obvious at a glance */
.cs-daygroup.today {
  background: rgba(190,38,57,0.06);
  border: 1.5px solid rgba(190,38,57,0.28);
  border-radius: 14px;
  padding: 18px 16px 6px;
}
.cs-daygroup.today .cs-dayhead { color: var(--crimson); border-bottom-color: rgba(190,38,57,0.3); }
.cs-daygroup.today .cs-dayhead .cs-daydate { color: var(--crimson); opacity: 0.85; }

@media (prefers-reduced-motion: reduce) {
  .cs-leg { animation: none !important; opacity: 1; transform: none; }
  .cs-livedot { animation: none !important; }
}
@media (max-width: 480px) {
  .cs-gate h1 { font-size: 42px; }
  .cs-gate { margin-top: 10vh; }
  .cs-status .word { font-size: 44px; }
  .cs-dayhead { font-size: 25px; }
  .cs-dayhead .cs-daydate { font-size: 20px; }
  .cs-grid, .cs-grid.b { grid-template-columns: 1fr 1fr; }
}
`;

// ---- helpers ----------------------------------------------------------------

function legDates(leg) {
  // returns {dep, arr} Date objects; arr rolls to next day if earlier than dep
  const dep = new Date(`${leg.date}T${leg.depart}:00`);
  let arr = new Date(`${leg.date}T${leg.arrive}:00`);
  if (arr < dep) arr = new Date(arr.getTime() + 24 * 3600 * 1000);
  return { dep, arr, nextDay: arr.getDate() !== dep.getDate() };
}

function fmtDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// MM/DD/YYYY from a Date or a "YYYY-MM-DD" string.
function fmtMDY(input) {
  const d = input instanceof Date ? input : new Date(input + "T00:00:00");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// Weekday and date for the big group header, e.g. { dow: "Saturday", md: "06/21/2026" }.
function fmtDayHead(d) {
  return {
    dow: d.toLocaleDateString(undefined, { weekday: "long" }),
    md: fmtMDY(d),
  };
}

// "09:15" -> "9:15 AM". Friendlier to read than 24-hour.
function fmtTime(hhmm) {
  if (!hhmm || hhmm.indexOf(":") < 0) return hhmm || "";
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr.padStart(2, "0");
  const ap = h < 12 ? "AM" : "PM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ap}`;
}

const UTAH_TZ = "America/Denver";

// IATA airport code -> IANA timezone, for the airports Andy's trips actually
// touch. Used to show departure times in Utah time alongside local time.
const AIRPORT_TZ = {
  // Mountain
  SLC: UTAH_TZ, DEN: UTAH_TZ, ABQ: UTAH_TZ, COS: UTAH_TZ, BOI: UTAH_TZ,
  GJT: UTAH_TZ, BZN: UTAH_TZ, JAC: UTAH_TZ,
  PHX: "America/Phoenix", TUS: "America/Phoenix",
  // Pacific
  LAX: "America/Los_Angeles", SFO: "America/Los_Angeles", SAN: "America/Los_Angeles",
  SJC: "America/Los_Angeles", OAK: "America/Los_Angeles", SMF: "America/Los_Angeles",
  SNA: "America/Los_Angeles", BUR: "America/Los_Angeles", ONT: "America/Los_Angeles",
  PDX: "America/Los_Angeles", SEA: "America/Los_Angeles", GEG: "America/Los_Angeles",
  RNO: "America/Los_Angeles", LAS: "America/Los_Angeles", FAT: "America/Los_Angeles",
  // Alaska / Hawaii
  ANC: "America/Anchorage", FAI: "America/Anchorage", JNU: "America/Anchorage",
  HNL: "Pacific/Honolulu", OGG: "Pacific/Honolulu", KOA: "Pacific/Honolulu",
  // Central
  ORD: "America/Chicago", MDW: "America/Chicago", DFW: "America/Chicago",
  IAH: "America/Chicago", HOU: "America/Chicago", MSY: "America/Chicago",
  MSP: "America/Chicago", STL: "America/Chicago", MCI: "America/Chicago",
  OMA: "America/Chicago", OKC: "America/Chicago", TUL: "America/Chicago",
  MEM: "America/Chicago", BNA: "America/Chicago", AUS: "America/Chicago",
  SAT: "America/Chicago", ICT: "America/Chicago", DSM: "America/Chicago",
  MKE: "America/Chicago", FAR: "America/Chicago", LIT: "America/Chicago",
  // Eastern
  ATL: "America/New_York", BOS: "America/New_York", JFK: "America/New_York",
  LGA: "America/New_York", EWR: "America/New_York", DCA: "America/New_York",
  IAD: "America/New_York", BWI: "America/New_York", PHL: "America/New_York",
  CLT: "America/New_York", RDU: "America/New_York", MCO: "America/New_York",
  MIA: "America/New_York", FLL: "America/New_York", TPA: "America/New_York",
  PBI: "America/New_York", JAX: "America/New_York", RSW: "America/New_York",
  PIT: "America/New_York", CLE: "America/New_York", CMH: "America/New_York",
  CVG: "America/New_York", IND: "America/New_York", DTW: "America/New_York",
  BUF: "America/New_York", ROC: "America/New_York", SYR: "America/New_York",
  BDL: "America/New_York", PVD: "America/New_York", ALB: "America/New_York",
  ORF: "America/New_York", RIC: "America/New_York", SAV: "America/New_York",
  CHS: "America/New_York", GSP: "America/New_York", GSO: "America/New_York",
  // International (common destinations)
  YYZ: "America/Toronto", YVR: "America/Vancouver", YUL: "America/Toronto",
  CUN: "America/Cancun", MEX: "America/Mexico_City",
  LHR: "Europe/London", CDG: "Europe/Paris", AMS: "Europe/Amsterdam",
  FRA: "Europe/Berlin", FCO: "Europe/Rome", MAD: "Europe/Madrid",
  NRT: "Asia/Tokyo", HND: "Asia/Tokyo", ICN: "Asia/Seoul", PVG: "Asia/Shanghai",
};

// Converts a "YYYY-MM-DD" + "HH:MM" wall-clock time in `fromTz` to the
// equivalent wall-clock time in `toTz`. Returns null if the input or the
// resulting day shift can't be computed.
function convertZonedTime(dateStr, hhmm, fromTz, toTz) {
  if (!dateStr || !hhmm || !fromTz) return null;
  // Treat the wall time as if it were UTC, then measure how far `fromTz`
  // sits from UTC at that instant and shift back to find the real instant.
  const asIfUtc = new Date(`${dateStr}T${hhmm}:00Z`);
  const inTz = new Date(asIfUtc.toLocaleString("en-US", { timeZone: fromTz }));
  const inUtc = new Date(asIfUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const instant = new Date(asIfUtc.getTime() - (inTz.getTime() - inUtc.getTime()));

  const time = instant.toLocaleTimeString("en-US", {
    timeZone: toTz,
    hour: "numeric",
    minute: "2-digit",
  });
  const origDay = dateStr;
  const newDay = instant.toLocaleDateString("en-CA", { timeZone: toTz });
  let dayShift = 0;
  if (newDay > origDay) dayShift = 1;
  else if (newDay < origDay) dayShift = -1;
  return { time, dayShift };
}

// Departure time of a leg, converted to Utah time, or null if the same zone
// (nothing useful to show) or the airport isn't in our table.
function utahDepartTime(leg) {
  const fromTz = AIRPORT_TZ[leg.from];
  if (!fromTz || fromTz === UTAH_TZ) return null;
  return convertZonedTime(leg.date, leg.depart, fromTz, UTAH_TZ);
}

// Returns "Today" / "Tomorrow" / "Yesterday" for a YYYY-MM-DD date, else null.
function dayLabel(dateStr, now) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return null;
}

// The airport Andy actually lives at. Landing anywhere else doesn't count
// as "back home," no matter how much time has passed since.
const HOME_AIRPORT = "SLC";

// Milliseconds -> "1 hour 15 minutes" / "40 minutes" / "2 hours", for the
// "next flight in ..." countdown.
function humanizeDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0 && m === 0) return "a few minutes";
  if (h === 0) return `${m} minute${m === 1 ? "" : "s"}`;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
}

// A casual day word for sentences: "today" / "tomorrow" / "Saturday".
function whenWord(dateStr, now) {
  const lbl = dayLabel(dateStr, now);
  if (lbl) return lbl.toLowerCase();
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
  });
}

// Plain-language answer to "where is Andy right now?" plus a big status word.
function liveSummary(s, now) {
  if (s.state === "home") {
    return { word: "Home", line: "Andy is home right now." };
  }
  const sorted = s.sorted;

  // In the air on a specific leg?
  for (const leg of sorted) {
    const { dep, arr } = legDates(leg);
    if (now >= dep && now <= arr) {
      const from = leg.fromCity || leg.from;
      const to = leg.toCity || leg.to;
      return {
        word: "In the air",
        line: `Andy is flying from ${from} to ${to}, landing ${fmtTime(leg.arrive)}.`,
      };
    }
  }

  const upcoming = sorted.filter((l) => legDates(l).dep > now);
  const past = sorted.filter((l) => legDates(l).arr <= now);
  const next = upcoming[0];

  if (past.length === 0) {
    return {
      word: "Trip ahead",
      line: `Andy leaves ${whenWord(next.date, now)} at ${fmtTime(next.depart)}.`,
    };
  }

  const lastLanded = past[past.length - 1];
  const place = lastLanded.toCity || lastLanded.to;

  // Landed at home with nothing else on the books: the trip is actually over.
  if (!next && lastLanded.to === HOME_AIRPORT) {
    return { word: "Back home", line: "Andy is back home now." };
  }

  // No more legs in hand yet. He's not home, so it's an overnight, not "back home."
  if (!next) {
    return {
      word: "Overnight",
      line: `Andy is in ${place} on the overnight.`,
    };
  }

  // Flying again later today: give a countdown instead of a day label.
  if (dayLabel(next.date, now) === "Today") {
    return {
      word: "On the ground",
      line: `Andy is in ${place} right now. Next flight in ${humanizeDuration(legDates(next).dep - now)}.`,
    };
  }

  // Last leg of the day is down; the next one isn't until a later day.
  return {
    word: "Overnight",
    line: `Andy is in ${place} on the overnight. Next flight ${whenWord(next.date, now)} at ${fmtTime(next.depart)}.`,
  };
}

// FlightAware identifies flights by ICAO airline code (Delta is DAL, not DL),
// so we translate the airline prefix before building the link. Covers Delta,
// the Delta Connection regionals, the major US carriers, and a few partners;
// anything unlisted falls back to the code as written.
const IATA_TO_ICAO = {
  DL: "DAL",
  AA: "AAL",
  UA: "UAL",
  WN: "SWA",
  AS: "ASA",
  B6: "JBU",
  F9: "FFT",
  NK: "NKS",
  HA: "HAL",
  G4: "AAY",
  SY: "SCX",
  // Delta Connection / regional operators
  OO: "SKW",
  "9E": "EDV",
  YX: "RPA",
  MQ: "ENY",
  OH: "JIA",
  YV: "ASH",
  G7: "GJS",
  QX: "QXE",
  ZW: "AWI",
  PT: "PDT",
  CP: "CPZ",
  // common partners / international
  AF: "AFR",
  KL: "KLM",
  LH: "DLH",
  BA: "BAW",
  VS: "VIR",
  AM: "AMX",
  AC: "ACA",
  WS: "WJA",
  KE: "KAL",
  VA: "VOZ",
};

// Builds a FlightAware link from a flight number. Strips a deadhead "DH" marker
// and any spaces, then converts the airline code to ICAO (DL2014 -> DAL2014).
function flightAwareUrl(flight) {
  const raw = (flight || "")
    .replace(/^DH\s*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
  let ident = raw;
  const m = raw.match(/^([A-Z0-9]*?)(\d+)$/);
  if (m) {
    const code = m[1];
    const num = m[2];
    ident = (IATA_TO_ICAO[code] || code) + num;
  }
  return "https://www.flightaware.com/live/flight/" + encodeURIComponent(ident);
}

// The instant a trip should delete itself: start of the second calendar day
// after the last leg lands. So it stays visible through the day after the trip
// ends, then clears.
function removeAt(trip) {
  if (!trip || !trip.legs || trip.legs.length === 0) return null;
  const last = trip.legs.reduce(
    (m, l) => Math.max(m, legDates(l).arr.getTime()),
    0,
  );
  const d = new Date(last);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  return d;
}

function tripStatus(trip, now) {
  if (!trip || !trip.legs || trip.legs.length === 0) return { state: "home" };
  const sorted = [...trip.legs].sort(
    (a, b) => legDates(a).dep - legDates(b).dep,
  );
  const first = legDates(sorted[0]).dep;
  const last = legDates(sorted[sorted.length - 1]).arr;
  const gone = removeAt(trip);
  if (now >= gone) return { state: "home", expired: true, sorted, first, last };
  if (now < first) return { state: "upcoming", sorted, first, last };
  if (now > last) return { state: "complete", sorted, first, last }; // landed, day-after grace
  return { state: "active", sorted, first, last };
}

// Reads a pasted trip sheet of any format into structured legs via Claude.
async function parseTripSheet(raw) {
  // store.parse sends the paste (with your admin code) to our serverless
  // function, which calls Claude server-side and returns clean legs.
  const legs = await store.parse(raw);
  if (!Array.isArray(legs)) throw new Error("bad shape");
  return legs.map((l) => ({
    date: l.date || "",
    flight: l.flight || "",
    from: (l.from || "").toUpperCase(),
    to: (l.to || "").toUpperCase(),
    fromCity: l.fromCity || "",
    toCity: l.toCity || "",
    depart: l.depart || "",
    arrive: l.arrive || "",
  }));
}

// Builds the textarea example using dates a few days out, so a test publish
// lands on the board instead of immediately auto-hiding as past.
function examplePlaceholder() {
  const MON = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const d = (offset) => {
    const x = new Date();
    x.setDate(x.getDate() + offset);
    return String(x.getDate()).padStart(2, "0") + MON[x.getMonth()];
  };
  return (
    "Paste here. However it's formatted is fine. For example:\n\n" +
    `DL2014  ${d(2)}  SLC-LAX  0915-1042\n` +
    `DL1885  ${d(2)}  LAX-SEA  1210-1455\n` +
    `DL 944  ${d(3)}  SEA-SLC  0730-1018`
  );
}

// ---- app-------------------------------------------------------------------

export default function App() {
  const [screen, setScreen] = useState("loading"); // loading | gate | viewer | admin
  const [trip, setTrip] = useState(null);
  const [now, setNow] = useState(new Date());

  // tick so status updates live
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Deletes the stored trip if it's past its remove-at instant. Returns the
  // trip to keep, or null if it was expired and cleared.
  const expireIfDue = async (t) => {
    const gone = removeAt(t);
    if (t && gone && new Date() >= gone) {
      try {
        await store.clearTrip();
      } catch {}
      return null;
    }
    return t;
  };

  const loadTrip = async () => {
    try {
      const t = await store.getTrip();
      setTrip(await expireIfDue(t));
    } catch {
      setTrip(null);
    }
  };

  // While the app is open, clear the trip the moment it expires.
  useEffect(() => {
    if (!trip) return;
    const gone = removeAt(trip);
    if (gone && now >= gone) {
      (async () => {
        try {
          await store.clearTrip();
        } catch {}
        setTrip(null);
      })();
    }
  }, [now, trip]);

  useEffect(() => {
    (async () => {
      const role = await store.resume();
      if (role === "view") {
        await loadTrip();
        setScreen("viewer");
      } else if (role === "admin") {
        await loadTrip();
        setScreen("admin");
      } else {
        setScreen("gate");
      }
    })();
  }, []);

  if (screen === "loading") {
    return (
      <div className="cs-root">
        <style>{css}</style>
        <div
          className="cs-shell mono"
          style={{
            marginTop: "20vh",
            color: "#5f5a56",
            letterSpacing: "0.2em",
            fontSize: 12,
          }}
        >
          LOADING
        </div>
      </div>
    );
  }

  return (
    <div className="cs-root">
      <style>{css}</style>
      <div className="cs-shell">
        {screen === "gate" && (
          <Gate
            resolve={async (v) => {
              const role = await store.authenticate(v.trim());
              if (role === "view") {
                await loadTrip();
                setScreen("viewer");
                return true;
              }
              if (role === "admin") {
                await loadTrip();
                setScreen("admin");
                return true;
              }
              return false;
            }}
          />
        )}

        {screen === "viewer" && (
          <Viewer
            trip={trip}
            now={now}
            onLock={() => {
              store.signOut();
              setScreen("gate");
            }}
          />
        )}

        {screen === "admin" && (
          <Admin
            trip={trip}
            onPublish={async (t) => {
              setTrip(t);
              await loadTrip();
            }}
            onExit={() => {
              store.signOut();
              setScreen("gate");
            }}
          />
        )}
      </div>
    </div>
  );
}

function Gate({ resolve }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const [checking, setChecking] = useState(false);
  const submit = async () => {
    if (checking || !val.trim()) return;
    setChecking(true);
    setErr(false);
    const ok = await resolve(val);
    if (!ok) {
      setErr(true);
      setChecking(false);
    }
    // on success the screen changes, so no need to reset checking
  };
  return (
    <div className="cs-gate">
      <div className="cs-eyebrow">Private access</div>
      <h1>
        Where's <em>Andy</em>?
      </h1>
      <p>Enter your access code to see his status.</p>
      <div className="cs-field">
        <input
          className="cs-input"
          type="password"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder="ACCESS CODE"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setErr(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
        />
        <button className="cs-btn" onClick={submit} disabled={checking}>
          {checking ? "Checking" : "Enter"}
        </button>
      </div>
      {err && <div className="cs-err">Code not recognized. Try again.</div>}
    </div>
  );
}

function Viewer({ trip, now, onLock }) {
  const s = useMemo(() => tripStatus(trip, now), [trip, now]);

  if (s.state === "home") {
    return (
      <div>
        <div className="cs-eyebrow">CREW STATUS</div>
        <div className="cs-status">
          <div className="word">Home</div>
          <div className="sub">
            Andy is home right now. This updates when his next trip is posted.
          </div>
        </div>
        <div className="cs-rule" />
        <div className="cs-foot">
          <span>SLC · ANDY</span>
          <span className="cs-link" onClick={onLock}>
            Lock
          </span>
        </div>
      </div>
    );
  }

  const summary = liveSummary(s, now);

  return (
    <div>
      <div className="cs-eyebrow">CREW STATUS</div>
      <div className="cs-status">
        <div className="word">{summary.word}</div>
        <div className="sub">{summary.line}</div>
      </div>
      <div className="cs-rule" />

      {(() => {
        // Group the sorted legs by their departure date.
        const groups = [];
        s.sorted.forEach((leg) => {
          let g = groups.find((x) => x.date === leg.date);
          if (!g) {
            g = { date: leg.date, legs: [] };
            groups.push(g);
          }
          g.legs.push(leg);
        });
        let order = 0;
        return groups.map((g, gi) => {
          const head = fmtDayHead(legDates(g.legs[0]).dep);
          const rel = dayLabel(g.date, now);
          const isToday = rel === "Today";
          const chipClass = isToday
            ? "cs-chip"
            : rel === "Tomorrow"
              ? "cs-chip soft"
              : "cs-chip past";
          return (
            <div
              className={`cs-daygroup ${isToday ? "today" : ""}`}
              key={g.date || gi}
            >
              <div className="cs-dayhead">
                {rel ? <span className={chipClass}>{rel}</span> : null}
                <span>{head.dow}</span>
                <span className="cs-daydate">{head.md}</span>
              </div>
              {g.legs.map((leg, li) => {
                const { dep, arr, nextDay } = legDates(leg);
                const isActive =
                  s.state === "active" && now >= dep && now <= arr;
                const isDone = now > arr;
                const i = order++;
                return (
                  <div
                    key={`${gi}-${li}`}
                    className={`cs-leg ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    <div className="cs-legtop">
                      <a
                        className="cs-flight"
                        href={flightAwareUrl(leg.flight)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {leg.flight}
                      </a>
                      <span className="cs-tag">
                        {isActive ? <span className="cs-livedot" /> : null}
                        {isActive
                          ? "IN AIR NOW"
                          : isDone
                            ? "LANDED"
                            : "SCHEDULED"}
                      </span>
                    </div>
                    <div className="cs-route">
                      <div className="cs-port">
                        <div className="cs-code">{leg.from}</div>
                        {leg.fromCity ? (
                          <div className="cs-city">{leg.fromCity}</div>
                        ) : null}
                        <div className="cs-time">{fmtTime(leg.depart)}</div>
                        {(() => {
                          const utah = utahDepartTime(leg);
                          if (!utah) return null;
                          return (
                            <div className="cs-tzhint">
                              {utah.time} MT
                              {utah.dayShift > 0 ? " (+1 day)" : ""}
                              {utah.dayShift < 0 ? " (-1 day)" : ""}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="cs-arrow">
                        <svg
                          width="34"
                          height="14"
                          viewBox="0 0 34 14"
                          fill="none"
                        >
                          <path
                            d="M0 7h28"
                            stroke="currentColor"
                            strokeWidth="1"
                          />
                          <path
                            d="M24 2l6 5-6 5"
                            stroke="currentColor"
                            strokeWidth="1"
                            fill="none"
                          />
                        </svg>
                      </div>
                      <div className="cs-port to">
                        <div className="cs-code">{leg.to}</div>
                        {leg.toCity ? (
                          <div className="cs-city">{leg.toCity}</div>
                        ) : null}
                        <div className="cs-time">
                          {fmtTime(leg.arrive)}
                          {nextDay ? " (next day)" : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        });
      })()}

      <div className="cs-foot">
        <span>SLC · ANDY</span>
        <span className="cs-link" onClick={onLock}>
          Lock
        </span>
      </div>
    </div>
  );
}

function Admin({ trip, onPublish, onExit }) {
  const [raw, setRaw] = useState("");
  const [legs, setLegs] = useState(trip?.legs ? [...trip.legs] : []);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [draft, setDraft] = useState({
    date: "",
    flight: "",
    from: "",
    fromCity: "",
    to: "",
    toCity: "",
    depart: "",
    arrive: "",
  });

  const up = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const format = async () => {
    if (!raw.trim()) return;
    setParsing(true);
    setNote("");
    try {
      const result = await parseTripSheet(raw);
      if (result.length === 0) {
        setNote(
          "Couldn't find any legs in that. Check the paste, or add one by hand below.",
        );
      } else {
        setLegs(result);
        setNote(
          `Read ${result.length} leg${result.length > 1 ? "s" : ""}. Check it looks right, then publish.`,
        );
      }
    } catch {
      setNote("That didn't parse. Try pasting again, or add legs by hand.");
    }
    setParsing(false);
  };

  const addLeg = () => {
    if (
      !draft.date ||
      !draft.flight ||
      !draft.from ||
      !draft.to ||
      !draft.depart ||
      !draft.arrive
    )
      return;
    setLegs((l) => [
      ...l,
      { ...draft, from: draft.from.toUpperCase(), to: draft.to.toUpperCase() },
    ]);
    setDraft({
      date: draft.date,
      flight: "",
      from: "",
      fromCity: "",
      to: "",
      toCity: "",
      depart: "",
      arrive: "",
    });
  };
  const removeLeg = (i) => setLegs((l) => l.filter((_, idx) => idx !== i));

  const publish = async () => {
    setBusy(true);
    const t = { legs, updatedAt: new Date().toISOString() };
    try {
      await store.saveTrip(t);
      await onPublish(t);
      const s = tripStatus(t, new Date());
      if (s.state === "home") {
        setNote(
          "Saved, but this trip is already past its display window, so the board shows Home. Publish a current or upcoming trip to see it.",
        );
      } else if (s.state === "upcoming") {
        setNote("Published. Beth sees it as an upcoming trip.");
      } else if (s.state === "complete") {
        setNote(
          "Published. Shows as just landed; it clears on its own after tomorrow.",
        );
      } else {
        setNote("Published. Beth sees this now.");
      }
    } catch (e) {
      setNote("Could not save: " + (e && e.message ? e.message : String(e)));
    }
    setBusy(false);
  };

  const clearBoard = async () => {
    setBusy(true);
    const t = { legs: [], updatedAt: new Date().toISOString() };
    try {
      await store.saveTrip(t);
      await onPublish(t);
      setLegs([]);
      setRaw("");
      setNote("Board cleared. Shows as Home.");
    } catch {
      setNote("Could not save. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="cs-admin">
      <div className="cs-eyebrow">FLIGHT DECK</div>
      <h2>Drop in a trip</h2>
      <p className="hint">
        Paste your trip sheet. However it's formatted is fine.
      </p>

      <textarea
        className="cs-area"
        placeholder={examplePlaceholder()}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <div className="cs-actions" style={{ marginTop: 12 }}>
        <button
          className="cs-btn"
          onClick={format}
          disabled={parsing || !raw.trim()}
        >
          {parsing ? (
            <>
              <span className="cs-spin" />
              Reading
            </>
          ) : (
            "Format trip"
          )}
        </button>
      </div>

      {legs.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <span className="cs-lab">Preview · what Beth will see</span>
          {legs.map((leg, i) => (
            <div className="cs-leg flown done" key={i} style={{ opacity: 1 }}>
              <div className="cs-legtop">
                <span className="cs-flight">{leg.flight}</span>
                <span>{fmtMDY(leg.date)}</span>
                <span
                  className="cs-x"
                  onClick={() => removeLeg(i)}
                  style={{ padding: 0 }}
                >
                  ×
                </span>
              </div>
              <div className="cs-route">
                <div className="cs-port">
                  <div className="cs-code">{leg.from}</div>
                  {leg.fromCity ? (
                    <div className="cs-city">{leg.fromCity}</div>
                  ) : null}
                  <div className="cs-time">{leg.depart}</div>
                </div>
                <div className="cs-arrow">
                  <svg width="34" height="14" viewBox="0 0 34 14" fill="none">
                    <path d="M0 7h28" stroke="currentColor" strokeWidth="1" />
                    <path
                      d="M24 2l6 5-6 5"
                      stroke="currentColor"
                      strokeWidth="1"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="cs-port to">
                  <div className="cs-code">{leg.to}</div>
                  {leg.toCity ? (
                    <div className="cs-city">{leg.toCity}</div>
                  ) : null}
                  <div className="cs-time">{leg.arrive}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showManual ? (
        <div className="cs-or">
          <span className="cs-manual-link" onClick={() => setShowManual(true)}>
            add a leg by hand
          </span>
        </div>
      ) : (
        <div style={{ marginTop: 22 }}>
          <span className="cs-lab">Date · flight</span>
          <div className="cs-grid b">
            <input
              className="cs-in"
              type="date"
              value={draft.date}
              onChange={(e) => up("date", e.target.value)}
            />
            <input
              className="cs-in"
              placeholder="DL 1234"
              value={draft.flight}
              onChange={(e) => up("flight", e.target.value)}
            />
          </div>
          <span className="cs-lab">From · city · depart</span>
          <div className="cs-grid">
            <input
              className="cs-in"
              placeholder="SLC"
              maxLength={4}
              value={draft.from}
              onChange={(e) => up("from", e.target.value.toUpperCase())}
            />
            <input
              className="cs-in"
              placeholder="Salt Lake"
              value={draft.fromCity}
              onChange={(e) => up("fromCity", e.target.value)}
            />
            <input
              className="cs-in"
              type="time"
              value={draft.depart}
              onChange={(e) => up("depart", e.target.value)}
            />
          </div>
          <span className="cs-lab">To · city · arrive</span>
          <div className="cs-grid">
            <input
              className="cs-in"
              placeholder="LAX"
              maxLength={4}
              value={draft.to}
              onChange={(e) => up("to", e.target.value.toUpperCase())}
            />
            <input
              className="cs-in"
              placeholder="Los Angeles"
              value={draft.toCity}
              onChange={(e) => up("toCity", e.target.value)}
            />
            <input
              className="cs-in"
              type="time"
              value={draft.arrive}
              onChange={(e) => up("arrive", e.target.value)}
            />
          </div>
          <div className="cs-actions" style={{ marginTop: 12 }}>
            <button className="cs-btn ghost" onClick={addLeg}>
              Add leg
            </button>
          </div>
        </div>
      )}

      <div className="cs-actions">
        <button
          className="cs-btn"
          onClick={publish}
          disabled={busy || legs.length === 0}
        >
          Publish trip
        </button>
        <button className="cs-btn ghost" onClick={clearBoard} disabled={busy}>
          Clear board
        </button>
      </div>

      {note && <div className="cs-saved">{note}</div>}

      <div className="cs-foot">
        <span />
        <span className="cs-link" onClick={onExit}>
          Exit
        </span>
      </div>
    </div>
  );
}
