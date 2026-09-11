/** Data-only execution catalogue. No authoring or runtime implementation imports. */
export const componentCapabilities = {
  'cards.deck': 'cards',
  'cards.hands': 'cards',
  'cards.zone': 'cards',
  'cards.sets': 'cards',
  'movement.track': 'movement',
  'pawn.set': 'pawns',
  'dice.set': 'dice',
  'inventory.set': 'inventory',
  'economy.market': 'economy',
  'ownership.registry': 'ownership',
  'grid.board': 'grid',
  'quiz.bank': 'quiz',
} as const;

export const interactionCapabilities = [
  'scheduler',
  'submissions',
  'submissionFlow',
  'judge',
  'voting',
] as const;
export type InteractionCapability = (typeof interactionCapabilities)[number];
export type ComponentCapability =
  (typeof componentCapabilities)[keyof typeof componentCapabilities];
export type OptionalGameCapability =
  ComponentCapability | InteractionCapability;

export const mechanicCapabilities = {
  voting: ['voting'],
  judge: ['judge'],
  'secret-submissions': ['submissions', 'submissionFlow'],
  submissions: ['submissions', 'submissionFlow'],
  scheduler: ['scheduler'],
} as const;

export type CompiledPattern = {
  readonly id: string;
  readonly mechanics: readonly string[];
};

export type CompiledGamePlan = {
  readonly version: 1;
  readonly patterns: readonly CompiledPattern[];
  readonly capabilities: readonly OptionalGameCapability[];
  readonly componentIds: readonly string[];
  readonly actionIds: readonly string[];
  readonly phaseIds: readonly string[];
  readonly choiceIds: readonly string[];
  readonly effectIds: readonly string[];
};
