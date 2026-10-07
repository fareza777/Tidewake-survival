/** Every round of New Game+ makes creatures hit this much harder, and shrug off this much more. */
const PER_ROUND = 0.35;
export const ngScale = (ng: number): number => 1 + PER_ROUND * ng;

/** Each floor of the Endless Depths adds this much on top. */
const PER_FLOOR = 0.15;

/** How much harder creatures hit (and how much more they take) than in the plain game: New Game+ rounds and depth. */
export const pressureOf = (s: { ng: number; location: string | null; floor: number }): number =>
  ngScale(s.ng) * (s.location === 'depths' ? 1 + PER_FLOOR * (s.floor - 1) : 1);
