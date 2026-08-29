/**
 * Stable gameplay-recipe facade. Implementations live by functional family so
 * adding a card recipe does not grow an unrelated universal runtime module.
 */
export * from './gameplay-recipes/track-round.recipes';
export * from './gameplay-recipes/card-dice.recipes';
export * from './gameplay-recipes/card-actions.recipes';
export * from './gameplay-recipes/movement-quiz.recipes';
export * from './gameplay-recipes/scoring-submission.recipes';
