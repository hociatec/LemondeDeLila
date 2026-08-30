import type { GameSingleActionDto } from './game-action.model';

/**
 * Transition autonome declaree par un jeu.
 *
 * Le transport temps reel ne connait ni les phases ni les actions propres au
 * jeu : il programme simplement le plan fourni par l'adaptateur de regles.
 */
export type GameAutomaticActionPlan = {
  key: string;
  actions: GameSingleActionDto[];
  executeAtMs?: number;
};
/** Explicitly named data contract at the application boundary. */
