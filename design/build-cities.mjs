/**
 * Pick the background cities from real coordinates, spread evenly.
 *
 * The dataset has no population, so choosing "the biggest N" is not available.
 * Greedy spatial thinning instead: walk the list and keep a city only if it is
 * at least MIN_SEP degrees from everything already kept. That gives an even
 * scatter across the country rather than a clot around Kerala, which is what a
 * raw sample looks like.
 *
 * Source: github.com/lutangar/cities.json (geonames-derived).
 */
import { readFileSync, writeFileSync } from 'node:fs';

const all = JSON.parse(readFileSync('c.json', 'utf8'));
const proj = JSON.parse(readFileSync('india-path.json', 'utf8')).projection;
const { minLon, maxLat } = JSON.parse(readFileSync('india-path.json', 'utf8')).bounds;

// The eighteen the simulator actually models — seeded first so thinning can
// never drop one, and so nothing lands on top of them.
const SIM = [
  [19.08, 72.88], [28.61, 77.21], [12.97, 77.59], [17.39, 78.49], [13.08, 80.27], [18.52, 73.86],
  [26.91, 75.79], [26.85, 80.95], [9.93, 76.27], [22.72, 75.86], [30.73, 76.78], [11.02, 76.96],
  [26.14, 91.74], [21.25, 81.63], [26.24, 73.02], [11.66, 78.15], [17.97, 79.59], [26.73, 88.43],
];

const india = all
  .filter((c) => c.country === 'IN')
  .map((c) => [Number(c.lat), Number(c.lng)])
  .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))
  .filter((c) => c[0] >= 8 && c[0] <= 37.2 && c[1] >= 68 && c[1] <= 97.5);

console.log(`cities in India in the dataset: ${india.length}`);

const MIN_SEP = 1.05;      // degrees; about 115 km
const SIM_SEP = 0.9;       // keep clear of the eighteen
const TARGET = 150;

const far = (a, b, sep) => Math.hypot(a[0] - b[0], a[1] - b[1]) >= sep;

const kept = [];
for (const c of india) {
  if (kept.length >= TARGET) break;
  if (!SIM.every((s) => far(c, s, SIM_SEP))) continue;
  if (!kept.every((k) => far(c, k, MIN_SEP))) continue;
  kept.push(c);
}

const X = (lon) => +((lon - minLon) * proj.scale + proj.offX).toFixed(1);
const Y = (lat) => +((maxLat - lat) * proj.scale + proj.offY).toFixed(1);

const pts = kept.map((c) => [X(c[1]), Y(c[0])]);
writeFileSync('india-cities.json', JSON.stringify(pts));

console.log(`kept after thinning: ${kept.length}`);
console.log(`lat spread ${Math.min(...kept.map((c) => c[0])).toFixed(1)}..${Math.max(...kept.map((c) => c[0])).toFixed(1)}`);
console.log(`lon spread ${Math.min(...kept.map((c) => c[1])).toFixed(1)}..${Math.max(...kept.map((c) => c[1])).toFixed(1)}`);
console.log(`json size: ${JSON.stringify(pts).length} chars`);
