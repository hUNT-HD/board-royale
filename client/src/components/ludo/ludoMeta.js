/**
 * ludoMeta.js — client mirror of the server's ring constants used for rendering.
 * Mirrors server/ludoLogic.js (ARM, RING_SIZE, STAR_OFFSET, entry/safe cells).
 */
import { COLORS, ARM, RING_SIZE } from './ludoPath.js';

const STAR_OFFSET = 8;

// global ring index -> player color, for the six colored entry cells
export const ENTRY = COLORS.reduce((acc, c, i) => ((acc[i * ARM] = c), acc), {});

// safe ring indices: every entry cell + every star cell (no captures)
export const SAFE_SET = new Set(
  COLORS.flatMap((c, i) => [i * ARM, (i * ARM + STAR_OFFSET) % RING_SIZE])
);
