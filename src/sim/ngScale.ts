/** Every round of New Game+ makes creatures hit this much harder, and shrug off this much more. */
const PER_ROUND = 0.35;
export const ngScale = (ng: number): number => 1 + PER_ROUND * ng;
