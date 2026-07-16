// Builds src/lib/landdata.js: world land outlines (Natural Earth 50m via
// world-atlas, simplified) plus US state boundary lines (110m). Rings are
// encoded as flat integer arrays of [lon*100, lat*100] deltas to keep the
// module small; the app decodes them once, on the map's first unfold.
//
// The inputs aren't project dependencies — this runs rarely, so fetch them
// into a scratch directory and run from there:
//
//   npm i --no-save world-atlas@2 topojson-client
//   curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_1_states_provinces_lines.geojson
//   node scripts/build-landdata.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/land-50m.json"));
const land = feature(topo, topo.objects.land);

// Douglas-Peucker in degrees.
function simplify(points, eps) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    let maxD = -1, maxI = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > eps * eps) {
      keep[maxI] = 1;
      stack.push([a, maxI], [maxI, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function bboxDiag(points) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of points) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return Math.hypot(x1 - x0, y1 - y0);
}

// Natural Earth wraps longitudes to [-180, 180], so a ring that crosses the
// antimeridian jumps +-360 mid-ring and draws as a streak across the map.
// Unwrap each ring to be continuous, keeping its first point in range.
function unwrap(points) {
  const out = [];
  let prev = null;
  for (const [x, y] of points) {
    let lon = x;
    if (prev !== null) {
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
    }
    prev = lon;
    out.push([lon, y]);
  }
  return out;
}

// Quantize to 0.01 deg and delta-encode.
function encode(points) {
  const out = [];
  let px = 0, py = 0;
  for (const [x, y] of points) {
    const qx = Math.round(x * 100), qy = Math.round(y * 100);
    if (out.length && qx === px && qy === py) continue;
    out.push(qx - px, qy - py);
    px = qx; py = qy;
  }
  return out;
}

const EPS = 0.04;      // ~4 km simplification tolerance
const MIN_DIAG = 0.45; // drop islands smaller than ~half a degree across

const landRings = [];
for (const geom of land.features ?? [land]) {
  const g = geom.geometry ?? geom;
  const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  for (const poly of polys) {
    const outer = unwrap(poly[0]); // outer ring only; lakes don't matter here
    if (bboxDiag(outer) < MIN_DIAG) continue;
    const simp = simplify(outer, EPS);
    if (simp.length >= 4) landRings.push(encode(simp));
  }
}

const statesRaw = JSON.parse(
  readFileSync("ne_110m_admin_1_states_provinces_lines.geojson")
);
const stateLines = [];
for (const f of statesRaw.features) {
  if (f.properties?.ADM0_A3 !== "USA") continue;
  const g = f.geometry;
  const lines = g.type === "MultiLineString" ? g.coordinates : [g.coordinates];
  for (const line of lines) {
    const simp = simplify(line, EPS);
    if (simp.length >= 2) stateLines.push(encode(simp));
  }
}

const header =
  "// Generated file - do not edit by hand.\n" +
  "// World land outlines (Natural Earth 50m via world-atlas, simplified) and\n" +
  "// US state boundary lines (Natural Earth 110m). Each ring/line is a flat\n" +
  "// delta-encoded integer array: [lon*100, lat*100, dlon, dlat, ...].\n";

const body =
  header +
  "export const LAND = " + JSON.stringify(landRings) + ";\n" +
  "export const STATE_LINES = " + JSON.stringify(stateLines) + ";\n";

writeFileSync("src/lib/landdata.js", body);
const ringPts = landRings.reduce((n, r) => n + r.length / 2, 0);
const linePts = stateLines.reduce((n, r) => n + r.length / 2, 0);
console.log(
  `land rings: ${landRings.length} (${ringPts} pts), state lines: ${stateLines.length} (${linePts} pts), bytes: ${body.length}`
);
