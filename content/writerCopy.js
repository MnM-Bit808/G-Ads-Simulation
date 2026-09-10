/**
 * The copy a HIRED writer hands the player, per cell and per tier (I25).
 *
 * WHY THIS FILE EXISTS
 *
 * A player paid ₹50,000 for the premium retainer, committed capital, watched the
 * ratings reach 8/8/8 — and could not start the game, because `round-zero.js`
 * disables the Go button when `validateAdCopy` fails and the description boxes
 * were empty. They had hired a copywriter and were still required to write the
 * copy.
 *
 * The block is I19's own fix working correctly. Refusing an invalid ad was right
 * — it stopped the panel promising 8·8·8 while the account ran 8·8·4 under
 * `OVERLONG_CEILING` — but for a retainer buyer it turned a misleading state
 * into an impassable one. I11 sells the GRADE and leaves the player writing the
 * words, which is a strange deal at ₹50,000 and is exactly why people leave the
 * boxes alone.
 *
 * WHAT THIS IS NOT
 *
 * **It is not a second source for the copy grades, and it must never become
 * one.** `creativeBlock` (setup.js) discards the ad text for a hired tier and
 * takes `expectedCtr` and `adRelevance` from `openingCopyGrades(tierId, bias)`.
 * That decoupling is deliberate — `constants.js` says why in one line, "two
 * things writing one number is how L6 happened" — and seeding copy does not
 * touch it. What a hired advertiser types changes no number, before or after
 * this file.
 *
 * MEASURED, AND IT SETTLES A DESIGN QUESTION THAT WAS ASKED
 *
 * The proposal on the table was to author copy that GRADES to the tier it was
 * sold as. It cannot be done. Run through `gradeAdOffline` against each cell's
 * own top keywords, the retainer sets here grade `adRelevance` 1, 6 and 1 while
 * the freelancer sets grade 2, 5 and 4 — **the best copy grades the worst.**
 * `adRelevance` rewards echoing the keyword; good advertising avoids it. To make
 * a retainer set grade 8 it would have to read like a keyword list, and 17.1
 * makes ad copy the only evidence of where an advertiser sits, so that trade
 * would buy a number by spending the mechanic.
 *
 * The same measurement on the rivals' own table — hand-authored, human-reviewed
 * end to end — returns `adRelevance` 3 to 5. Nothing in `content/adCopy.js`
 * reaches 8 either.
 *
 * So the tier shows up in the WRITING, not in a grade the writing cannot hit:
 * the freelancer names the category, the agency adds a hook and one concrete
 * detail, the retainer knows the customer's actual day. That difference is
 * visible at the moment it is paid for, because `serpBlock` previews the
 * player's own ad in round 0 beside the eight rivals' — switch tier and the
 * preview rewrites.
 *
 * THREE VARIANTS, AND WHY
 *
 * `content/adCopy.js` carries the scar: with one ad per cell, two rivals sharing
 * a cell ran the same ad word for word. Round 0 can be redone once (17.3) and a
 * market can be restarted, so a single set per cell and tier would show a
 * returning player the identical ad. Three is enough that a replay differs.
 *
 * `{brand}` IS THE ONLY THING THAT VARIES BY BRAND
 *
 * 7.5 makes brand names position-neutral on purpose, so nothing about a name
 * implies a price or a purpose — which is what lets one set serve all nine.
 * Keying by brand instead would contradict the cell in most of the 54
 * combinations a player can choose, because it is the CELL that decides what is
 * being sold. 6 cells x 3 tiers x 3 variants = 54 sets covering 9 x 6 x 3 = 162
 * combinations.
 *
 * A `{brand}` appears in descriptions only, never in a headline: headlines are
 * capped at 30 characters and "Vella & Co." is 11 of them, so a template that
 * fits a short name and not a long one would be a limit violation that only
 * some games ever showed. `writerCopy.test.js` interpolates the LONGEST name
 * before checking every limit.
 *
 * NO RIVAL TRADEMARK APPEARS HERE (8.7), and no line duplicates one from
 * `content/adCopy.js`. Both are asserted rather than promised.
 *
 * THE LANDING PAGE LINE IS NOT HERE, DELIBERATELY. `syncPage` composes
 * `landingPageDescription` from the player's CAPITAL, and I9 grades the page
 * from what that capital built rather than from the writer. A writer supplying
 * it would be the second mechanism this file's whole argument is against.
 */

import { WRITER_TIERS } from '../engine/constants.js';

/**
 * Cell -> tier -> three variants. Headlines and descriptions only.
 *
 * The signals each cell has to carry are `content/adCopy.js`'s, unchanged,
 * because a player reading their own ad and a player reading the eight rival
 * ads has to be reading the same language: Value names a number, Mid names
 * neither price nor material, Premium names material and construction; the verb
 * is TRAIN for performance and WEAR for lifestyle. The second description
 * carries the cell's own returns policy — 15 days at Value, 30 at Mid and
 * Premium, with a fit consultation only at Premium.
 */
export const AD_COPY_BY_WRITER = Object.freeze({
  'value|performance': Object.freeze({
    freelancer: Object.freeze([
      {
        headlines: ['Gym Wear From ₹499', 'Affordable Gym Clothes', 'Low Prices, Every Day'],
        descriptions: [
          'Leggings, sports bras and tees for the gym, at prices that stay low.',
          '{brand} delivers free over ₹799. Easy 15-day returns.',
        ],
      },
      {
        headlines: ['Cheap Gym Leggings', 'Sports Bras From ₹399', 'Budget Gym Clothing'],
        descriptions: [
          'Gym leggings and sports bras that do the job without costing much.',
          'Free delivery from {brand} over ₹799, with 15-day returns.',
        ],
      },
      {
        headlines: ['Workout Wear, Low Cost', 'Gym Sets From ₹999', 'Save On Gym Clothes'],
        descriptions: [
          'Training tees, shorts and leggings at everyday low prices.',
          'Sizes XS to XXL. {brand} takes returns for 15 days.',
        ],
      },
    ]),
    agency: Object.freeze([
      {
        headlines: ['Train Hard, Pay Less', 'Sweat-Wicking From ₹499', 'Four Sessions, One Price'],
        descriptions: [
          'Leggings and bras that hold through the squat rack, at a price that does not sting.',
          'Free delivery over ₹799. Fifteen days to swap a size, once, at no charge.',
        ],
      },
      {
        headlines: ['₹999 For Two Bras', 'High Impact, Low Price', 'Kit For The Whole Week'],
        descriptions: [
          'High-impact bras and quick-dry tees for people training four times a week.',
          'Size up or down once within 15 days, free. {brand} pays the postage.',
        ],
      },
      {
        headlines: ['Gym Kit Under ₹1500', 'Built To Sweat In', 'Stock Up And Save'],
        descriptions: [
          'Sweat-wicking leggings, shorts and tees, priced so you can own more than one.',
          'Combo pricing across sets, and a size chart measured in centimetres.',
        ],
      },
    ]),
    retainer: Object.freeze([
      {
        headlines: ['Three Sessions In, Still Good', 'The ₹799 That Lasts', 'Cheap Is Not The Same'],
        descriptions: [
          'The leggings you buy two of, because the wash cycle never gets ahead of you.',
          '{brand} starts at ₹799, and leaves 15 days to send back what does not fit.',
        ],
      },
      {
        headlines: ['Priced For Turning Up', 'Sweat Through It, Twice', 'Under ₹1000, Over-Built'],
        descriptions: [
          'Kit for the person who trains four times a week and will not pay designer prices.',
          'Fifteen-day returns. Measured in centimetres, so the second pair fits too.',
        ],
      },
      {
        headlines: ['₹499 And It Holds', 'For The Fifth Session', 'Budget, Not Disposable'],
        descriptions: [
          'High-impact bras and squat-proof leggings that outlast what you paid for them.',
          '{brand} sizes XS to XXL, with 15 days to change your mind.',
        ],
      },
    ]),
  }),

  'value|lifestyle': Object.freeze({
    freelancer: Object.freeze([
      {
        headlines: ['Co-ord Sets From ₹999', 'Cheap Loungewear', 'Low Prices Every Day'],
        descriptions: [
          'Co-ord sets, joggers and lounge pants at low everyday prices.',
          '{brand} offers free delivery and 15-day returns. Sizes XS to XXL.',
        ],
      },
      {
        headlines: ['Affordable Lounge Sets', 'Joggers From ₹699', 'Comfy And Cheap'],
        descriptions: [
          'Soft joggers and matching sets that do not cost very much.',
          'Sizes XS to XXL from {brand}, with easy 15-day returns.',
        ],
      },
      {
        headlines: ['Budget Athleisure', 'Lounge Pants From ₹599', 'Save On Everyday Wear'],
        descriptions: [
          'Everyday lounge pants and co-ord sets at prices that stay low.',
          'Free delivery over ₹799. Fifteen days to return anything.',
        ],
      },
    ]),
    agency: Object.freeze([
      {
        headlines: ['Two Sets, One Budget', 'Soft Without The Markup', 'Loungewear Under ₹999'],
        descriptions: [
          'Matching sets soft enough to sleep in, priced so you can own two.',
          'Fifteen days to swap a size, free, because a first guess rarely lands.',
        ],
      },
      {
        headlines: ['₹699 And Actually Soft', 'Weekend Kit, Weekday Price', 'Buy The Second One Too'],
        descriptions: [
          'Joggers and co-ord sets you will reach for twice a week, at half what you expect.',
          '{brand} sizes XS to XXL. One free exchange inside 15 days.',
        ],
      },
      {
        headlines: ['Cheap, But Not Scratchy', 'Sets From ₹899', 'Comfort On A Budget'],
        descriptions: [
          'Lounge pants and matching sets cut from cotton that softens instead of pilling.',
          'Free delivery over ₹799, and 15 days to send it back.',
        ],
      },
    ]),
    retainer: Object.freeze([
      {
        headlines: ['The ₹999 You Repeat', 'Soft On The Third Wash', 'Cheap That Stays Nice'],
        descriptions: [
          'The lounge set you buy in one colour and come back for in another.',
          '{brand} keeps 15 days open for returns, and measures every size properly.',
        ],
      },
      {
        headlines: ['Sunday Kit, Monday Price', 'Worn Out, Not Worn Through', 'Under ₹1000, Over A Year'],
        descriptions: [
          'Joggers and co-ord sets that survive being your favourite thing to wear.',
          'Fifteen-day returns and a size chart in centimetres, not just S, M and L.',
        ],
      },
      {
        headlines: ['Live In It For ₹899', 'Budget, Worn Daily', 'The Set That Keeps Up'],
        descriptions: [
          'Everyday sets priced low enough to wear without thinking about it.',
          '{brand} ships free over ₹799 and takes returns for 15 days.',
        ],
      },
    ]),
  }),

  'mid|performance': Object.freeze({
    freelancer: Object.freeze([
      {
        headlines: ['Gym Leggings And Bras', 'Workout Clothing', 'Made For Training'],
        descriptions: [
          'Leggings, sports bras and tees made for the gym.',
          '{brand} offers 30-day returns and free delivery. Sizes XS to XXL.',
        ],
      },
      {
        headlines: ['Sweat-Wicking Gym Wear', 'Training Kit For Women', 'Built For The Gym'],
        descriptions: [
          'Sweat-wicking leggings and high-impact bras for regular training.',
          'Sizes XS to XXL with a fit guide. Thirty-day returns from {brand}.',
        ],
      },
      {
        headlines: ['Gym Clothes That Last', 'Leggings For Training', 'Kit For Every Session'],
        descriptions: [
          'Gym leggings and tees that keep their shape through regular use.',
          'Free delivery both ways. {brand} takes returns for 30 days.',
        ],
      },
    ]),
    agency: Object.freeze([
      {
        headlines: ['Squat Rack Approved', 'Stays Put Under Load', 'No Adjusting Mid-Set'],
        descriptions: [
          'Leggings with a waistband that does not need pulling up between sets.',
          'Fit guide with real measurements. Thirty days to send it back, free.',
        ],
      },
      {
        headlines: ['Sweat Through It', 'Four Sessions A Week', 'Dries Before You Do'],
        descriptions: [
          'Quick-dry bras and tees for people training more days than not.',
          '{brand} sizes XS to XXL, measured in centimetres. 30-day returns.',
        ],
      },
      {
        headlines: ['Built For Heavy Weeks', 'Holds Its Shape', 'Training Kit, Not Fashion'],
        descriptions: [
          'Leggings and bras that come out of a heavy training week unchanged.',
          'Thirty-day returns, free both ways, and measurements on every listing.',
        ],
      },
    ]),
    retainer: Object.freeze([
      {
        headlines: ['The Pair You Train In', 'Still Opaque At Week Ten', 'Nothing To Think About'],
        descriptions: [
          'Leggings you stop noticing, which is the only review that matters at the rack.',
          '{brand} measures in centimetres. Thirty days to return, free both ways.',
        ],
      },
      {
        headlines: ['For The Fifth Session', 'Sweat Is The Test', 'It Just Stays Put'],
        descriptions: [
          'Bras and leggings tested through a full training block, not a photoshoot.',
          'Fit guide with real measurements. Thirty-day returns, postage covered.',
        ],
      },
      {
        headlines: ['Trained In, Not Posed In', 'The Kit That Disappears', 'Week Twelve, Still Good'],
        descriptions: [
          'Gym wear for the person who trains right through July and keeps going.',
          '{brand} sizes XS to XXL, with 30 days to change your mind.',
        ],
      },
    ]),
  }),

  'mid|lifestyle': Object.freeze({
    freelancer: Object.freeze([
      {
        headlines: ['Everyday Co-ord Sets', 'Leggings And Joggers', 'Comfortable All Day'],
        descriptions: [
          'Soft co-ord sets, leggings and joggers you can wear every day.',
          '{brand} ships free across India. Sizes XS to XXL, 30-day returns.',
        ],
      },
      {
        headlines: ['Athleisure For Every Day', 'Co-ord Sets And Joggers', 'Soft Everyday Wear'],
        descriptions: [
          'Lounge pants, joggers and matching sets that are easy to wear.',
          '{brand} offers free delivery and 30-day returns. Sizes XS to XXL.',
        ],
      },
      {
        headlines: ['Joggers And Lounge Pants', 'Everyday Leggings', 'Wear It All Day'],
        descriptions: [
          'Everyday leggings and joggers, soft enough to stay in all day.',
          'Sizes XS to XXL from {brand}, with free delivery and 30-day returns.',
        ],
      },
    ]),
    agency: Object.freeze([
      {
        headlines: ['Co-ords You Live In', 'Soft Enough To Stay In', 'Matching Sets, Sorted'],
        descriptions: [
          'Matching sets and joggers that come out of the wash the shape they went in.',
          'Size guide with real measurements, not just S, M and L. 30-day returns.',
        ],
      },
      {
        headlines: ['Dressed Without Trying', 'Soft, But Not Slouchy', 'Made For The Long Day'],
        descriptions: [
          'Leggings and lounge pants soft enough for the sofa, tidy enough for the school run.',
          '{brand} sizes XS to XXL, measured in centimetres. Returns open 30 days.',
        ],
      },
      {
        headlines: ['One Set, Whole Weekend', 'Joggers For Real Days', 'Athleisure That Behaves'],
        descriptions: [
          'Co-ord sets and joggers that hold their shape from the first coffee onward.',
          'Free delivery both ways. Measurements on every listing, 30-day returns.',
        ],
      },
    ]),
    retainer: Object.freeze([
      {
        headlines: ['Four Places To Be Today', 'The Co-ord That Copes', 'Soft, And Still Sharp'],
        descriptions: [
          'The matching set for the day that starts at the studio and ends somewhere else.',
          '{brand} measures every size in centimetres. Returns stay open 30 days.',
        ],
      },
      {
        headlines: ['Wear It To Everything', 'Leggings Worth Repeating', 'School Run To Supper'],
        descriptions: [
          'Leggings and lounge pants that keep their shape through wash after wash.',
          'Sizes XS to XXL, measured properly, so the second pair fits like the first.',
        ],
      },
      {
        headlines: ['Put Together, Not Trying', 'The Set You Live In', 'Everyday, Done Properly'],
        descriptions: [
          'Joggers and co-ord sets cut to look deliberate on a day that was not.',
          '{brand} ships free both ways. Real measurements, 30 days to change your mind.',
        ],
      },
    ]),
  }),

  'premium|performance': Object.freeze({
    freelancer: Object.freeze([
      {
        headlines: ['Technical Knit Leggings', 'Premium Gym Wear', 'Seamless Construction'],
        descriptions: [
          'Seamless leggings and bras knitted from technical yarn.',
          '{brand} offers a fit consultation and 30-day returns.',
        ],
      },
      {
        headlines: ['Compression Training Kit', 'Engineered Knit Fabric', 'High Performance Wear'],
        descriptions: [
          'Compression leggings and bras made from engineered technical knit.',
          'Fit consultation before you order. Thirty-day returns from {brand}.',
        ],
      },
      {
        headlines: ['Bonded Seam Leggings', 'Technical Gym Clothing', 'Built For Performance'],
        descriptions: [
          'Bonded seams and technical yarn, made for serious training.',
          'Free delivery both ways, 30-day returns, and a fitter to talk to.',
        ],
      },
    ]),
    agency: Object.freeze([
      {
        headlines: ['Knitted, Not Cut And Sewn', 'Korean Yarn, Bonded Seams', 'Zero Seams To Chafe'],
        descriptions: [
          'Circular-knitted from Korean yarn, so there is no seam to rub at mile eight.',
          'Book a fitting before you order. Thirty days to return, both ways paid.',
        ],
      },
      {
        headlines: ['Sculpts Without Squeezing', 'Recycled Technical Nylon', 'Holds Under Load'],
        descriptions: [
          'Recycled technical nylon with graduated compression through the thigh.',
          '{brand} offers a fit consultation, and 30 days to change your mind.',
        ],
      },
      {
        headlines: ['Second Skin, First Choice', 'Knit Structure Matters', 'Made To Be Trained In'],
        descriptions: [
          'Technical knit engineered zone by zone, tested under a loaded barbell.',
          'Talk to a fitter first. Thirty-day returns, free delivery both ways.',
        ],
      },
    ]),
    retainer: Object.freeze([
      {
        headlines: ['Knitted For The Barbell', 'Yarn You Can Name', 'Ten Years Of Sessions'],
        descriptions: [
          'Korean technical yarn, knitted in one piece, built to outlast the training block.',
          '{brand} fits you before you buy. Thirty days to return, postage ours.',
        ],
      },
      {
        headlines: ['The Last Pair You Buy', 'Engineered, Not Assembled', 'Nothing Rubs, Ever'],
        descriptions: [
          'Seamless construction from recycled technical nylon, zoned where the load sits.',
          'A fitter on a call before you order, and 30 days to send it back.',
        ],
      },
      {
        headlines: ['Named Mill, Named Yarn', 'Tested, Then Tested Again', 'Wear It For A Decade'],
        descriptions: [
          'Technical knit from a mill we can name, abrasion-tested through a full block.',
          '{brand} books a fit consultation. Free delivery both ways, 30-day returns.',
        ],
      },
    ]),
  }),

  'premium|lifestyle': Object.freeze({
    freelancer: Object.freeze([
      {
        headlines: ['Modal Lounge Sets', 'Premium Loungewear', 'Soft Technical Fabric'],
        descriptions: [
          'Lounge sets and joggers made from modal and fine cotton.',
          '{brand} offers a fit consultation and 30-day returns.',
        ],
      },
      {
        headlines: ['Cashmere Blend Joggers', 'Considered Everyday Wear', 'Quality Loungewear'],
        descriptions: [
          'Cashmere-blend joggers and co-ord sets cut for everyday wear.',
          'Fit consultation on request. Thirty-day returns from {brand}.',
        ],
      },
      {
        headlines: ['Bamboo Silk Lounge Wear', 'Fine Fabric, Cut Well', 'Loungewear That Lasts'],
        descriptions: [
          'Bamboo silk and heavy cotton, made to be worn for years.',
          'Free delivery both ways, 30-day returns, and a care card in every box.',
        ],
      },
    ]),
    agency: Object.freeze([
      {
        headlines: ['Modal That Falls Right', 'Cut For The Way It Hangs', 'Softer On The Tenth Wash'],
        descriptions: [
          'Modal and fine cotton, cut on the grain so the drape survives the wash.',
          'A fit consultation before you order, and a care card in the box.',
        ],
      },
      {
        headlines: ['Weight You Can Feel', 'Cashmere Where It Counts', 'Made To Be Kept'],
        descriptions: [
          'Cashmere-blend joggers with a weight that tells you what you paid for.',
          '{brand} offers a fitting on request. Thirty days to change your mind.',
        ],
      },
      {
        headlines: ['Bamboo Silk, Heavy Cotton', 'Not This Season, Any Season', 'Drapes, Not Clings'],
        descriptions: [
          'Fabric chosen for how it falls, in shapes that will not date in a year.',
          'Fit consultation, care card, and 30 days to return it either way.',
        ],
      },
    ]),
    retainer: Object.freeze([
      {
        headlines: ['Worn In, Never Worn Out', 'The Set You Keep Buying', 'Modal, Named And Traced'],
        descriptions: [
          'Loungewear in modal and cashmere, made to be the thing you own for a decade.',
          '{brand} fits you before you order, and puts a care card in every box.',
        ],
      },
      {
        headlines: ['Bought Once, Worn For Years', 'Silk Weight, Sofa Comfort', 'Fabric With A Provenance'],
        descriptions: [
          'Bamboo silk cut heavy enough to hang properly on the eleventh wearing.',
          'A fitting on a call before you buy. Thirty days to return, both ways paid.',
        ],
      },
      {
        headlines: ['The Quiet Considered One', 'Cut To Outlast The Trend', 'You Will Not Replace It'],
        descriptions: [
          'Modal and heavy cotton in shapes that do not announce the year you bought them.',
          '{brand} offers a fit consultation, a care card, and 30 days to decide.',
        ],
      },
    ]),
  }),
});

/** The tiers that hire somebody. DIY is not here, because writing it is the deal. */
export const HIRED_TIER_IDS = Object.freeze(
  WRITER_TIERS.filter((t) => t.grade !== null).map((t) => t.id),
);

/** How many variants every cell and tier carries. */
export const WRITER_COPY_VARIANTS = 3;

/**
 * The ad a hired writer delivers, with the brand name filled in.
 *
 * Returns a fresh object every call. Round 0 hands this straight into a draft
 * the player then edits, and a shared reference would let one game's edits show
 * up in the next.
 *
 * @param {string} cell `price|purpose`, as `homeCell` spells it
 * @param {string} tierId a hired tier from `WRITER_TIERS`
 * @param {string} brandName the player's chosen brand, substituted for `{brand}`
 * @param {number} [variant] which of the three, taken modulo the count
 * @returns {{headlines: string[], descriptions: string[]}}
 * @throws {RangeError} on an unknown cell, or on a tier that writes its own —
 *   returning empty copy for DIY would silently reintroduce the empty-box block
 *   this file exists to remove.
 */
export function writerCopyFor(cell, tierId, brandName, variant = 0) {
  const byTier = AD_COPY_BY_WRITER[cell];
  if (!byTier) throw new RangeError(`no writer copy for cell "${cell}"`);
  const sets = byTier[tierId];
  if (!sets) throw new RangeError(`no writer copy for tier "${tierId}": it writes its own`);

  const set = sets[((variant % sets.length) + sets.length) % sets.length];
  const fill = (line) => line.split('{brand}').join(brandName);
  return {
    headlines: set.headlines.map(fill),
    descriptions: set.descriptions.map(fill),
  };
}
