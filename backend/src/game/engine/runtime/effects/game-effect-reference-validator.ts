import type { EffectCondition, EffectTarget } from '../contracts/effect-ir';
import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';

export function validateEffectCondition(
  condition: EffectCondition,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  if (!condition || typeof condition !== 'object')
    fail(path, 'condition invalide');
  if (condition.kind === 'not') {
    validateEffectCondition(
      condition.condition,
      `${path}.condition`,
      references,
      fail,
    );
    return;
  }
  if (condition.kind === 'all' || condition.kind === 'any') {
    if (condition.conditions.length === 0) fail(path, 'condition vide');
    condition.conditions.forEach((nested, index) =>
      validateEffectCondition(nested, `${path}.${index}`, references, fail),
    );
    return;
  }
  validateEffectTarget(condition.target, `${path}.target`, fail);
  if (condition.kind === 'has-resource') {
    requireResourceReference(
      references,
      condition.resource,
      `${path}.resource`,
      fail,
    );
    requireFinite(condition.amount, `${path}.amount`, fail);
  } else if (condition.kind === 'has-status') {
    if (!condition.status.trim()) fail(`${path}.status`, 'ID vide');
  } else if (condition.kind === 'has-card') {
    requireReference(
      references.hands,
      condition.handId,
      `${path}.handId`,
      fail,
    );
    if (condition.cardId != null)
      requireCardReference(
        references,
        condition.handId,
        condition.cardId,
        `${path}.cardId`,
        fail,
      );
  } else if (condition.kind === 'track-position') {
    requireReference(
      references.tracks,
      condition.trackId,
      `${path}.trackId`,
      fail,
    );
    for (const value of [condition.position, condition.min, condition.max]) {
      if (value != null)
        requireTrackPosition(references, condition.trackId, value, path, fail);
    }
    if (
      condition.min != null &&
      condition.max != null &&
      condition.min > condition.max
    )
      fail(path, 'intervalle de positions inversé');
  } else {
    fail(path, 'condition inconnue');
  }
}

export function requireResourceReference(
  references: GameEffectValidationReferences,
  id: string,
  path: string,
  fail: ValidationFailure,
): void {
  if (typeof id !== 'string' || !id.trim()) fail(path, 'ID vide');
  if (references.resources)
    requireReference(references.resources, id, path, fail);
}

export function requireCardReference(
  references: GameEffectValidationReferences,
  handId: string,
  cardId: string,
  path: string,
  fail: ValidationFailure,
): void {
  if (typeof cardId !== 'string' || !cardId.trim()) fail(path, 'ID vide');
  if (!references.cardIdsByDeck || !references.handDecks) return;
  const deck = references.handDecks.get(handId);
  const cards = deck == null ? undefined : references.cardIdsByDeck.get(deck);
  if (!cards?.has(cardId))
    fail(path, `carte inconnue « ${cardId} » dans la main « ${handId} »`);
}

export function requireTrackPosition(
  references: GameEffectValidationReferences,
  trackId: string,
  position: number,
  path: string,
  fail: ValidationFailure,
): void {
  const spaces = references.trackSpaces?.get(trackId);
  if (
    !Number.isSafeInteger(position) ||
    position < 0 ||
    (spaces != null && position >= spaces)
  )
    fail(path, `case inexistante « ${position} » sur la piste « ${trackId} »`);
}

export function validateEffectTarget(
  target: EffectTarget | undefined,
  path: string,
  fail: ValidationFailure,
): void {
  if (target == null) return;
  if (
    ![
      'self',
      'player',
      'next',
      'all-players',
      'all-opponents',
      'random-opponent',
      'chosen-opponent',
      'chosen-player',
    ].includes(target.kind)
  ) {
    fail(path, 'cible inconnue');
  }
  if (
    target.kind === 'player' &&
    (!Number.isInteger(target.playerId) || target.playerId < 1)
  ) {
    fail(path, 'joueur invalide');
  }
  if (target.kind === 'chosen-opponent' && target.choiceId === '')
    fail(`${path}.choiceId`, 'ID vide');
  if (target.kind === 'chosen-player') {
    if (
      target.playerIds.length === 0 ||
      target.playerIds.some((id) => !Number.isInteger(id) || id < 1) ||
      new Set(target.playerIds).size !== target.playerIds.length
    ) {
      fail(`${path}.playerIds`, 'liste de joueurs invalide');
    }
    if (target.choiceId === '') fail(`${path}.choiceId`, 'ID vide');
  }
  if (
    (target.kind === 'chosen-opponent' || target.kind === 'chosen-player') &&
    target.chooserPlayerId != null &&
    (!Number.isInteger(target.chooserPlayerId) || target.chooserPlayerId < 1)
  ) {
    fail(`${path}.chooserPlayerId`, 'joueur invalide');
  }
}

export function requireReference(
  catalog: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  id: string,
  path: string,
  fail: ValidationFailure,
): void {
  if (!catalog.has(id)) fail(path, `référence inconnue « ${id} »`);
}

export function requireFinite(
  value: number,
  path: string,
  fail: ValidationFailure,
): void {
  if (!Number.isFinite(value)) fail(path, 'nombre fini requis');
}

export function requirePositiveInteger(
  value: number,
  path: string,
  fail: ValidationFailure,
): void {
  if (!Number.isInteger(value) || value < 1)
    fail(path, 'entier positif requis');
}
