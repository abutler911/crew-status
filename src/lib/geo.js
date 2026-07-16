// Map geometry for the fold-out route map: great-circle paths, a frame fitted
// around the route, and a simple equirectangular projection into SVG space.
// Pure functions only, so the map rendering is testable outside React.

const RAD = Math.PI / 180;

// Decodes the delta-encoded integer rings of landdata.js back into
// [[lon, lat], ...] arrays. Done once at load.
export function decodeRings(encoded) {
  return encoded.map((flat) => {
    const pts = new Array(flat.length / 2);
    let x = 0,
      y = 0;
    for (let i = 0; i < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      pts[i / 2] = [x / 100, y / 100];
    }
    return pts;
  });
}

// n+1 points along the great circle from [lat, lon] a to b, as [lon, lat]
// pairs with longitudes unwrapped to be continuous (no ±180 jumps).
export function greatCircle(a, b, n = 64) {
  const [lat1, lon1] = [a[0] * RAD, a[1] * RAD];
  const [lat2, lon2] = [b[0] * RAD, b[1] * RAD];
  const ax = Math.cos(lat1) * Math.cos(lon1);
  const ay = Math.cos(lat1) * Math.sin(lon1);
  const az = Math.sin(lat1);
  const bx = Math.cos(lat2) * Math.cos(lon2);
  const by = Math.cos(lat2) * Math.sin(lon2);
  const bz = Math.sin(lat2);
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  const ang = Math.acos(dot);
  const sin = Math.sin(ang) || 1e-9;
  const pts = [];
  let prevLon = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k1 = Math.sin((1 - t) * ang) / sin;
    const k2 = Math.sin(t * ang) / sin;
    const x = k1 * ax + k2 * bx;
    const y = k1 * ay + k2 * by;
    const z = k1 * az + k2 * bz;
    let lon = Math.atan2(y, x) / RAD;
    const lat = Math.atan2(z, Math.hypot(x, y)) / RAD;
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    prevLon = lon;
    pts.push([lon, lat]);
  }
  return pts;
}

// A frame around the route: padded bounding box, expanded to the given
// width/height aspect (in projected units, where a degree of longitude is
// squeezed by cos of the middle latitude so shapes look right).
export function routeFrame(points, aspect, pad = 0.28, minSpanDeg = 4) {
  let lon0 = Infinity,
    lat0 = Infinity,
    lon1 = -Infinity,
    lat1 = -Infinity;
  for (const [lon, lat] of points) {
    if (lon < lon0) lon0 = lon;
    if (lon > lon1) lon1 = lon;
    if (lat < lat0) lat0 = lat;
    if (lat > lat1) lat1 = lat;
  }
  let dLon = Math.max(lon1 - lon0, minSpanDeg);
  let dLat = Math.max(lat1 - lat0, minSpanDeg);
  lon0 -= dLon * pad;
  lon1 += dLon * pad;
  lat0 -= dLat * pad;
  lat1 += dLat * pad;
  dLon = lon1 - lon0;
  dLat = lat1 - lat0;

  const midLat = (lat0 + lat1) / 2;
  const kx = Math.max(0.2, Math.cos(midLat * RAD));
  // Projected extents; grow the short side to match the panel's aspect.
  const w = dLon * kx;
  const h = dLat;
  if (w / h > aspect) {
    const grow = w / aspect - h;
    lat0 -= grow / 2;
    lat1 += grow / 2;
  } else {
    const grow = (h * aspect - w) / kx;
    lon0 -= grow / 2;
    lon1 += grow / 2;
  }
  // Keep the frame on the map.
  if (lat1 > 85) {
    lat0 -= lat1 - 85;
    lat1 = 85;
  }
  if (lat0 < -85) {
    lat1 += -85 - lat0;
    lat0 = -85;
  }
  return { lon0, lon1, lat0, lat1, kx };
}

// Projection into a width x height SVG box for a frame from routeFrame.
export function projector(frame, width, height) {
  const { lon0, lon1, lat0, lat1, kx } = frame;
  const sx = width / ((lon1 - lon0) * kx);
  const sy = height / (lat1 - lat0);
  return ([lon, lat]) => [
    (lon - lon0) * kx * sx,
    (lat1 - lat) * sy,
  ];
}

// Which whole-world copies (lon shifted by k*360) can intersect the frame.
// Land longitudes live in [-180, 180]; a route across the antimeridian
// produces a frame outside that range, so the land needs shifted copies.
export function worldCopies(frame) {
  const copies = [];
  for (let k = -1; k <= 1; k++) {
    if (frame.lon1 >= -180 + 360 * k && frame.lon0 <= 180 + 360 * k) {
      copies.push(360 * k);
    }
  }
  return copies;
}

// SVG path for a ring/line of [lon, lat] points through a projector,
// skipping anything entirely outside the frame (cheap bbox test).
export function pathFor(points, frame, proj, lonShift = 0, close = false) {
  let lon0 = Infinity,
    lat0 = Infinity,
    lon1 = -Infinity,
    lat1 = -Infinity;
  for (const [lon, lat] of points) {
    const l = lon + lonShift;
    if (l < lon0) lon0 = l;
    if (l > lon1) lon1 = l;
    if (lat < lat0) lat0 = lat;
    if (lat > lat1) lat1 = lat;
  }
  if (lon1 < frame.lon0 || lon0 > frame.lon1 || lat1 < frame.lat0 || lat0 > frame.lat1) {
    return "";
  }
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const [x, y] = proj([points[i][0] + lonShift, points[i][1]]);
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return close ? d + "Z" : d;
}

// Graticule spacing that gives a handful of lines across the frame.
export function graticuleStep(frame) {
  const span = Math.max(frame.lon1 - frame.lon0, frame.lat1 - frame.lat0);
  for (const s of [1, 2, 5, 10, 20, 30]) {
    if (span / s <= 8) return s;
  }
  return 45;
}
