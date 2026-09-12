import type {
  EffectCondition,
  EffectTarget,
  GameEffectInstruction,
} from '../contracts/effect-ir';
import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';

/** All direct target roles share the same identity and session checks. */
export function validateInstructionTargets(
  instruction: GameEffectInstruction,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  const targets: Record<string, EffectTarget | undefined> = {
    target: 'target' in instruction ? instruction.target : undefined,
    from: 'from' in instruction ? instruction.from : undefined,
    to: 'to' in instruction ? instruction.to : undefined,
    left: 'left' in instruction ? instruction.left : undefined,
    right: 'right' in instruction ? instruction.right : undefined,
    reactor: 'reactor' in instruction ? instruction.reactor : undefined,
  };
  for (const [role, target] of Object.entries(targets))
    validateEffectTarget(target, `${path}.${role}`, fail, references.playerIds);
}

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
  validateEffectTarget(
    condition.target,
    `${path}.target`,
    fail,
    references.playerIds,
  );
  if (validateValueCondition(condition, path, references, fail)) return;
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

function validateValueCondition(
  condition: EffectCondition,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): boolean {
  if (condition.kind === 'owns-asset') {
    const assets = references.ownershipAssets?.get(condition.registryId);
    if (!assets) fail(`${path}.registryId`, 'unknown ownership registry');
    requireReference(assets, condition.assetId, `${path}.assetId`, fail);
    return true;
  }
  if (
    condition.kind !== 'score' &&
    condition.kind !== 'resource' &&
    condition.kind !== 'inventory-count'
  )
    return false;
  requireFinite(condition.amount, `${path}.amount`, fail);
  if (!['eq', 'ne', 'lt', 'lte', 'gt', 'gte'].includes(condition.compare))
    fail(`${path}.compare`, 'unknown comparison');
  if (condition.kind === 'resource')
    requireResourceReference(
      references,
      condition.resource,
      `${path}.resource`,
      fail,
    );
  if (condition.kind === 'inventory-count') {
    requireReference(
      references.inventories,
      condition.inventoryId,
      `${path}.inventoryId`,
      fail,
    );
    if (!Number.isSafeInteger(condition.amount) || condition.amount < 0)
      fail(`${path}.amount`, 'invalid inventory count');
    const items = references.inventoryItems?.get(condition.inventoryId);
    if (items && condition.itemId !== undefined)
      requireReference(items, condition.itemId, `${path}.itemId`, fail);
  }
  return true;
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
  playerIds?: ReadonlySet<number>,
): void {
  if (target == null) return;
  if (playerIds) {
    const referenced = [
      ...(target.kind === 'player' ? [target.playerId] : []),
      ...(target.kind === 'chosen-player' ? target.playerIds : []),
      ...((target.kind === 'chosen-player' ||
        target.kind === 'chosen-opponent') &&
      target.chooserPlayerId !== undefined
        ? [target.chooserPlayerId]
        : []),
    ];
    if (referenced.some((id) => !playerIds.has(id)))
      fail(path, 'joueur absent de la session');
  }
  if (
    ![
      'self',
      'player',
      'next',
      'previous',
      'random-player',
      'leader',
      'last',
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
    (!Number.isSafeInteger(target.playerId) || target.playerId === 0)
  ) {
    fail(path, 'joueur invalide');
  }
  if (
    (target.kind === 'leader' || target.kind === 'last') &&
    !['all', 'lowest-id', 'random'].includes(target.ties)
  )
    fail(`${path}.ties`, 'invalid ranking tie policy');
  if (target.kind === 'chosen-opponent' && target.choiceId === '')
    fail(`${path}.choiceId`, 'ID vide');
  if (target.kind === 'chosen-player') {
    if (
      target.playerIds.length === 0 ||
      target.playerIds.some((id) => !Number.isSafeInteger(id) || id === 0) ||
      new Set(target.playerIds).size !== target.playerIds.length
    ) {
      fail(`${path}.playerIds`, 'liste de joueurs invalide');
    }
    if (target.choiceId === '') fail(`${path}.choiceId`, 'ID vide');
  }
  if (
    (target.kind === 'chosen-opponent' || target.kind === 'chosen-player') &&
    target.chooserPlayerId != null &&
    (!Number.isSafeInteger(target.chooserPlayerId) ||
      target.chooserPlayerId === 0)
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
