/**
 * The map's named cities, placed from the geonames-derived dataset
 * (github.com/lutangar/cities.json, downloaded 2026-09-14 with the owner's yes,
 * 17,088,846 bytes), through the projection INDIA_PATH was drawn with
 * (ui/india-map.js). Run from the folder holding cities.json:
 *
 *   node <repo>/design/build-city-points.mjs cities.json
 *
 * It prints CITY_POINTS to paste into ui/india-map.js, and how far each city
 * already on the map moved. A name the dataset spells differently, or holds
 * more than once in India, is resolved in PICK; any other name that does not
 * match exactly once stops the run.
 */
import { readFileSync } from 'node:fs';
import { LOCATIONS } from '../content/locations.js';
import { CITY_POINTS } from '../ui/india-map.js';

// The projection INDIA_PATH uses, checked: Mumbai (19.08 N, 72.88 E) lands on
// the [82, 285.6] the map already had for it.
const SCALE = 14.440516664936647;
const X = (lon) => +((lon - 68.17202758800005) * SCALE + 14).toFixed(1);
const Y = (lat) => +((37.095811 - lat) * SCALE + 25.452819565539272).toFixed(1);

/**
 * Where the game's name is not the dataset's, or the dataset holds the name
 * more than once in India. `admin1` is the dataset's state code; `lat` narrows
 * to a band when one state holds the name twice.
 */
const PICK = {
  // The dataset has no "Delhi NCR"; the capital's own entry stands for it.
  'Delhi NCR': { name: 'New Delhi' },
  // Each of these has a namesake in another state; the city meant is the one
  // in the state named here, by the dataset's code.
  Chandigarh: { admin1: '05' },
  Raipur: { admin1: '37' },
  Jodhpur: { admin1: '24' },
  Gorakhpur: { admin1: '36' },
  // Three entries, two in the same state: the city of the lakes is the
  // southern one of those two.
  Udaipur: { admin1: '24', lat: [24, 25] },
};

const all = JSON.parse(readFileSync(process.argv[2], 'utf8')).filter((c) => c.country === 'IN');
const out = {};
const problems = [];
for (const name of LOCATIONS.flatMap((tier) => tier.examples)) {
  const rule = PICK[name] ?? {};
  const found = all.filter((c) => c.name === (rule.name ?? name)
    && (rule.admin1 === undefined || c.admin1 === rule.admin1)
    && (rule.lat === undefined || (Number(c.lat) >= rule.lat[0] && Number(c.lat) <= rule.lat[1])));
  if (found.length !== 1) {
    problems.push(`${name}: ${found.length} matches`);
    continue;
  }
  out[name] = [X(Number(found[0].lng)), Y(Number(found[0].lat))];
  const was = CITY_POINTS[name];
  const moved = was ? `moved ${Math.hypot(out[name][0] - was[0], out[name][1] - was[1]).toFixed(1)} units` : 'new';
  console.error(`${name.padEnd(14)} ${found[0].lat}, ${found[0].lng}  ->  [${out[name]}]  ${moved}`);
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`export const CITY_POINTS = Object.freeze(${JSON.stringify(out)});`);
