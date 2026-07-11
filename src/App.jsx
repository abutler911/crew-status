import React, { useState, useEffect, useMemo } from "react";
import * as store from "./lib/store.js";
import * as push from "./lib/push.js";

// The access codes no longer live here. They are environment variables on the
// server, and the gate checks them through /api/auth. Nothing secret ships to
// the browser anymore.

const css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Great+Vibes&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@1,400;1,500&display=swap');

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

/* ---- dark theme ---- */
.cs-root.dark {
  --ink: #15110e;
  --surface: #211d19;
  --surface-2: #2a2521;
  --line: rgba(244,241,236,0.14);
  --text: #f4f1ec;
  --muted: #c2bab0;
  --faint: #8c857b;
  --crimson: #ef5564;
  --crimson-dim: rgba(239,85,100,0.16);
}
.cs-root.dark .cs-leg.active { background: rgba(239,85,100,0.12); }
.cs-root.dark .cs-saved { color: #4cc47e; }
.cs-root.dark .cs-live.ok { background: rgba(76,196,126,0.12); }
.cs-root.dark .cs-live.ok .cs-livetag { background: #2e9c5b; }

/* ---- theme toggle ---- */
.cs-theme-toggle {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 12px);
  right: 12px;
  z-index: 50;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.cs-theme-toggle:hover { color: var(--crimson); border-color: var(--crimson); }
.cs-theme-toggle:active { transform: translateY(1px); }
.cs-theme-toggle svg { display: block; }

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

/* ---- status card ---- */
/* One quiet object at the top instead of a stack of competing boxes: the
   headline status, a one-line answer, and small meta chips for the things
   Beth glances for (when he's home, any shared date). */
.cs-card {
  margin-top: 4px;
  padding: 24px 24px 22px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
.cs-card-word {
  font-size: 48px;
  font-weight: 500;
  line-height: 1.02;
  letter-spacing: -0.015em;
  color: var(--text);
}
.cs-card-sub {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 21px;
  line-height: 1.35;
  color: var(--muted);
  margin-top: 10px;
}
.cs-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}
.cs-chip {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 9px 13px;
  border-radius: 11px;
  background: var(--surface-2);
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 17px;
  line-height: 1.2;
  color: var(--text);
}
.cs-chip-home { background: var(--crimson-dim); }
.cs-chip-icon { color: var(--crimson); font-size: 15px; }
.cs-chip-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--crimson);
  padding: 3px 8px;
  border: 1px solid var(--crimson);
  border-radius: 999px;
}
.cs-rule { height: 1px; background: var(--line); margin: 30px 0; }

/* ---- note from Babe-a ---- */
/* A handwritten aside, not another bordered card — just a crimson margin
   rule and the words. The rule inks itself in first and the words follow,
   like the note is being set down while she watches. */
.cs-note {
  margin-top: 22px;
  padding-left: 16px;
  position: relative;
}
.cs-note::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--crimson);
  transform: scaleY(0);
  transform-origin: top;
  animation: noteink 0.7s cubic-bezier(0.2,0.7,0.2,1) forwards;
}
.cs-note .body {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 23px;
  line-height: 1.4;
  font-style: italic;
  color: var(--text);
}
.cs-note .body,
.cs-note .label {
  opacity: 0;
  animation: notefade 0.9s ease 0.35s forwards;
}
.cs-note .label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
  margin-top: 9px;
}
.cs-noteheart {
  display: inline-block;
  color: var(--crimson);
  margin-left: 3px;
  font-size: 12px;
  animation: heartbeat 2.8s ease-in-out 1.6s infinite;
}
@keyframes noteink { to { transform: scaleY(1); } }
@keyframes notefade { to { opacity: 1; } }
/* two quick thumps, then a long rest — a heartbeat, not a strobe */
@keyframes heartbeat {
  0%, 24%, 100% { transform: scale(1); }
  6% { transform: scale(1.3); }
  12% { transform: scale(1); }
  18% { transform: scale(1.22); }
}

/* ---- layover between legs ---- */
.cs-layover {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -4px 0 14px 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  letter-spacing: 0.06em;
  color: var(--faint);
}
.cs-layover::before {
  content: '';
  width: 1px;
  height: 16px;
  background: var(--line);
  margin-left: 11px;
}
.cs-layover.overnight { color: var(--crimson); }

/* ---- live flight status ---- */
.cs-live {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
  padding: 11px 14px;
  border-radius: 9px;
  background: var(--surface-2);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.01em;
}
.cs-live .cs-livetag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #fff;
  padding: 4px 10px;
  border-radius: 999px;
}
.cs-live .cs-livedot2 {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.cs-live .cs-livetext {
  font-weight: 500;
  line-height: 1.45;
  color: var(--text);
}
.cs-live.ok { background: rgba(31,122,68,0.08); }
.cs-live.ok .cs-livetag { background: #1f7a44; }
.cs-live.warn { background: rgba(176,106,0,0.10); }
.cs-live.warn .cs-livetag { background: #b06a00; }
.cs-live.bad { background: var(--crimson-dim); }
.cs-live.bad .cs-livetag { background: var(--crimson); }
.cs-live.warn .cs-livedot2,
.cs-live.bad .cs-livedot2 { animation: livepulse 1.4s ease-in-out infinite; }

/* ---- weather at destination ---- */
.cs-wx {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--muted);
  max-width: 100%;
}
.cs-wx .cs-wx-emoji { font-size: 14px; line-height: 1; }
.cs-wx .cs-wx-label {
  color: var(--faint);
  font-weight: 400;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- redesigned leg card: route / times / weather ---- */
.cs-route2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}
.cs-end { min-width: 0; }
.cs-end.to { text-align: right; }
.cs-end .cs-city { margin-top: 4px; }

.cs-times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}
.cs-tcol { min-width: 0; }
.cs-tcol.to { text-align: right; }
.cs-tlabel {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 5px;
}
.cs-times .cs-time { margin-top: 0; font-size: 17px; }
.cs-times .cs-tzhint { margin-top: 3px; }

.cs-wx2 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--muted);
}
.cs-wx2 .cs-wx-emoji { font-size: 15px; line-height: 1; }
.cs-wx2 .cs-wx-temp { font-weight: 600; color: var(--text); }
.cs-wx2 .cs-wx-where { color: var(--faint); }

/* in-air flight progress */
.cs-prog { margin-top: 18px; }
.cs-prog-track {
  position: relative;
  height: 3px;
  border-radius: 999px;
  background: rgba(190,38,57,0.18);
  margin: 0 6px 10px;
}
.cs-prog-fill {
  position: relative;
  height: 100%;
  border-radius: 999px;
  background: var(--crimson);
  transition: width 0.6s ease;
}
.cs-prog-plane {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  line-height: 1;
}
.cs-prog-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--faint);
}
.cs-prog-eta { color: var(--crimson); font-weight: 700; }

/* pinned in-air card, hoisted to the top */
.cs-pinned { margin-top: 20px; }
.cs-pinned-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--crimson);
  margin-bottom: 10px;
}
.cs-leg.pinned {
  opacity: 1;
  animation: none;
  transform: none;
  margin-bottom: 0;
}

/* ---- how-to-read helper ---- */
.cs-help {
  margin-bottom: 22px;
  padding: 14px 18px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}
.cs-help-summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
}
.cs-help-summary::-webkit-details-marker { display: none; }
.cs-help-chevron {
  color: var(--crimson);
  font-size: 12px;
  transition: transform 0.18s ease;
}
.cs-help[open] .cs-help-chevron { transform: rotate(90deg); }
.cs-help[open] .cs-help-summary { margin-bottom: 11px; }
.cs-help ul { list-style: none; margin: 0; padding: 0; }
.cs-help li {
  position: relative;
  padding-left: 18px;
  font-size: 16px;
  line-height: 1.4;
  color: var(--muted);
  margin-bottom: 6px;
}
.cs-help li:last-child { margin-bottom: 0; }
.cs-help li::before {
  content: '·';
  position: absolute;
  left: 6px;
  color: var(--crimson);
  font-weight: 700;
}
.cs-help strong { color: var(--text); font-weight: 600; }

/* ---- credit footer ---- */
.cs-credit {
  position: relative;
  width: 100%;
  max-width: 560px;
  margin-top: 48px;
  padding-top: 24px;
  text-align: center;
}
.cs-credit::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 1px;
  background: var(--line);
}
.cs-credit-line {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  font-style: italic;
  line-height: 1.3;
  color: var(--muted);
}
.cs-credit-line .cs-heart {
  color: var(--crimson);
  font-style: normal;
  font-size: 15px;
  margin: 0 2px;
}
.cs-credit-year {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
  margin-top: 9px;
  white-space: nowrap;
}

/* ---- personalization: greeting ---- */
/* "Good evening" in Playfair's romantic italic, and her name in Great Vibes —
   a real calligraphy script, run larger because script faces render small. */
.cs-greet {
  font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
  font-size: 21px;
  font-style: italic;
  color: var(--muted);
  margin-bottom: 14px;
}
.cs-greet span {
  font-family: 'Great Vibes', cursive;
  font-size: 34px;
  font-style: normal;
  font-weight: 400;
  line-height: 1;
  color: var(--crimson);
  margin-left: 2px;
}

/* ---- the #4eva bubble ---- */
/* A glossy little soap-bubble that floats over the status card's top-right
   corner, in front of everything else. It sits below the greeting's text
   line so it can never cover Beth's name, even when the wide "Good
   afternoon" wording is up, and pointer-events: none so it never blocks
   a tap. */
.cs-greet { position: relative; }
.cs-4eva {
  position: absolute;
  top: 32px;
  right: 0;
  z-index: 60;
  width: 74px;
  height: 74px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 28%,
    color-mix(in srgb, var(--crimson) 55%, #fff) 0%,
    var(--crimson) 55%,
    color-mix(in srgb, var(--crimson) 55%, #000) 100%);
  box-shadow:
    0 12px 26px var(--crimson-dim),
    0 6px 16px rgba(20,18,16,0.25),
    inset 0 1px 2px rgba(255,255,255,0.45),
    inset 0 -6px 12px rgba(0,0,0,0.18);
  animation: cs-4eva-float 4.5s ease-in-out infinite;
  pointer-events: none;
}
.cs-4eva::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 14px;
  width: 26px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255,255,255,0.55);
  filter: blur(3px);
  transform: rotate(-24deg);
}
.cs-greet .cs-4eva span {
  font-family: 'Great Vibes', cursive;
  font-size: 25px;
  line-height: 1;
  color: #fff;
  margin: 0;
  transform: rotate(-8deg);
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
@keyframes cs-4eva-float {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-9px) rotate(3deg); }
}
@media (prefers-reduced-motion: reduce) {
  .cs-4eva { animation: none; }
}

/* a note from Beth */
.cs-bethnote { margin-top: 30px; }
.cs-bethnote-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 8px;
}
.cs-bethnote-row { margin-top: 10px; }

/* accent swatches */
.cs-accent {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}
.cs-accent-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--faint);
}
.cs-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
.cs-swatch.sel { border-color: var(--text); }

/* notifications opt-in / opt-out */
.cs-notif {
  width: 100%;
  max-width: 360px;
  margin: 0 auto 22px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  text-align: left;
}
.cs-notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.cs-notif-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text);
  font-weight: 700;
}
.cs-notif-sub {
  font-size: 13px;
  color: var(--muted);
  margin-top: 3px;
  line-height: 1.35;
}
.cs-notif-note {
  font-size: 12px;
  color: var(--crimson);
  margin-top: 10px;
  line-height: 1.35;
}
.cs-switch {
  flex: 0 0 auto;
  width: 46px;
  height: 28px;
  border-radius: 999px;
  border: none;
  padding: 0;
  position: relative;
  cursor: pointer;
  background: var(--line);
  transition: background 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}
.cs-switch.on { background: var(--crimson); }
.cs-switch:disabled { opacity: 0.6; cursor: default; }
.cs-switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  transition: transform 0.18s ease;
}
.cs-switch.on .cs-switch-knob { transform: translateX(18px); }

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

/* Deadhead: a leg Babe-a rides as a passenger, not one he operates. Muted,
   dashed-edge styling so it reads as clearly distinct from his own flights. */
.cs-leg.deadhead {
  border-style: dashed;
  background: var(--surface-2);
}
.cs-leg.deadhead .cs-flight { color: var(--muted); }
.cs-leg.deadhead a.cs-flight { border-bottom-color: rgba(120,120,120,0.4); }
.cs-dh {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  margin-top: -6px;
}
.cs-dh-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 10px;
}
.cs-dh-note {
  font-size: 13px;
  font-style: italic;
  color: var(--faint);
}

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

.cs-route { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 14px; }
.cs-port { min-width: 0; }
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
  .cs-note::before { animation: none !important; transform: none; }
  .cs-note .body, .cs-note .label { animation: none !important; opacity: 1; }
  .cs-noteheart { animation: none !important; }
}
@media (max-width: 480px) {
  .cs-gate h1 { font-size: 42px; }
  .cs-gate { margin-top: 10vh; }
  .cs-card { padding: 20px 18px; }
  .cs-card-word { font-size: 38px; }
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

  if (st.cancelled) return { tone: "bad", text: "Canceled" };
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

// Time-of-day greeting for Beth.
function greetingWord(now) {
  const h = now.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

// Warm rotating messages for the home screen, stable across a given day.
const HOME_MESSAGES = [
  "He's home — soak up every minute. 🤍",
  "No flights on the board. Enjoy each other. 🤍",
  "Grounded and right where he belongs. 🤍",
  "Home sweet home. Make it count. 🤍",
  "He's all yours today. 🤍",
];
function homeMessage(now) {
  const start = new Date(now.getFullYear(), 0, 0);
  const doy = Math.floor((now - start) / 86400000);
  return HOME_MESSAGES[doy % HOME_MESSAGES.length];
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
function liveSummary(s, now, statuses) {
  if (s.state === "home") {
    return { word: "Home", line: "Babe-a is home right now." };
  }
  const sorted = s.sorted;

  // In the air on a specific leg? Only if it hasn't actually landed yet.
  for (const leg of sorted) {
    const { dep, arr } = legDates(leg);
    if (now >= dep && now <= arr && !liveLanded(leg, statuses)) {
      const from = leg.fromCity || leg.from;
      const to = leg.toCity || leg.to;
      const verb = isDeadhead(leg)
        ? "is deadheading (riding as a passenger)"
        : "is flying";
      return {
        word: "In the air",
        line: `Babe-a ${verb} from ${from} to ${to}, ${landingPhrase(leg, statuses)}.`,
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
      line: `Babe-a leaves ${whenWord(next.date, now)} at ${fmtTime(next.depart)}.`,
    };
  }

  const lastLanded = past[past.length - 1];
  const place = lastLanded.toCity || lastLanded.to;

  // Landed at home with nothing else on the books: the trip is actually over.
  if (!next && lastLanded.to === HOME_AIRPORT) {
    return { word: "Back home", line: "Babe-a is back home now." };
  }

  // No more legs in hand yet. He's not home, so it's an overnight, not "back home."
  if (!next) {
    return {
      word: "Overnight",
      line: `Babe-a is in ${place} on the overnight.`,
    };
  }

  // Flying again later today: give a countdown instead of a day label.
  if (dayLabel(next.date, now) === "Today") {
    return {
      word: "On the ground",
      line: `Babe-a is in ${place} right now. Next flight in ${humanizeDuration(legDates(next).dep - now)}.`,
    };
  }

  // Last leg of the day is down; the next one isn't until a later day.
  return {
    word: "Overnight",
    line: `Babe-a is in ${place} on the overnight. Next flight ${whenWord(next.date, now)} at ${fmtTime(next.depart)}.`,
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
        <style>{css}</style>
        <div
          className="cs-shell mono"
          style={{
            marginTop: "20vh",
            color: "var(--faint)",
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
    <div
      className={`cs-root ${theme === "dark" ? "dark" : ""}`}
      style={rootStyle}
    >
      <style>{css}</style>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
      <footer className="cs-credit">
        {(screen === "viewer" || screen === "admin") && <NotificationToggle />}
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
      <div className="cs-eyebrow">Private access</div>
      <h1>
        Where's <em>Babe-a</em>?
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
function LegCard({ leg, now, statuses, weather, pinned, style }) {
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
        <div className="cs-prog">
          <div className="cs-prog-track">
            <div className="cs-prog-fill" style={{ width: `${progress}%` }}>
              <span className="cs-prog-plane">✈</span>
            </div>
          </div>
          <div className="cs-prog-meta">
            <span>{leg.from}</span>
            <span className="cs-prog-eta">{etaText}</span>
            <span>{leg.to}</span>
          </div>
        </div>
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

// An opt-in / opt-out switch for push notifications (departures, landings, and
// delays). It only shows when this browser can do push AND the server has push
// configured, so it stays invisible rather than broken when either is missing.
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
            Departures, landings &amp; delays for the current trip.
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

// "Good morning, Beth" at the very top of every screen, with the little
// #4eva bubble floating alongside it.
function Greeting({ now }) {
  return (
    <div className="cs-greet">
      {greetingWord(now)}, <span>Beth</span>
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
function StatusCard({ word, sub, countdown, special, now }) {
  const specialWords =
    special && special.date ? untilWords(special.date, now) : null;
  const hasMeta = countdown || specialWords;
  return (
    <div className="cs-card">
      <div className="cs-card-word">{word}</div>
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

// Lets Beth leave a short note that Babe-a sees in the admin.
function BethNote({ initial }) {
  const [text, setText] = useState(initial || "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = text.trim() !== (initial || "").trim();

  const save = async () => {
    setBusy(true);
    try {
      await store.savePersonal({ bethNote: text.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setBusy(false);
  };

  return (
    <div className="cs-bethnote">
      <div className="cs-bethnote-label">Leave a note for Babe-a</div>
      <textarea
        className="cs-area"
        style={{ minHeight: 64 }}
        placeholder="Fly safe — miss you already. 🤍"
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
          {busy ? "Saving" : saved ? "Sent 🤍" : "Send to Babe-a"}
        </button>
      </div>
    </div>
  );
}

function Viewer({ trip, now, onLock }) {
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

  // Personal record: Beth's note + special date.
  const [personal, setPersonal] = useState({ bethNote: "", special: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await store.getPersonal();
      if (alive) setPersonal(p || { bethNote: "", special: null });
    })();
    return () => {
      alive = false;
    };
  }, [trip]);

  if (s.state === "home") {
    return (
      <div>
        <Greeting now={now} />
        <StatusCard
          word="Home"
          sub={homeMessage(now)}
          special={personal.special}
          now={now}
        />

        <div className="cs-rule" />

        <BethNote initial={personal.bethNote} />

        <div className="cs-foot">
          <span />
          <span className="cs-link" onClick={onLock}>
            Lock
          </span>
        </div>
      </div>
    );
  }

  const summary = liveSummary(s, now, statuses);
  const countdown = homeCountdown(s, now);
  const note = (trip && trip.note ? trip.note : "").trim();

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

  return (
    <div>
      <Greeting now={now} />
      <StatusCard
        word={summary.word}
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
          />
        </div>
      )}

      {note && (
        /* keyed by the text so a fresh note replays the ink-in reveal */
        <blockquote className="cs-note" key={note}>
          <div className="body">{note}</div>
          <div className="label">
            — a note from Babe-a{" "}
            <span className="cs-noteheart" aria-hidden="true">
              ♥
            </span>
          </div>
        </blockquote>
      )}

      <div className="cs-rule" />

      <details className="cs-help">
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

      <BethNote initial={personal.bethNote} />

      <div className="cs-foot">
        <span />
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
  const [noteText, setNoteText] = useState(trip?.note || "");
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [showManual, setShowManual] = useState(false);

  // Personal: Beth's incoming note, and the special-date countdown Babe-a sets.
  const [bethNote, setBethNote] = useState("");
  const [special, setSpecial] = useState({ date: "", label: "" });
  const [specialMsg, setSpecialMsg] = useState("");
  useEffect(() => {
    (async () => {
      const p = await store.getPersonal();
      setBethNote(p.bethNote || "");
      if (p.special)
        setSpecial({
          date: p.special.date || "",
          label: p.special.label || "",
        });
    })();
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

  const publish = async () => {
    setBusy(true);
    const t = {
      legs,
      note: noteText.trim(),
      updatedAt: new Date().toISOString(),
    };
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
    const t = { legs: [], note: "", updatedAt: new Date().toISOString() };
    try {
      await store.saveTrip(t);
      await onPublish(t);
      setLegs([]);
      setRaw("");
      setNoteText("");
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

      {bethNote ? (
        <div className="cs-note" style={{ marginTop: 28 }}>
          <div className="label">A note from Beth</div>
          <div className="body">{bethNote}</div>
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
        <span className="cs-link" onClick={onExit}>
          Exit
        </span>
      </div>
    </div>
  );
}
