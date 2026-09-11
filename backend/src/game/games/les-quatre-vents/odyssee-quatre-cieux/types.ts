import type { PawnMove } from '../../../engine/sdk/public-api';
export type OdysseeMove = PawnMove & {
  /** Compatible choice payload; the dice component remains authoritative. */
  roll: number;
};
