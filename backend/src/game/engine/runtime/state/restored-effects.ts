import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import { assertEffectJson } from '../contracts/effect-json-schema';
import type { GameEffectValidationReferences } from '../contracts/effect-validation';
import { assertEffectInstructions } from '../effects/game-effect-definition-validator';
import type { DeclarativeState } from './declarative-state';

/** Validate all executable continuations, including branches outside the queue. */
export function assertRestoredEffects<TState extends object>(
  state: DeclarativeState<TState>,
  references: GameEffectValidationReferences,
): void {
  const effects = state.engine.effects;
  const sessionReferences = {
    ...references,
    playerIds: new Set(state.players?.map((player) => player.id)),
  };
  const fail = (path: string, reason: string): never => {
    throw new GameStateViolationError(
      `Invalid restored effects: ${path}: ${reason}`,
    );
  };
  const sequence = (value: unknown, path: string): void => {
    assertEffectJson(value, path, true);
    assertEffectInstructions(value, path, sessionReferences, fail);
  };
  if (effects.schemaVersion !== 1) fail('schemaVersion', 'unsupported version');
  for (const field of [
    'playerChoiceResolved',
    'completeTurnWhenDrained',
  ] as const)
    if (typeof effects[field] !== 'boolean') fail(field, 'boolean required');
  for (const field of ['awaitingChoiceId', 'resolvedPlayerChoiceId'] as const)
    if (
      effects[field] !== null &&
      (typeof effects[field] !== 'string' || !effects[field].trim())
    )
      fail(field, 'choice identity required');
  sequence(effects.queue, 'queue');
  const reaction = effects.awaitingReaction;
  const playerChoice = effects.awaitingPlayerChoice;
  if (reaction != null && playerChoice != null)
    fail('choice', 'multiple pending continuations');
  const continuation = reaction ?? playerChoice;
  if ((continuation?.choiceId ?? null) !== effects.awaitingChoiceId)
    fail('awaitingChoiceId', 'continuation mismatch');
  if (
    effects.awaitingChoiceId !== null &&
    state.pending?.data?.choiceId !== effects.awaitingChoiceId
  )
    fail('awaitingChoiceId', 'pending choice missing');
  if (playerChoice != null && typeof playerChoice.optional !== 'boolean')
    fail('awaitingPlayerChoice.optional', 'boolean required');
  if (reaction != null) {
    if (
      !reaction.reactions ||
      typeof reaction.reactions !== 'object' ||
      Array.isArray(reaction.reactions)
    )
      fail('awaitingReaction.reactions', 'reaction map required');
    for (const [option, instructions] of Object.entries(reaction.reactions))
      sequence(instructions, `awaitingReaction.reactions.${option}`);
    sequence(reaction.fallback, 'awaitingReaction.fallback');
  }
  if (
    effects.source != null &&
    effects.source.playerId !== null &&
    !state.players?.some((player) => player.id === effects.source?.playerId)
  )
    fail('source.playerId', 'unknown player');
}
