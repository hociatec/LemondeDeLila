/**
 * Stable gameplay-recipe facade. Implementations live by functional family so
 * adding a card recipe does not grow an unrelated universal runtime module.
 */
export * from './gameplay/track-round.recipes';
export * from './gameplay/card-dice.recipes';
export * from './gameplay/card-actions.recipes';
export * from './gameplay/movement-quiz.recipes';
export * from './gameplay/scoring-submission.recipes';
