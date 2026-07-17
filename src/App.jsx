import React, { useState, useEffect, useMemo, useRef, useId } from "react";
import * as store from "./lib/store.js";
import * as push from "./lib/push.js";
import { AIRPORTS } from "./lib/airports.js";
import {
  decodeRings,
  greatCircle,
  routeFrame,
  projector,
  worldCopies,
  pathFor,
  graticuleStep,
} from "./lib/geo.js";

// The access codes no longer live here. They are environment variables on the
// server, and the gate checks them through /api/auth. Nothing secret ships to
// the browser anymore.


// ---- helpers ----------------------------------------------------------------

function legDates(leg) {
  // returns {dep, arr} Date objects; arr rolls to next day if earlier than dep
  const dep = new Date(`${leg.date}T${leg.depart}:00`);
  let arr = new Date(`${leg.date}T${leg.arrive}:00`);
  if (arr < dep) arr = new Date(arr.getTime() + 24 * 3600 * 1000);
  return { dep, arr, nextDay: arr.getDate() !== dep.getDate() };
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
  SLC: UTAH_TZ,
  DEN: UTAH_TZ,
  ABQ: UTAH_TZ,
  COS: UTAH_TZ,
  BOI: UTAH_TZ,
  GJT: UTAH_TZ,
  BZN: UTAH_TZ,
  JAC: UTAH_TZ,
  PHX: "America/Phoenix",
  TUS: "America/Phoenix",
  // Pacific
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
  SAN: "America/Los_Angeles",
  SJC: "America/Los_Angeles",
  OAK: "America/Los_Angeles",
  SMF: "America/Los_Angeles",
  SNA: "America/Los_Angeles",
  BUR: "America/Los_Angeles",
  ONT: "America/Los_Angeles",
  PDX: "America/Los_Angeles",
  SEA: "America/Los_Angeles",
  GEG: "America/Los_Angeles",
  RNO: "America/Los_Angeles",
  LAS: "America/Los_Angeles",
  FAT: "America/Los_Angeles",
  // Alaska / Hawaii
  ANC: "America/Anchorage",
  FAI: "America/Anchorage",
  JNU: "America/Anchorage",
  HNL: "Pacific/Honolulu",
  OGG: "Pacific/Honolulu",
  KOA: "Pacific/Honolulu",
  // Central
  ORD: "America/Chicago",
  MDW: "America/Chicago",
  DFW: "America/Chicago",
  IAH: "America/Chicago",
  HOU: "America/Chicago",
  MSY: "America/Chicago",
  MSP: "America/Chicago",
  STL: "America/Chicago",
  MCI: "America/Chicago",
  OMA: "America/Chicago",
  OKC: "America/Chicago",
  TUL: "America/Chicago",
  MEM: "America/Chicago",
  BNA: "America/Chicago",
  AUS: "America/Chicago",
  SAT: "America/Chicago",
  ICT: "America/Chicago",
  DSM: "America/Chicago",
  MKE: "America/Chicago",
  FAR: "America/Chicago",
  LIT: "America/Chicago",
  // Eastern
  ATL: "America/New_York",
  BOS: "America/New_York",
  JFK: "America/New_York",
  LGA: "America/New_York",
  EWR: "America/New_York",
  DCA: "America/New_York",
  IAD: "America/New_York",
  BWI: "America/New_York",
  PHL: "America/New_York",
  CLT: "America/New_York",
  RDU: "America/New_York",
  MCO: "America/New_York",
  MIA: "America/New_York",
  FLL: "America/New_York",
  TPA: "America/New_York",
  PBI: "America/New_York",
  JAX: "America/New_York",
  RSW: "America/New_York",
  PIT: "America/New_York",
  CLE: "America/New_York",
  CMH: "America/New_York",
  CVG: "America/New_York",
  IND: "America/New_York",
  DTW: "America/New_York",
  BUF: "America/New_York",
  ROC: "America/New_York",
  SYR: "America/New_York",
  BDL: "America/New_York",
  PVD: "America/New_York",
  ALB: "America/New_York",
  ORF: "America/New_York",
  RIC: "America/New_York",
  SAV: "America/New_York",
  CHS: "America/New_York",
  GSP: "America/New_York",
  GSO: "America/New_York",
  // International (common destinations)
  YYZ: "America/Toronto",
  YVR: "America/Vancouver",
  YUL: "America/Toronto",
  CUN: "America/Cancun",
  MEX: "America/Mexico_City",
  LHR: "Europe/London",
  CDG: "Europe/Paris",
  AMS: "Europe/Amsterdam",
  FRA: "Europe/Berlin",
  FCO: "Europe/Rome",
  MAD: "Europe/Madrid",
  NRT: "Asia/Tokyo",
  HND: "Asia/Tokyo",
  ICN: "Asia/Seoul",
  PVG: "Asia/Shanghai",
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
  const instant = new Date(
    asIfUtc.getTime() - (inTz.getTime() - inUtc.getTime()),
  );

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

// "YYYY-MM-DD" plus n days, as another "YYYY-MM-DD" string.
function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Arrival time of a leg, converted to Utah time, or null if same zone / unknown.
// Uses the arrival airport's zone, rolling the base date if the leg lands the
// next day, so the conversion lines up with the real instant.
function utahArriveTime(leg) {
  const toTz = AIRPORT_TZ[leg.to];
  if (!toTz || toTz === UTAH_TZ) return null;
  const { nextDay } = legDates(leg);
  const dateStr = nextDay ? addDaysStr(leg.date, 1) : leg.date;
  return convertZonedTime(dateStr, leg.arrive, toTz, UTAH_TZ);
}

// Stable key matching what the flightstatus function returns.
function legStatusKey(leg) {
  return `${leg.flight}|${leg.date}`;
}

// Has this leg actually landed, per live data? When AeroAPI reports an actual
// arrival, that's the truth — even if the printed schedule still shows the
// flight as airborne (e.g. it landed early). Used so the status, the pinned
// card, and the leg card don't claim "in the air" after a real landing.
function liveLanded(leg, statuses) {
  const st = statuses && statuses[legStatusKey(leg)];
  return !!(st && st.actualIn);
}

// How long a flown leg lingers on the board after it lands before it clears
// itself. Once Babe-a is on the ground and settled a few hours later, the leg
// drops off so the board only shows what's still ahead.
const LEG_LINGER_MS = 5 * 3600 * 1000;

// The instant a leg should disappear from the board: LEG_LINGER_MS past when it
// landed. Uses the real landing time from live data when we have it (a leg that
// landed early clears a little earlier too), otherwise the printed schedule.
function legClearAt(leg, statuses) {
  const st = statuses && statuses[legStatusKey(leg)];
  const arr =
    st && st.actualIn
      ? new Date(st.actualIn).getTime()
      : legDates(leg).arr.getTime();
  return arr + LEG_LINGER_MS;
}

// Formats an ISO instant as a clock time in the given airport's zone.
function fmtClockTz(iso, tz) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      timeZone: tz || undefined,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// Turns a normalized AeroAPI status into a short plain-language line plus a tone
// ("ok" / "warn" / "bad") the board uses for color. Returns null when there's
// nothing live to add over the printed schedule.
function describeLiveStatus(st, leg) {
  if (!st) return null;
  const toTz = AIRPORT_TZ[leg.to];
  const fromTz = AIRPORT_TZ[leg.from];
  const gateIn = st.gateDestination ? ` · Gate ${st.gateDestination}` : "";

  if (st.cancelled && !st.actualOut) return { tone: "bad", text: "Canceled" };
  if (st.diverted) return { tone: "bad", text: "Diverted" };

  // Landed.
  if (st.actualIn) {
    const t = fmtClockTz(st.actualIn, toTz);
    return { tone: "ok", text: t ? `Landed ${t}${gateIn}` : `Landed${gateIn}` };
  }

  const arrLate =
    st.arrivalDelay != null ? Math.round(st.arrivalDelay / 60) : null;

  // Departed / airborne.
  if (st.actualOut) {
    const eta = st.estIn ? fmtClockTz(st.estIn, toTz) : "";
    if (arrLate != null && arrLate >= 15) {
      return {
        tone: "warn",
        text: `In the air · landing ${eta ? eta + " " : ""}(${arrLate} min late)${gateIn}`,
      };
    }
    if (arrLate != null && arrLate <= -15) {
      return {
        tone: "ok",
        text: `In the air · landing early${eta ? " ~" + eta : ""}${gateIn}`,
      };
    }
    return {
      tone: "ok",
      text: eta
        ? `In the air · landing ~${eta}${gateIn}`
        : `In the air${gateIn}`,
    };
  }

  // Not departed yet.
  const depLate =
    st.departureDelay != null ? Math.round(st.departureDelay / 60) : null;
  if (depLate != null && depLate >= 15) {
    const newOut = st.estOut ? fmtClockTz(st.estOut, fromTz) : "";
    return {
      tone: "warn",
      text: `Delayed ${depLate} min${newOut ? ` · now ${newOut}` : ""}`,
    };
  }
  if (st.actualOut == null && (depLate == null || depLate < 15)) {
    return { tone: "ok", text: "On time" };
  }
  return null;
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

// Whole nights ("sleeps") between now and a future instant, by calendar day.
function nightsUntil(target, now) {
  const a = new Date(now);
  a.setHours(0, 0, 0, 0);
  const b = new Date(target);
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 86400000));
}

// The "Home Thursday · 2 more sleeps" banner data, or null if there's nothing
// honest to count down to. This is specifically a "when is he home" countdown:
// if the last posted leg doesn't land at his home airport, the trip isn't
// actually over — it's just an overnight, with more legs likely still to come —
// so we show nothing here and let the status line cover it.
function homeCountdown(s, now) {
  if (!s.sorted || s.sorted.length === 0) return null;
  const last = s.sorted[s.sorted.length - 1];
  if (last.to !== HOME_AIRPORT) return null;
  const homeAt = legDates(last).arr;
  if (now >= homeAt) return null; // already on that last leg or done

  const when = `Home ${whenWord(last.date, now)} at ${fmtTime(last.arrive)}`;
  const n = nightsUntil(homeAt, now);
  const sleeps =
    n === 0 ? "Later today" : `${n} more sleep${n === 1 ? "" : "s"}`;
  return { when, sleeps };
}

// The two people who sign in. Each code identifies a person; Babe-a's can also
// publish trips. `other` is who their notes go to.
const PEOPLE = {
  beth: { name: "Beth", other: "babea" },
  babea: { name: "Babe-a", other: "beth" },
};

// Time-of-day greeting.
function greetingWord(now) {
  const h = now.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// Warm rotating messages for the home screen, stable across a given day and
// written for whoever is looking at the board.
const HOME_MESSAGES = {
  beth: [
    "He's home — soak up every minute. 🤍",
    "No flights on the board. Enjoy each other. 🤍",
    "Grounded and right where he belongs. 🤍",
    "Home sweet home. Make it count. 🤍",
    "He's all yours today. 🤍",
  ],
  babea: [
    "You're home — the best layover there is. 🤍",
    "No flights on the board. Enjoy the days off. 🤍",
    "Grounded, and right where you belong. 🤍",
    "Home sweet home. Make it count. 🤍",
    "Nowhere to be but here. 🤍",
  ],
};
function homeMessage(now, who) {
  const msgs = HOME_MESSAGES[who] || HOME_MESSAGES.beth;
  const start = new Date(now.getFullYear(), 0, 0);
  const doy = Math.floor((now - start) / 86400000);
  return msgs[doy % msgs.length];
}

// Whole days from a to b, by calendar day.
function daysBetween(a, b) {
  const d1 = new Date(a);
  d1.setHours(0, 0, 0, 0);
  const d2 = new Date(b);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2 - d1) / 86400000);
}

// "today" / "tomorrow" / "in 3 days" for a YYYY-MM-DD date, or null if past.
function untilWords(dateStr, now) {
  const n = daysBetween(now, new Date(dateStr + "T00:00:00"));
  if (n < 0) return null;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}

// Time spent on the ground between this leg landing and the next one departing.
// Returns null when there's no following leg. `overnight` is true when the gap
// crosses a calendar day, so the board can call it out.
function layoverAfter(leg, next) {
  if (!next) return null;
  const land = legDates(leg).arr;
  const off = legDates(next).dep;
  const ms = off - land;
  if (ms <= 0) return null;
  const place = leg.toCity || leg.to;
  const overnight =
    land.toDateString() !== off.toDateString() || ms >= 8 * 3600 * 1000;
  return { overnight, place, text: humanizeDuration(ms) };
}

// A warm phrase for when a note was set down: "just now", "20 minutes ago",
// "this morning", "last night", "yesterday afternoon", "Saturday", "June 3".
// Returns "" for notes from before timestamps existed (or bad data), so the
// label simply omits the time rather than inventing one.
function noteWhenWord(atIso, now) {
  if (!atIso) return "";
  const at = new Date(atIso);
  if (isNaN(at)) return "";
  const mins = Math.round((now - at) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;

  const h = at.getHours();
  const days = daysBetween(at, now);
  if (days <= 0) {
    // Earlier the same day. Before 5am reads as "early this morning" —
    // "this night" isn't a thing anyone says.
    if (h < 5) return "early this morning";
    if (h < 12) return "this morning";
    if (h < 17) return "this afternoon";
    return "this evening";
  }
  if (days === 1) {
    if (h >= 17 || h < 5) return "last night";
    if (h < 12) return "yesterday morning";
    return "yesterday afternoon";
  }
  if (days < 7) {
    return at.toLocaleDateString(undefined, { weekday: "long" });
  }
  return at.toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

// A casual day word for sentences: "today" / "tomorrow" / "Saturday".
function whenWord(dateStr, now) {
  const lbl = dayLabel(dateStr, now);
  if (lbl) return lbl.toLowerCase();
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
  });
}

// The trailing "landing ..." phrase for the in-air headline. Prefers the live
// FlightAware ETA over the printed schedule, and flags early/late using the
// same ±15-minute threshold as the per-leg status pill (describeLiveStatus), so
// the headline and the leg card always agree. Falls back to the printed arrival
// when there's no live estimate.
function landingPhrase(leg, statuses) {
  const st = statuses && statuses[legStatusKey(leg)];
  const eta = st && st.estIn ? fmtClockTz(st.estIn, AIRPORT_TZ[leg.to]) : "";
  if (eta) {
    const arrLate =
      st.arrivalDelay != null ? Math.round(st.arrivalDelay / 60) : null;
    if (arrLate != null && arrLate >= 15)
      return `landing ${eta} (${arrLate} min late)`;
    if (arrLate != null && arrLate <= -15) return `landing early at ${eta}`;
    return `landing ${eta}`;
  }
  return `landing ${fmtTime(leg.arrive)}`;
}

// Plain-language answer to "where is Andy right now?" plus a big status word.
// `statuses` lets live data override the printed schedule (e.g. a flight that
// landed early shouldn't still read as "in the air", and the in-air landing
// time tracks FlightAware's live ETA rather than the printed arrival).
// `who` is whose board this is: on Babe-a's own board the lines speak to him
// ("You're in Denver"), on Beth's they speak about him.
function liveSummary(s, now, statuses, who) {
  const self = who === "babea";
  const subj = self ? "You're" : "Babe-a is"; // "<subj> in Denver…"
  if (s.state === "home") {
    return { word: "Home", tone: "home", line: `${subj} home right now.` };
  }
  const sorted = s.sorted;

  // In the air on a specific leg? Only if it hasn't actually landed yet.
  for (const leg of sorted) {
    const { dep, arr } = legDates(leg);
    if (now >= dep && now <= arr && !liveLanded(leg, statuses)) {
      const from = leg.fromCity || leg.from;
      const to = leg.toCity || leg.to;
      const verb = isDeadhead(leg)
        ? "deadheading (riding as a passenger)"
        : "flying";
      // Amber when live data says the arrival is running meaningfully late,
      // matching the ±15-minute threshold used everywhere else.
      const st = statuses && statuses[legStatusKey(leg)];
      const late =
        st && typeof st.arrivalDelay === "number" && st.arrivalDelay >= 15 * 60;
      return {
        word: "In the air",
        tone: late ? "late" : "air",
        line: `${subj} ${verb} from ${from} to ${to}, ${landingPhrase(leg, statuses)}.`,
      };
    }
  }

  // A leg counts as past once it has actually landed, even if the scheduled
  // arrival is still in the future.
  const upcoming = sorted.filter(
    (l) => legDates(l).dep > now && !liveLanded(l, statuses),
  );
  const past = sorted.filter(
    (l) => legDates(l).arr <= now || liveLanded(l, statuses),
  );
  const next = upcoming[0];

  if (past.length === 0) {
    return {
      word: "Trip ahead",
      tone: null,
      line: `${self ? "You leave" : "Babe-a leaves"} ${whenWord(next.date, now)} at ${fmtTime(next.depart)}.`,
    };
  }

  const lastLanded = past[past.length - 1];
  const place = lastLanded.toCity || lastLanded.to;

  // Landed at home with nothing else on the books: the trip is actually over.
  if (!next && lastLanded.to === HOME_AIRPORT) {
    return { word: "Back home", tone: "home", line: `${subj} back home now.` };
  }

  // No more legs in hand yet. He's not home, so it's an overnight, not "back home."
  if (!next) {
    return {
      word: "Overnight",
      tone: "away",
      line: `${subj} in ${place} on the overnight.`,
    };
  }

  // Flying again later today: give a countdown instead of a day label.
  if (dayLabel(next.date, now) === "Today") {
    return {
      word: "On the ground",
      tone: "away",
      line: `${subj} in ${place} right now. Next flight in ${humanizeDuration(legDates(next).dep - now)}.`,
    };
  }

  // Last leg of the day is down; the next one isn't until a later day.
  return {
    word: "Overnight",
    tone: "away",
    line: `${subj} in ${place} on the overnight. Next flight ${whenWord(next.date, now)} at ${fmtTime(next.depart)}.`,
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

// A deadhead is a leg Babe-a rides as a passenger, not one he operates. The
// parser marks these by prefixing the flight number with "DH " (see parse.js),
// so a leading "DH" is our signal across the app.
function isDeadhead(leg) {
  return /^DH\b/i.test((leg?.flight || "").trim());
}

// The flight number with the "DH " deadhead marker removed, for when the badge
// already says "deadhead" and we don't want the prefix repeated on the number.
function flightNumber(flight) {
  return (flight || "").replace(/^DH\s*/i, "").trim();
}

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

// Accent colors Beth can choose. "crimson" is the default brand color; picking
// it means no override (so dark mode keeps its slightly brighter crimson).
const ACCENTS = [
  { id: "crimson", hex: "#be2639" },
  { id: "rose", hex: "#d6336c" },
  { id: "plum", hex: "#7c3aed" },
  { id: "teal", hex: "#0d9488" },
  { id: "gold", hex: "#bf8700" },
  { id: "indigo", hex: "#3b5bdb" },
];
function hexToRgba(hex, a) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function App() {
  const [screen, setScreen] = useState("loading"); // loading | gate | viewer | admin
  const [me, setMe] = useState(null); // { who: "babea" | "beth", canPublish }
  const [trip, setTrip] = useState(null);
  const [now, setNow] = useState(new Date());
  const [theme, setTheme] = useState(() => {
    // Default to light on a fresh install/open; only honor a previously saved
    // choice. We intentionally ignore the OS prefers-color-scheme so the first
    // run is always light, and a deliberate switch to dark is what sticks.
    try {
      const saved = localStorage.getItem("cs-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {}
    return "light";
  });

  // Persist the theme choice and keep the PWA status-bar color in step.
  useEffect(() => {
    try {
      localStorage.setItem("cs-theme", theme);
    } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.setAttribute("content", theme === "dark" ? "#15110e" : "#f7f5f2");
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const [accent, setAccent] = useState(() => {
    // Default to plum (purple) on a fresh install; a saved choice always wins,
    // so once Beth picks a color it sticks.
    try {
      return localStorage.getItem("cs-accent") || "plum";
    } catch {
      return "plum";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("cs-accent", accent);
    } catch {}
  }, [accent]);
  // Text size: a per-device zoom so everything gets bigger with one tap.
  // Saved like the theme and accent, so it sticks on Beth's phone.
  const [textSize, setTextSize] = useState(() => {
    try {
      const saved = localStorage.getItem("cs-textsize");
      if (saved === "1" || saved === "1.15" || saved === "1.3") return saved;
    } catch {}
    return "1";
  });
  useEffect(() => {
    try {
      localStorage.setItem("cs-textsize", textSize);
    } catch {}
  }, [textSize]);

  const accentObj = ACCENTS.find((a) => a.id === accent) || ACCENTS[0];
  // Default crimson uses no override so dark mode keeps its tuned shade.
  const rootStyle =
    accent === "crimson"
      ? undefined
      : {
          "--crimson": accentObj.hex,
          "--crimson-dim": hexToRgba(accentObj.hex, 0.12),
        };

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

  // When the board last heard from the server, for the freshness whisper.
  const [refreshedAt, setRefreshedAt] = useState(null);

  const loadTrip = async () => {
    try {
      const t = await store.getTrip();
      const next = await expireIfDue(t);
      // Keep the previous object when nothing changed, so effects keyed on
      // the trip (live status, weather, personal) don't tear down and re-fetch
      // on every background poll.
      setTrip((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
      setRefreshedAt(new Date());
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

  // Everyone lands on their own board; Babe-a flips into the flight deck from
  // there when there's a trip to publish.
  useEffect(() => {
    (async () => {
      const id = await store.resume();
      if (id) {
        setMe(id);
        await loadTrip();
        setScreen("viewer");
      } else {
        setScreen("gate");
      }
    })();
  }, []);

  // Beth's board keeps itself current: re-pull the trip on a timer and whenever
  // she returns to the tab, so a freshly published trip (or a change mid-trip)
  // shows up without a manual refresh.
  useEffect(() => {
    if (screen !== "viewer") return;
    const refresh = () => {
      if (document.visibilityState === "visible") loadTrip();
    };
    const t = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [screen]);

  if (screen === "loading") {
    return (
      <div className={`cs-root ${theme === "dark" ? "dark" : ""}`}>
        <div className="cs-shell cs-loading">
          <WorldLogo size={112} />
          <div
            className="mono"
            style={{
              color: "var(--faint)",
              letterSpacing: "0.2em",
              fontSize: 12,
            }}
          >
            LOADING
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`cs-root ${theme === "dark" ? "dark" : ""}`}
      style={{ ...rootStyle, zoom: textSize }}
    >
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <div className="cs-shell">
        {screen === "gate" && (
          <Gate
            resolve={async (v) => {
              const id = await store.authenticate(v.trim());
              if (!id) return false;
              setMe(id);
              await loadTrip();
              setScreen("viewer");
              return true;
            }}
          />
        )}

        {screen === "viewer" && (
          <Viewer
            me={me}
            trip={trip}
            now={now}
            refreshedAt={refreshedAt}
            onFlightDeck={
              me && me.canPublish ? () => setScreen("admin") : null
            }
            onLock={() => {
              store.signOut();
              setMe(null);
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
            onBoard={() => setScreen("viewer")}
          />
        )}
      </div>
      <footer className="cs-credit">
        {(screen === "viewer" || screen === "admin") && <NotificationToggle />}
        <div className="cs-textsize">
          <span className="cs-accent-label">Text size</span>
          {[
            ["1", 15],
            ["1.15", 19],
            ["1.3", 23],
          ].map(([v, px]) => (
            <button
              key={v}
              className={`cs-ts-btn ${textSize === v ? "sel" : ""}`}
              style={{ fontSize: px }}
              onClick={() => setTextSize(v)}
              aria-label={`Text size ${v === "1" ? "normal" : v === "1.15" ? "large" : "largest"}`}
            >
              A
            </button>
          ))}
        </div>
        <div className="cs-accent">
          <span className="cs-accent-label">Your color</span>
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              className={`cs-swatch ${a.id === accent ? "sel" : ""}`}
              style={{ background: a.hex }}
              onClick={() => setAccent(a.id)}
              aria-label={`Accent ${a.id}`}
            />
          ))}
        </div>
        <div className="cs-credit-line">
          Created &amp; developed with <span className="cs-heart">♥</span> by
          Andrew
        </div>
        <div className="cs-credit-year">
          © {new Date().getFullYear()} · Mr. Gray Enterprises, Inc.
        </div>
      </footer>
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
      <WorldLogo size={88} />
      <div className="cs-eyebrow">Private access</div>
      <h1>
        Where in the world is <em>Babe-a</em>?
      </h1>
      <p>Enter your access code.</p>
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

// The app mark: a little globe with Babe-a's plane circling it and a heart
// for home. `spin` sends the plane around its orbit (CSS skips the animation
// when the user prefers reduced motion). Strokes and fills ride the theme
// vars, so the plane and heart follow whichever accent color is chosen.
// A standalone copy lives at public/logo.svg; the pre-React splash in
// index.html carries its own inline copy with hardcoded colors.
function WorldLogo({ size = 96, spin = true }) {
  return (
    <svg
      className="cs-logo"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="60"
        cy="60"
        r="46"
        stroke="var(--faint)"
        strokeWidth="1.4"
        strokeDasharray="1.5 7"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="60" cy="60" r="27" stroke="var(--text)" strokeWidth="2.4" />
      <ellipse
        cx="60"
        cy="60"
        rx="27"
        ry="9.5"
        stroke="var(--muted)"
        strokeWidth="1.3"
        opacity="0.75"
      />
      <ellipse
        cx="60"
        cy="60"
        rx="10.5"
        ry="27"
        stroke="var(--muted)"
        strokeWidth="1.3"
        opacity="0.75"
      />
      <g transform="translate(49 53) scale(0.5) translate(-12 -12)">
        <path
          fill="var(--crimson)"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </g>
      <g className={spin ? "cs-logo-spin" : undefined}>
        <g transform="translate(60 14) rotate(90) scale(0.8) translate(-12 -12)">
          <path
            fill="var(--crimson)"
            d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
          />
        </g>
      </g>
    </svg>
  );
}

function RouteArrow() {
  return (
    <svg
      width="30"
      height="14"
      viewBox="0 0 30 14"
      fill="none"
      aria-hidden="true"
    >
      <path d="M0 7h24" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M20 2l6 5-6 5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

// Shared plane silhouette (points north, so headings get a quarter turn).
const PLANE_D =
  "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z";

// Land shapes and state lines load on the first unfold only (and decode
// once), so the map costs no bundle weight or work until somebody opens it.
let worldPromise = null;
function loadWorld() {
  if (!worldPromise) {
    worldPromise = import("./lib/landdata.js").then((m) => ({
      land: decodeRings(m.LAND),
      states: decodeRings(m.STATE_LINES),
    }));
  }
  return worldPromise;
}

const MAP_W = 320;
const MAP_H = 200;

// The fold-out route map: coastlines and state lines in faint ink, framed
// around the leg's great-circle path, with the same flown/remaining split and
// the plane at the live progress point. Renders nothing if either airport is
// missing from the coordinates table.
function RouteMap({ from, to, progress, homecoming, open }) {
  const clipId = useId();
  const [world, setWorld] = useState(null);
  useEffect(() => {
    if (!open || world) return;
    let alive = true;
    loadWorld()
      .then((w) => {
        if (alive) setWorld(w);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, world]);

  // Everything that doesn't move while the flight is in the air.
  const scene = useMemo(() => {
    const a = AIRPORTS[(from || "").toUpperCase()];
    const b = AIRPORTS[(to || "").toUpperCase()];
    if (!a || !b) return null;
    const route = greatCircle(a, b, 72);
    const frame = routeFrame(route, MAP_W / MAP_H);
    const proj = projector(frame, MAP_W, MAP_H);
    const landD = [];
    const borderD = [];
    if (world) {
      for (const shift of worldCopies(frame)) {
        for (const ring of world.land) {
          const d = pathFor(ring, frame, proj, shift, true);
          if (d) landD.push(d);
        }
        for (const line of world.states) {
          const d = pathFor(line, frame, proj, shift, false);
          if (d) borderD.push(d);
        }
      }
    }
    const step = graticuleStep(frame);
    const gratX = [];
    const gratY = [];
    for (
      let lon = Math.ceil(frame.lon0 / step) * step;
      lon <= frame.lon1;
      lon += step
    ) {
      gratX.push(proj([lon, frame.lat0])[0]);
    }
    for (
      let lat = Math.ceil(frame.lat0 / step) * step;
      lat <= frame.lat1;
      lat += step
    ) {
      gratY.push(proj([frame.lon0, lat])[1]);
    }
    return { route, proj, landD, borderD, gratX, gratY, d: pathFor(route, frame, proj) };
  }, [from, to, world]);

  if (!scene) return null;
  if (!world) {
    return (
      <div className="cs-map">
        <div className="cs-map-loading">unfolding the map…</div>
      </div>
    );
  }

  const { route, proj } = scene;
  const t = Math.min(0.97, Math.max(0.03, progress / 100));
  const i = Math.min(route.length - 2, Math.floor(t * (route.length - 1)));
  const f = t * (route.length - 1) - i;
  const p1 = proj(route[i]);
  const p2 = proj(route[i + 1]);
  const px = p1[0] + (p2[0] - p1[0]) * f;
  const py = p1[1] + (p2[1] - p1[1]) * f;
  const heading = (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI;

  const [ax, ay] = proj(route[0]);
  const [bx, by] = proj(route[route.length - 1]);
  const label = (x, y, text) => (
    <text
      className="cs-map-code"
      x={Math.min(MAP_W - 18, Math.max(18, x))}
      y={y + 15 > MAP_H - 6 ? y - 9 : y + 15}
      textAnchor="middle"
    >
      {text}
    </text>
  );

  return (
    <div className="cs-map">
      <svg className="cs-map-svg" viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <rect width={MAP_W} height={MAP_H} rx="10" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect width={MAP_W} height={MAP_H} className="cs-map-water" />
          {scene.landD.map((d, k) => (
            <path key={`l${k}`} className="cs-map-land" d={d} />
          ))}
          {scene.gratX.map((x, k) => (
            <line key={`gx${k}`} className="cs-map-grat" x1={x} y1="0" x2={x} y2={MAP_H} />
          ))}
          {scene.gratY.map((y, k) => (
            <line key={`gy${k}`} className="cs-map-grat" x1="0" y1={y} x2={MAP_W} y2={y} />
          ))}
          {scene.borderD.map((d, k) => (
            <path key={`b${k}`} className="cs-map-border" d={d} />
          ))}
          <path className="cs-map-route-rest" d={scene.d} />
          <path
            className="cs-map-route-flown"
            d={scene.d}
            pathLength="100"
            style={{ strokeDasharray: `${Math.max(1, progress)} 100` }}
          />
          <circle className="cs-map-dot" cx={ax} cy={ay} r="2.6" />
          {homecoming ? (
            <path
              className="cs-ribbon-heart"
              transform={`translate(${bx} ${by}) scale(1.5)`}
              d="M0 2.4 C -3.2 0 -2 -3 0 -1.3 C 2 -3 3.2 0 0 2.4 Z"
            />
          ) : (
            <circle className="cs-map-dot to" cx={bx} cy={by} r="2.6" />
          )}
          {label(ax, ay, from)}
          {label(bx, by, to)}
          <g
            transform={`translate(${px} ${py}) rotate(${heading + 90}) scale(0.8) translate(-12 -12)`}
          >
            <path className="cs-map-plane" d={PLANE_D} />
          </g>
        </g>
        <rect width={MAP_W} height={MAP_H} rx="10" className="cs-map-edge" />
      </svg>
    </div>
  );
}

// The in-air route ribbon: the leg drawn as a gently arced flight path with a
// little plane at the live progress point. Solid ink behind the plane is the
// distance already flown; the dotted line ahead is what's left. On the final
// leg home the destination marker becomes a heart.
function RouteRibbon({ from, to, progress, etaText, homecoming }) {
  const A = { x: 8, y: 30 }; // origin
  const B = { x: 112, y: 30 }; // destination
  const C = { x: 60, y: 4 }; // arc control point
  // Keep the plane just off the endpoint markers.
  const t = Math.min(0.97, Math.max(0.03, progress / 100));
  const q = (a, c, b) =>
    (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  const px = q(A.x, C.x, B.x);
  const py = q(A.y, C.y, B.y);
  const dx = (1 - t) * (C.x - A.x) + t * (B.x - C.x);
  const dy = (1 - t) * (C.y - A.y) + t * (B.y - C.y);
  const heading = (Math.atan2(dy, dx) * 180) / Math.PI;
  const d = `M ${A.x} ${A.y} Q ${C.x} ${C.y} ${B.x} ${B.y}`;
  return (
    <div className="cs-ribbon">
      <svg viewBox="0 0 120 34" aria-hidden="true">
        <path className="cs-ribbon-rest" d={d} />
        <path
          className="cs-ribbon-flown"
          d={d}
          pathLength="100"
          style={{ strokeDasharray: `${Math.max(1, progress)} 100` }}
        />
        <circle className="cs-ribbon-dot" cx={A.x} cy={A.y} r="1.8" />
        {homecoming ? (
          <path
            className="cs-ribbon-heart"
            transform={`translate(${B.x} ${B.y}) scale(1.4)`}
            d="M0 2.4 C -3.2 0 -2 -3 0 -1.3 C 2 -3 3.2 0 0 2.4 Z"
          />
        ) : (
          <circle className="cs-ribbon-dot to" cx={B.x} cy={B.y} r="1.8" />
        )}
        <g
          transform={`translate(${px} ${py}) rotate(${heading + 90}) scale(0.55) translate(-12 -12)`}
        >
          <path className="cs-ribbon-plane" d={PLANE_D} />
        </g>
      </svg>
      <div className="cs-ribbon-meta">
        <span>{from}</span>
        <span className="cs-ribbon-eta">{etaText}</span>
        <span>{to}</span>
      </div>
    </div>
  );
}

// Sun / moon toggle, fixed to the top-right corner on every screen.
function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";
  return (
    <button
      className="cs-theme-toggle"
      onClick={onToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// One flight leg, used both pinned at the top and inline in the board. The
// layout keeps the airport codes on their own row, the times in an aligned
// two-column row, and weather + live status on their own full-width rows so
// nothing gets squeezed or truncated.
function LegCard({
  leg,
  now,
  statuses,
  weather,
  pinned,
  homecoming,
  mapOpen,
  onToggleMap,
  style,
}) {
  const { dep, arr, nextDay } = legDates(leg);
  const st = statuses[legStatusKey(leg)];
  // Live data wins: if it actually landed, it's not in the air anymore even if
  // the printed arrival time is still in the future.
  const landedLive = !!(st && st.actualIn);
  const active = now >= dep && now <= arr && !landedLive;
  const done = now > arr || landedLive;
  const live = describeLiveStatus(st, leg);
  const deadhead = isDeadhead(leg);
  const wx = weather[(leg.to || "").toUpperCase()];
  const utahDep = utahDepartTime(leg);
  const utahArr = utahArriveTime(leg);
  const tzSuffix = (sh) => (sh > 0 ? " (+1)" : sh < 0 ? " (-1)" : "");

  // While in the air: a progress bar and a live "lands in ..." countdown,
  // using the live ETA when we have it and the schedule otherwise.
  let progress = null;
  let etaText = null;
  if (active) {
    const landAt = st && st.estIn ? new Date(st.estIn) : arr;
    const etaMs = landAt - now;
    etaText =
      etaMs > 60000 ? `Lands in ${humanizeDuration(etaMs)}` : "Landing now";
    const pctRaw =
      st && typeof st.progress === "number"
        ? st.progress
        : ((now - dep) / (arr - dep)) * 100;
    progress = Math.max(3, Math.min(100, Math.round(pctRaw)));
  }

  // The ribbon unfolds into a map when both airports have known coordinates.
  // Open/closed lives in the Viewer so the pinned card and the same leg's
  // card in the day list fold together.
  const canMap =
    active &&
    !!onToggleMap &&
    !!AIRPORTS[(leg.from || "").toUpperCase()] &&
    !!AIRPORTS[(leg.to || "").toUpperCase()];

  return (
    <div
      className={`cs-leg ${active ? "active" : ""} ${done ? "done" : ""} ${pinned ? "pinned" : ""} ${deadhead ? "deadhead" : ""}`}
      style={style}
    >
      <div className="cs-legtop">
        <a
          className="cs-flight"
          href={flightAwareUrl(leg.flight)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {deadhead ? flightNumber(leg.flight) : leg.flight}
        </a>
        <span className="cs-tag">
          {active ? <span className="cs-livedot" /> : null}
          {active ? "IN AIR NOW" : done ? "LANDED" : "SCHEDULED"}
        </span>
      </div>

      {deadhead ? (
        <div className="cs-dh">
          <span className="cs-dh-badge">Deadhead</span>
          <span className="cs-dh-note">
            Riding as a passenger — not operating
          </span>
        </div>
      ) : null}

      <div className="cs-route2">
        <div className="cs-end">
          <div className="cs-code">{leg.from}</div>
          {leg.fromCity ? <div className="cs-city">{leg.fromCity}</div> : null}
        </div>
        <div className="cs-arrow">
          <RouteArrow />
        </div>
        <div className="cs-end to">
          <div className="cs-code">{leg.to}</div>
          {leg.toCity ? <div className="cs-city">{leg.toCity}</div> : null}
        </div>
      </div>

      <div className="cs-times">
        <div className="cs-tcol">
          <div className="cs-tlabel">Depart</div>
          <div className="cs-time">{fmtTime(leg.depart)}</div>
          {utahDep ? (
            <div className="cs-tzhint">
              {utahDep.time} MT{tzSuffix(utahDep.dayShift)}
            </div>
          ) : null}
        </div>
        <div className="cs-tcol to">
          <div className="cs-tlabel">Arrive</div>
          <div className="cs-time">
            {fmtTime(leg.arrive)}
            {nextDay ? " +1" : ""}
          </div>
          {utahArr ? (
            <div className="cs-tzhint">
              {utahArr.time} MT{tzSuffix(utahArr.dayShift)}
            </div>
          ) : null}
        </div>
      </div>

      {active ? (
        canMap ? (
          <>
            <button
              type="button"
              className="cs-ribbon-toggle"
              onClick={onToggleMap}
              aria-expanded={!!mapOpen}
            >
              <RouteRibbon
                from={leg.from}
                to={leg.to}
                progress={progress}
                etaText={etaText}
                homecoming={homecoming}
              />
              <div className="cs-ribbon-hint">
                {mapOpen ? "fold the map away ▴" : "unfold the map ▾"}
              </div>
            </button>
            <div className={`cs-map-fold ${mapOpen ? "open" : ""}`}>
              <div>
                <RouteMap
                  from={leg.from}
                  to={leg.to}
                  progress={progress}
                  homecoming={homecoming}
                  open={mapOpen}
                />
              </div>
            </div>
          </>
        ) : (
          <RouteRibbon
            from={leg.from}
            to={leg.to}
            progress={progress}
            etaText={etaText}
            homecoming={homecoming}
          />
        )
      ) : null}

      {wx ? (
        <div className="cs-wx2">
          <span className="cs-wx-emoji">{wx.emoji}</span>
          <span className="cs-wx-temp">{wx.tempF}°</span>
          {wx.label ? <span className="cs-wx-cond">{wx.label}</span> : null}
          <span className="cs-wx-where">in {leg.toCity || leg.to}</span>
        </div>
      ) : null}

      {live ? (
        <div className={`cs-live ${live.tone}`}>
          <span className="cs-livetag">
            <span className="cs-livedot2" />
            Live
          </span>
          <span className="cs-livetext">{live.text}</span>
        </div>
      ) : null}
    </div>
  );
}

// An opt-in / opt-out switch for push notifications (departures, landings,
// delays, and notes from the other person). It only shows when this browser can
// do push AND the server has push configured, so it stays invisible rather
// than broken when either is missing.
// Turning it off unsubscribes this device and tells the server to forget it.
function NotificationToggle() {
  const [show, setShow] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // The VAPID public key, kept around for when the user flips the switch on.
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!push.pushSupported()) return;
      const cfg = await store.pushConfig();
      if (!alive || !cfg.configured || !cfg.publicKey) return;
      const sub = await push.currentSubscription();
      if (!alive) return;
      setPublicKey(cfg.publicKey);
      setEnabled(!!sub && push.permission() === "granted");
      setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setNote("");
    try {
      const sub = await push.subscribe(publicKey);
      await store.pushSubscribe(sub);
      setEnabled(true);
    } catch (e) {
      if (e && e.message === "denied") {
        setNote(
          "Notifications are blocked. Enable them in your browser settings.",
        );
      } else {
        setNote("Could not turn on notifications. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setNote("");
    try {
      const endpoint = await push.unsubscribe();
      if (endpoint) await store.pushUnsubscribe(endpoint);
      setEnabled(false);
    } catch {
      setNote("Could not turn off notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div className="cs-notif">
      <div className="cs-notif-row">
        <div className="cs-notif-text">
          <div className="cs-notif-title">Notifications</div>
          <div className="cs-notif-sub">
            Departures, landings &amp; delays for the current trip, plus notes
            left for you.
          </div>
        </div>
        <button
          type="button"
          className={`cs-switch ${enabled ? "on" : ""}`}
          role="switch"
          aria-checked={enabled}
          aria-label="Push notifications"
          disabled={busy}
          onClick={enabled ? turnOff : turnOn}
        >
          <span className="cs-switch-knob" />
        </button>
      </div>
      {note ? <div className="cs-notif-note">{note}</div> : null}
    </div>
  );
}

// "Good morning, Beth" (or Babe-a) at the very top of every screen, with the
// little #4eva bubble floating alongside it.
function Greeting({ now, name }) {
  return (
    <div className="cs-greet">
      {greetingWord(now)}, <span>{name}</span>
      <div className="cs-4eva" aria-hidden="true">
        <span>#4eva</span>
      </div>
    </div>
  );
}

// The single status card at the top of every screen: the big headline word,
// a one-line plain-language answer, and a meta row of small chips for the
// at-a-glance facts — when he's home again, and any special shared date
// Babe-a set in the admin. Chips are omitted when there's nothing to show.
function StatusCard({ word, tone, sub, countdown, special, now }) {
  const specialWords =
    special && special.date ? untilWords(special.date, now) : null;
  const hasMeta = countdown || specialWords;
  return (
    <div className="cs-card">
      <div className={`cs-card-word${tone ? ` tone-${tone}` : ""}`}>{word}</div>
      <div className="cs-card-sub">{sub}</div>
      {hasMeta && (
        <div className="cs-card-meta">
          {countdown && (
            <div className="cs-chip cs-chip-home">
              <span className="cs-chip-icon" aria-hidden="true">
                ⌂
              </span>
              <span className="cs-chip-text">{countdown.when}</span>
              <span className="cs-chip-tag">{countdown.sleeps}</span>
            </div>
          )}
          {specialWords && (
            <div className="cs-chip cs-chip-special">
              <span className="cs-chip-icon" aria-hidden="true">
                ♥
              </span>
              <span className="cs-chip-text">
                {(special.label || "Your day") + " " + specialWords}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Lets whoever is signed in leave a short note for the other person. Beth
// writes noteFromBeth, Babe-a writes noteFromBabea. `sentAt` is when the saved
// note went out; a quiet "Sent this morning" sits beside the button so you
// know your note is up without re-reading it.
function NoteComposer({ me, initial, sentAt, seenAt, now }) {
  const otherName = PEOPLE[PEOPLE[me.who].other].name;
  const field = me.who === "beth" ? "noteFromBeth" : "noteFromBabea";
  const [text, setText] = useState(initial || "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // The saved note arrives async (and refreshes with the board). Reflect it
  // unless something is mid-edit, so typing never gets clobbered.
  const lastInitial = useRef(initial || "");
  useEffect(() => {
    const next = initial || "";
    setText((t) => (t.trim() === lastInitial.current.trim() ? next : t));
    lastInitial.current = next;
  }, [initial]);

  // A save remembers what went out and when, so the aside appears the
  // instant it lands — the `initial` prop only catches up on the next board
  // refresh. While the text matches the last thing sent (this session or the
  // saved record), the aside shows; edit it and the aside steps aside.
  const [lastSent, setLastSent] = useState(null); // { text, at }

  // Unsent means the text differs from the latest thing we know is saved: a
  // send from this session counts immediately, so the button doesn't re-arm
  // while waiting for the board refresh to catch up.
  const savedText = lastSent ? lastSent.text : (initial || "").trim();
  const dirty = text.trim() !== savedText;

  const save = async () => {
    setBusy(true);
    try {
      const res = await store.savePersonal({ [field]: text.trim() });
      const at = res ? res[field + "At"] : undefined;
      setLastSent({
        text: text.trim(),
        at: at !== undefined ? at : new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setBusy(false);
  };

  const sentAtEff =
    lastSent && lastSent.text === text.trim()
      ? lastSent.at
      : !dirty
        ? sentAt
        : null;
  const sentWord = text.trim() ? noteWhenWord(sentAtEff, now) : "";
  // Their board displayed this exact note (a fresh send hasn't been seen yet).
  const seen = !!(seenAt && sentAtEff && seenAt >= sentAtEff);

  return (
    <div className="cs-bethnote">
      <div className="cs-bethnote-label">Leave a note for {otherName}</div>
      <textarea
        className="cs-area"
        style={{ minHeight: 64 }}
        placeholder={
          me.who === "beth"
            ? "Fly safe — miss you already. 🤍"
            : "Long day — I'll call you when I land in Atlanta. 🤍"
        }
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="cs-bethnote-row">
        <button
          className="cs-btn"
          onClick={save}
          disabled={busy || !dirty}
          style={{ padding: "10px 18px" }}
        >
          {busy ? "Saving" : saved ? "Sent 🤍" : `Send to ${otherName}`}
        </button>
        {sentWord ? (
          <span className="cs-bethnote-when">
            Sent {sentWord}
            {seen ? ` · seen by ${otherName} 🤍` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// The other person's latest note, set down in ink, with when they left it.
// Keyed by the text so a fresh note replays the ink-in reveal (a ticking
// time phrase alone doesn't).
function NoteFromOther({ text, name, at, now }) {
  if (!text) return null;
  const when = noteWhenWord(at, now);
  return (
    <blockquote className="cs-note" key={text}>
      <div className="body">{text}</div>
      <div className="label">
        — a note from {name}
        {when ? <span className="cs-note-when"> · {when}</span> : null}{" "}
        <span className="cs-noteheart" aria-hidden="true">
          ♥
        </span>
      </div>
    </blockquote>
  );
}

// The other person's earlier notes, tucked into a fold below the current one.
function NoteThread({ items, name, now }) {
  if (!items || items.length === 0) return null;
  return (
    <details className="cs-note-thread">
      <summary>
        Earlier notes from {name}
        <span className="cs-help-chevron" aria-hidden="true">
          ▸
        </span>
      </summary>
      {items.map((h, i) => (
        <div className="cs-note-thread-item" key={`${h.at || ""}-${i}`}>
          <div className="txt">{h.text}</div>
          {noteWhenWord(h.at, now) ? (
            <div className="when">{noteWhenWord(h.at, now)}</div>
          ) : null}
        </div>
      ))}
    </details>
  );
}

function Viewer({ me, trip, now, refreshedAt, onFlightDeck, onLock }) {
  const s = useMemo(() => tripStatus(trip, now), [trip, now]);
  const [statuses, setStatuses] = useState({});

  // Pull live flight status for legs in a tight window around now (recently
  // departed through the next day or so), so the board can show real delays and
  // landings. Server-side caching keeps it cheap; legs far in the past or future
  // are skipped to avoid spending lookups on flights nobody's watching yet.
  useEffect(() => {
    const legs = (trip && trip.legs) || [];
    const lo = Date.now() - 4 * 3600 * 1000;
    const hi = Date.now() + 26 * 3600 * 1000;
    const relevant = legs.filter((l) => {
      const { dep, arr } = legDates(l);
      return arr.getTime() >= lo && dep.getTime() <= hi;
    });
    if (relevant.length === 0) {
      setStatuses({});
      return;
    }
    let alive = true;
    const pull = async () => {
      const res = await store.flightStatus(relevant);
      if (alive) setStatuses(res || {});
    };
    pull();
    const t = setInterval(pull, 120000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [trip]);

  const [weather, setWeather] = useState({});

  // Current weather where Babe-a is now and everywhere he's still heading, keyed
  // by airport code. "Now" is the most recent leg that has already landed (so
  // his weather stays put through a long overnight), plus every upcoming
  // destination. De-duped, so a multi-leg day only weighs in once per city.
  useEffect(() => {
    const legs = (trip && trip.legs) || [];
    const nowMs = Date.now();
    const sorted = [...legs].sort((a, b) => legDates(a).arr - legDates(b).arr);
    const seen = new Set();
    const places = [];
    const add = (l) => {
      const code = (l.to || "").toUpperCase();
      if (!code || seen.has(code)) return;
      seen.add(code);
      places.push({ code, city: l.toCity || "" });
    };
    // Where he is right now: the last leg already on the ground.
    let current = null;
    sorted.forEach((l) => {
      if (legDates(l).arr.getTime() <= nowMs) current = l;
    });
    if (current) add(current);
    // Everywhere he's still flying to.
    sorted.forEach((l) => {
      if (legDates(l).arr.getTime() > nowMs) add(l);
    });
    if (places.length === 0) {
      setWeather({});
      return;
    }
    let alive = true;
    const pull = async () => {
      const res = await store.weather(places);
      if (alive) setWeather(res || {});
    };
    pull();
    const t = setInterval(pull, 30 * 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [trip]);

  // Personal record: both notes + special date. Re-pulled whenever the trip
  // refreshes, so a new note from the other person shows up on its own.
  const [personal, setPersonal] = useState({
    noteFromBeth: "",
    noteFromBethAt: null,
    noteFromBethSeenAt: null,
    noteFromBabea: "",
    noteFromBabeaAt: null,
    noteFromBabeaSeenAt: null,
    notesFromBeth: [],
    notesFromBabea: [],
    special: null,
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await store.getPersonal();
      if (alive && p) setPersonal(p);
    })();
    return () => {
      alive = false;
    };
  }, [trip]);

  const myName = PEOPLE[me.who].name;
  const otherWho = PEOPLE[me.who].other;
  const otherName = PEOPLE[otherWho].name;
  // The other person's note to me. Notes written before the identity change
  // rode along on the trip record, so fall back to trip.note on Beth's board.
  const noteToMe = (
    me.who === "babea"
      ? personal.noteFromBeth
      : personal.noteFromBabea || (trip && trip.note) || ""
  ).trim();
  // The trip.note fallback predates timestamps, so it never has one.
  const noteToMeAt =
    me.who === "babea"
      ? personal.noteFromBethAt
      : personal.noteFromBabea
        ? personal.noteFromBabeaAt
        : null;
  const myNote = me.who === "beth" ? personal.noteFromBeth : personal.noteFromBabea;
  const myNoteAt =
    me.who === "beth" ? personal.noteFromBethAt : personal.noteFromBabeaAt;
  // When the other person's board displayed MY note (for the "seen" mark).
  const myNoteSeenAt =
    me.who === "beth"
      ? personal.noteFromBethSeenAt
      : personal.noteFromBabeaSeenAt;

  // Reading their note marks it seen, once per note, only while the tab is
  // actually being looked at.
  const theirSeenAt =
    otherWho === "beth"
      ? personal.noteFromBethSeenAt
      : personal.noteFromBabeaSeenAt;
  const seenMarked = useRef(null);
  useEffect(() => {
    if (!noteToMe || !noteToMeAt) return;
    if (theirSeenAt && theirSeenAt >= noteToMeAt) return;
    if (seenMarked.current === noteToMeAt) return;
    if (document.visibilityState !== "visible") return;
    seenMarked.current = noteToMeAt;
    store.markNoteSeen(otherWho);
  }, [noteToMe, noteToMeAt, theirSeenAt, otherWho]);

  // Their earlier notes, beyond the one on display.
  const threadItems = (
    (otherWho === "beth" ? personal.notesFromBeth : personal.notesFromBabea) ||
    []
  )
    .filter((h) => h && h.text && h.text !== noteToMe)
    .slice(0, 5);

  // Whether the in-air ribbon's fold-out map is open. One piece of state for
  // the whole board (the flying leg appears both pinned and in the day list),
  // remembered per device.
  const [mapOpen, setMapOpen] = useState(() => {
    try {
      return localStorage.getItem("cs-map-open") === "1";
    } catch {
      return false;
    }
  });
  const toggleMap = () => {
    setMapOpen((v) => {
      try {
        localStorage.setItem("cs-map-open", v ? "" : "1");
      } catch {
        /* per-device nicety only */
      }
      return !v;
    });
  };

  // "How to read this" opens itself the very first visit, then stays put.
  const [helpOpen] = useState(() => {
    try {
      return !localStorage.getItem("cs-help-seen");
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("cs-help-seen", "1");
    } catch {}
  }, []);

  const updatedWord = refreshedAt
    ? (() => {
        const mins = Math.round((now - refreshedAt) / 60000);
        if (mins < 2) return "just now";
        if (mins < 60) return `${mins} minutes ago`;
        return "over an hour ago";
      })()
    : "";

  const foot = (
    <div className="cs-foot">
      {onFlightDeck ? (
        <span className="cs-link" onClick={onFlightDeck}>
          Flight deck
        </span>
      ) : (
        <span />
      )}
      <span className="cs-link" onClick={onLock}>
        Lock
      </span>
    </div>
  );

  if (s.state === "home") {
    return (
      <div>
        <Greeting now={now} name={myName} />
        <StatusCard
          word="Home"
          tone="home"
          sub={homeMessage(now, me.who)}
          special={personal.special}
          now={now}
        />

        <NoteFromOther text={noteToMe} name={otherName} at={noteToMeAt} now={now} />
        <NoteThread items={threadItems} name={otherName} now={now} />

        <div className="cs-rule" />

        <NoteComposer
          me={me}
          initial={myNote}
          sentAt={myNoteAt}
          seenAt={myNoteSeenAt}
          now={now}
        />

        {updatedWord && <div className="cs-updated">Updated {updatedWord}</div>}
        {foot}
      </div>
    );
  }

  const summary = liveSummary(s, now, statuses, me.who);
  const countdown = homeCountdown(s, now);

  // The leg in the air right now, hoisted to the top for quick access. A leg
  // that has actually landed (per live data) no longer counts, even if its
  // scheduled arrival is still in the future.
  const flyingLeg =
    s.state === "active"
      ? s.sorted.find((l) => {
          const { dep, arr } = legDates(l);
          return now >= dep && now <= arr && !liveLanded(l, statuses);
        })
      : null;

  // The final leg into home gets a heart at the destination end of its ribbon.
  const isHomecoming = (leg) =>
    leg === s.sorted[s.sorted.length - 1] &&
    (leg.to || "").toUpperCase() === HOME_AIRPORT;

  return (
    <div>
      <Greeting now={now} name={myName} />
      <StatusCard
        word={summary.word}
        tone={summary.tone}
        sub={summary.line}
        countdown={countdown}
        special={personal.special}
        now={now}
      />

      {flyingLeg && (
        <div className="cs-pinned">
          <div className="cs-pinned-label">
            <span className="cs-livedot" />
            In the air now
          </div>
          <LegCard
            leg={flyingLeg}
            now={now}
            statuses={statuses}
            weather={weather}
            pinned
            homecoming={isHomecoming(flyingLeg)}
            mapOpen={mapOpen}
            onToggleMap={toggleMap}
          />
        </div>
      )}

      <NoteFromOther text={noteToMe} name={otherName} at={noteToMeAt} now={now} />
      <NoteThread items={threadItems} name={otherName} now={now} />

      <div className="cs-rule" />

      <details className="cs-help" open={helpOpen}>
        <summary className="cs-help-summary">
          How to read this
          <span className="cs-help-chevron" aria-hidden="true">
            ▸
          </span>
        </summary>
        <ul>
          <li>
            Tap any <strong>flight number</strong> to follow it live on
            FlightAware.
          </li>
          <li>
            The <strong>highlighted red card</strong> is the flight in the air
            right now.
          </li>
          <li>
            A <strong>Deadhead</strong> card (dashed edge) is a leg Babe-a is
            riding as a passenger — he is not operating that flight.
          </li>
          <li>
            Times are local to each airport, with Salt Lake (MT) time and the
            weather shown underneath.
          </li>
        </ul>
      </details>

      {(() => {
        // Drop legs that landed a few hours ago so the board only shows what's
        // still ahead; the full trip still drives the status above.
        const visibleLegs = s.sorted.filter(
          (leg) => now < legClearAt(leg, statuses),
        );
        // Group the still-visible legs by their departure date.
        const groups = [];
        visibleLegs.forEach((leg) => {
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
                const i = order++;
                const lay = layoverAfter(
                  leg,
                  s.sorted[s.sorted.indexOf(leg) + 1],
                );
                return (
                  <React.Fragment key={`${gi}-${li}`}>
                    <LegCard
                      leg={leg}
                      now={now}
                      statuses={statuses}
                      weather={weather}
                      homecoming={isHomecoming(leg)}
                      mapOpen={mapOpen}
                      onToggleMap={toggleMap}
                      style={{ animationDelay: `${i * 0.06}s` }}
                    />
                    {lay && (
                      <div
                        className={`cs-layover ${lay.overnight ? "overnight" : ""}`}
                      >
                        {lay.overnight ? "Overnight" : "Layover"} in {lay.place}{" "}
                        · {lay.text}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          );
        });
      })()}

      <NoteComposer
        me={me}
        initial={myNote}
        sentAt={myNoteAt}
        seenAt={myNoteSeenAt}
        now={now}
      />

      {updatedWord && <div className="cs-updated">Updated {updatedWord}</div>}
      {foot}
    </div>
  );
}

function Admin({ trip, onPublish, onBoard }) {
  const [raw, setRaw] = useState("");
  const [legs, setLegs] = useState(trip?.legs ? [...trip.legs] : []);
  const [noteText, setNoteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [showManual, setShowManual] = useState(false);

  // Personal: Beth's incoming note, the outgoing note to her, and the
  // special-date countdown Babe-a sets. The note to Beth lives in the personal
  // record (not on the trip), so it survives a trip being cleared; notes
  // written before that change rode on the trip, hence the fallback.
  const [noteFromBeth, setNoteFromBeth] = useState("");
  const [noteFromBethAt, setNoteFromBethAt] = useState(null);
  const [special, setSpecial] = useState({ date: "", label: "" });
  const [specialMsg, setSpecialMsg] = useState("");
  useEffect(() => {
    (async () => {
      const p = await store.getPersonal();
      setNoteFromBeth(p.noteFromBeth || "");
      setNoteFromBethAt(p.noteFromBethAt || null);
      setNoteText(p.noteFromBabea || trip?.note || "");
      if (p.special)
        setSpecial({
          date: p.special.date || "",
          label: p.special.label || "",
        });
    })();
    // Loads once on mount; the trip fallback is only for the pre-change shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSpecial = async () => {
    setSpecialMsg("");
    try {
      await store.savePersonal({
        special: special.date
          ? { date: special.date, label: special.label }
          : null,
      });
      setSpecialMsg(special.date ? "Countdown saved." : "Countdown cleared.");
    } catch {
      setSpecialMsg("Could not save the countdown.");
    }
  };
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

  // The deadhead tag is just a "DH " prefix on the flight, so a mis-parse is
  // fixed by flipping it here rather than re-entering the whole leg.
  const toggleDeadhead = (i) =>
    setLegs((l) =>
      l.map((leg, idx) =>
        idx === i
          ? {
              ...leg,
              flight: isDeadhead(leg)
                ? flightNumber(leg.flight)
                : "DH " + flightNumber(leg.flight),
            }
          : leg,
      ),
    );

  // Load a leg into the manual form to correct a field; "Add leg" puts it
  // back. The board sorts by time, so its position in this list is cosmetic.
  const editLeg = (i) => {
    const leg = legs[i];
    setDraft({
      date: leg.date || "",
      flight: leg.flight || "",
      from: leg.from || "",
      fromCity: leg.fromCity || "",
      to: leg.to || "",
      toCity: leg.toCity || "",
      depart: leg.depart || "",
      arrive: leg.arrive || "",
    });
    setShowManual(true);
    removeLeg(i);
  };

  const publish = async () => {
    setBusy(true);
    const t = {
      legs,
      updatedAt: new Date().toISOString(),
    };
    try {
      await store.saveTrip(t);
      // The note travels separately so it outlives the trip; saving it here
      // (when changed) also pings Beth's devices.
      await store.savePersonal({ noteFromBabea: noteText.trim() });
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
      setNote("Board cleared. Shows as Home. Your note to Beth stays up.");
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
                <span className="cs-flight">{flightNumber(leg.flight)}</span>
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
              <div className="cs-legedit">
                <span
                  className={`cs-dh-chip ${isDeadhead(leg) ? "on" : ""}`}
                  onClick={() => toggleDeadhead(i)}
                  role="switch"
                  aria-checked={isDeadhead(leg)}
                >
                  {isDeadhead(leg) ? "✓ Deadhead" : "Mark deadhead"}
                </span>
                <span className="cs-manual-link" onClick={() => editLeg(i)}>
                  edit this leg
                </span>
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

      <div style={{ marginTop: 26 }}>
        <span className="cs-lab">Note for Beth · optional</span>
        <textarea
          className="cs-area"
          style={{ minHeight: 70 }}
          placeholder="e.g. Long day — I'll call you when I land in Atlanta."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
        />
      </div>

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

      {noteFromBeth ? (
        <div className="cs-note" style={{ marginTop: 28 }}>
          <div className="label">
            A note from Beth
            {(() => {
              const w = noteWhenWord(noteFromBethAt, new Date());
              return w ? <span className="cs-note-when"> · {w}</span> : null;
            })()}
          </div>
          <div className="body">{noteFromBeth}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 28 }}>
        <span className="cs-lab">Countdown for Beth · optional</span>
        <div className="cs-grid b">
          <input
            className="cs-in"
            type="date"
            value={special.date}
            onChange={(e) =>
              setSpecial((s) => ({ ...s, date: e.target.value }))
            }
          />
          <input
            className="cs-in"
            placeholder="Anniversary"
            value={special.label}
            onChange={(e) =>
              setSpecial((s) => ({ ...s, label: e.target.value }))
            }
          />
        </div>
        <div className="cs-actions" style={{ marginTop: 12 }}>
          <button className="cs-btn ghost" onClick={saveSpecial}>
            Save countdown
          </button>
        </div>
        {specialMsg && <div className="cs-saved">{specialMsg}</div>}
      </div>

      <div className="cs-foot">
        <span />
        <span className="cs-link" onClick={onBoard}>
          Back to your board
        </span>
      </div>
    </div>
  );
}
