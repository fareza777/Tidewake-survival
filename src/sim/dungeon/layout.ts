/** Geometry shared by the dungeon generator and the rules: a 3 by 3 grid of rooms joined in a chain. */
export const DUNGEON_SIZE = 48;
/** Interior of every room, in tiles. */
export const ROOM_W = 13;
export const ROOM_H = 11;
/** Distance between the same corner of two neighbouring rooms: the interior plus one shared wall. */
export const PITCH_X = ROOM_W + 1;
export const PITCH_Y = ROOM_H + 1;
/** Solid margin around the whole grid. */
export const ORIGIN = 2;

/** Grid cell (column, row) of each of the eight rooms: the entrance, four puzzles, the vault, the boss and the side room. */
export const CELLS: readonly (readonly [number, number])[] = [[1, 2], [2, 2], [2, 1], [1, 1], [0, 1], [0, 0], [1, 0], [0, 2]];
/** Pairs of rooms joined by a doorway. */
export const LINKS: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [0, 7]];

/** Top-left tile of a room's interior. */
export function roomOrigin(col: number, row: number): { x0: number; y0: number } {
  return { x0: ORIGIN + 1 + col * PITCH_X, y0: ORIGIN + 1 + row * PITCH_Y };
}

/** The doorway tile between two neighbouring cells; `vertical` means it sits in a vertical wall (an east-west link). */
export function doorwayBetween(a: readonly [number, number], b: readonly [number, number]): { x: number; y: number; vertical: boolean } {
  const first = roomOrigin(Math.min(a[0], b[0]), Math.min(a[1], b[1]));
  if (a[1] === b[1]) return { x: first.x0 + ROOM_W, y: first.y0 + (ROOM_H >> 1), vertical: true };
  return { x: first.x0 + (ROOM_W >> 1), y: first.y0 + ROOM_H, vertical: false };
}
