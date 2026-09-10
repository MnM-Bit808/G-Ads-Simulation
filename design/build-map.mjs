/**
 * Turn DataMeet's India boundary into an SVG path, by arithmetic rather than by
 * eye. Douglas-Peucker down from 242,146 points to something a browser can draw,
 * then projected with equal scale on both axes.
 *
 * Source: github.com/datameet/maps, Country/india-composite.geojson.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const g = JSON.parse(readFileSync('india-raw.geojson', 'utf8'));
const geom = g.features[0].geometry;
const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

/** Perpendicular distance from p to the line ab, in degrees. */
const perp = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const den = Math.hypot(dx, dy);
  if (den === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / den;
};

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  let worst = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const d = perp(pts[i], pts[0], pts[pts.length - 1]);
    if (d > worst) { worst = d; idx = i; }
  }
  if (worst <= tol) return [pts[0], pts[pts.length - 1]];
  const left = simplify(pts.slice(0, idx + 1), tol);
  const right = simplify(pts.slice(idx), tol);
  return left.slice(0, -1).concat(right);
}

const ringArea = (r) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i, i += 1) {
    a += (r[j][0] * r[i][1]) - (r[i][0] * r[j][1]);
  }
  return Math.abs(a / 2);
};

// Outer rings only, biggest first: mainland, then the larger islands.
const rings = polys.map((p) => p[0]).sort((a, b) => ringArea(b) - ringArea(a));

// One tolerance for the mainland, a looser one for islands, chosen so the whole
// country lands near 700 points - enough for Saurashtra and the Rann to survive.
const MAINLAND_TOL = 0.02;
const ISLAND_TOL = 0.05;
const MIN_ISLAND_AREA = 0.06;

const kept = [];
kept.push(simplify(rings[0], MAINLAND_TOL));
for (const r of rings.slice(1)) {
  if (ringArea(r) < MIN_ISLAND_AREA) continue;
  const s = simplify(r, ISLAND_TOL);
  if (s.length >= 6) kept.push(s);
}

// Projection: equal scale on both axes over the mainland's own bounds, so the
// aspect ratio is the country's rather than the viewBox's.
const all = kept.flat();
const lons = all.map((p) => p[0]);
const lats = all.map((p) => p[1]);
const minLon = Math.min(...lons);
const maxLon = Math.max(...lons);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);

const W = 450;
const H = 470;
const PAD = 14;
const scale = Math.min((W - PAD * 2) / (maxLon - minLon), (H - PAD * 2) / (maxLat - minLat));
const offX = (W - (maxLon - minLon) * scale) / 2;
const offY = (H - (maxLat - minLat) * scale) / 2;

const X = (lon) => +((lon - minLon) * scale + offX).toFixed(1);
const Y = (lat) => +((maxLat - lat) * scale + offY).toFixed(1);

const paths = kept.map((r) => r.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p[0])} ${Y(p[1])}`).join('') + 'Z');

writeFileSync('india-path.json', JSON.stringify({
  d: paths.join(' '),
  points: kept.reduce((n, r) => n + r.length, 0),
  rings: kept.length,
  bounds: { minLon, maxLon, minLat, maxLat },
  projection: { scale, offX, offY, W, H },
}, null, 2));

console.log(`rings kept: ${kept.length}`);
console.log(`points: ${kept.reduce((n, r) => n + r.length, 0)} (from ${rings[0].length} on the mainland alone)`);
console.log(`path length: ${paths.join(' ').length} chars`);
console.log(`bounds: lon ${minLon.toFixed(2)}..${maxLon.toFixed(2)}, lat ${minLat.toFixed(2)}..${maxLat.toFixed(2)}`);
console.log(`X(72.88)=${X(72.88)} Y(19.08)=${Y(19.08)}  <- Mumbai`);
console.log(`X(91.74)=${X(91.74)} Y(26.14)=${Y(26.14)}  <- Guwahati`);
