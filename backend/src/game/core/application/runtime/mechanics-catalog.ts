export const MECHANIC_EXTRACTION_THRESHOLD = 3 as const;

export type MechanismLayer = 'local' | 'recipe' | 'pattern' | 'kit' | 'core';

export type MechanismAdmission = {
  occurrences: number;
  universalInvariant?: boolean;
  ownsDomainState?: boolean;
  composesCapabilities?: boolean;
};

/** Formal rule used during reviews before promoting game-specific code. */
export function classifyMechanism(input: MechanismAdmission): MechanismLayer {
  if (input.universalInvariant) return 'core';
  if (input.occurrences < MECHANIC_EXTRACTION_THRESHOLD) return 'local';
  if (input.ownsDomainState) return 'kit';
  if (input.composesCapabilities) return 'pattern';
  return 'recipe';
}

export const GAMEPLAY_MECHANICS_CATALOG = Object.freeze({
  policy: Object.freeze({
    extractionThreshold: MECHANIC_EXTRACTION_THRESHOLD,
    layers: Object.freeze({
      local: 'Mécanique réellement propre à un seul jeu.',
      recipe: 'Combinaison sans état de primitives réutilisée par plusieurs jeux.',
      pattern: 'Structure de gameplay composant plusieurs capacités.',
      kit: 'Capacité de domaine autonome possédant son état et ses invariants.',
      core: 'Invariant nécessaire à presque toutes les parties.',
    }),
  }),
  kits: Object.freeze([
    'cards',
    'configuration',
    'dice',
    'economy',
    'grid',
    'inventory',
    'match',
    'movement',
    'ownership',
    'pawns',
    'quiz',
    'ranking',
    'round',
    'scheduler',
    'submissions',
    'turn',
  ]),
  patterns: Object.freeze([
    'cardGame',
    'collectionGame',
    'pushYourLuck',
    'pawnRace',
    'quizRace',
    'raceGame',
    'roundScoring',
    'simultaneousAnswers',
  ]),
  recipes: Object.freeze([
    'answerQuiz',
    'chooseTarget',
    'collectSets',
    'completeSet',
    'discardCard',
    'drawCard',
    'drawThenResolve',
    'eliminateAtScore',
    'giveCard',
    'lastPlayerStanding',
    'leaveRound',
    'moveCurrentPlayer',
    'movePawn',
    'passTurn',
    'playCard',
    'requestCardFromPlayer',
    'raceTurn',
    'rollAndMove',
    'rollDice',
    'scoreHand',
    'scoreUniqueCards',
    'skipTurn',
    'stealCard',
    'submitSecret',
    'swapHands',
    'revealSubmissions',
    'vote',
    'winAtScore',
  ]),
  effects: Object.freeze([
    'addStatus',
    'conditional',
    'discardCards',
    'drawCards',
    'extraTurn',
    'gainResource',
    'gainScore',
    'giveCard',
    'loseResource',
    'move',
    'moveTo',
    'reaction',
    'removeStatus',
    'rollDice',
    'shield',
    'skipTurn',
    'stealCard',
    'swapHands',
    'swapPositions',
  ]),
});
