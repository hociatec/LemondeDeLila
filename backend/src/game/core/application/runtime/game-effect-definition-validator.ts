import type {
  EffectCondition,
  EffectTarget,
  GameEffectInstruction,
} from './effects-kit';

export type GameEffectValidationReferences = {
  readonly decks: ReadonlyMap<string, unknown>;
  readonly hands: ReadonlyMap<string, unknown>;
  readonly inventories: ReadonlyMap<string, unknown>;
  readonly tracks: ReadonlySet<string>;
  readonly diceSets: ReadonlySet<string>;
  readonly effects?: Readonly<Record<string, unknown>>;
};

type ValidationFailure = (path: string, reason: string) => never;

export function assertEffectInstructions(
  instructions: unknown,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  if (!Array.isArray(instructions)) fail(path, 'séquence d’effets invalide');
  const values: readonly unknown[] = instructions;
  for (const [index, value] of values.entries()) {
    const effectPath = `${path}.${index}`;
    if (!value || typeof value !== 'object') {
      fail(effectPath, 'instruction invalide');
    }
    const instruction = value as GameEffectInstruction;
    validateEffectTarget(
      'target' in instruction ? instruction.target : undefined,
      `${effectPath}.target`,
      fail,
    );
    if (instruction.kind === 'conditional') {
      validateEffectCondition(
        instruction.condition,
        `${effectPath}.condition`,
        references,
        fail,
      );
      assertEffectInstructions(
        instruction.then,
        `${effectPath}.then`,
        references,
        fail,
      );
      assertEffectInstructions(
        instruction.else ?? [],
        `${effectPath}.else`,
        references,
        fail,
      );
    } else if (instruction.kind === 'reaction') {
      validateEffectTarget(instruction.reactor, `${effectPath}.reactor`, fail);
      if (instruction.availability) {
        validateEffectTarget(
          instruction.availability.owner,
          `${effectPath}.availability.owner`,
          fail,
        );
        if (instruction.availability.kind === 'cards') {
          requireReference(
            references.hands,
            instruction.availability.handId,
            `${effectPath}.availability.handId`,
            fail,
          );
        } else if (
          instruction.availability.amount != null &&
          (!Number.isInteger(instruction.availability.amount) ||
            instruction.availability.amount < 1)
        ) {
          fail(
            `${effectPath}.availability.amount`,
            'quantité positive attendue',
          );
        }
      }
      if (
        instruction.options.length === 0 ||
        instruction.options.some((option) => !option.trim()) ||
        new Set(instruction.options).size !== instruction.options.length
      ) {
        fail(`${effectPath}.options`, 'options de réaction invalides');
      }
      for (const [option, reaction] of Object.entries(instruction.reactions)) {
        if (!instruction.options.includes(option)) {
          fail(`${effectPath}.reactions.${option}`, 'option non déclarée');
        }
        assertEffectInstructions(
          reaction,
          `${effectPath}.reactions.${option}`,
          references,
          fail,
        );
      }
      assertEffectInstructions(
        instruction.fallback ?? [],
        `${effectPath}.fallback`,
        references,
        fail,
      );
    } else if (instruction.kind === 'move' || instruction.kind === 'move-to') {
      requireReference(
        references.tracks,
        instruction.trackId,
        `${effectPath}.trackId`,
        fail,
      );
      requireFinite(
        instruction.kind === 'move' ? instruction.spaces : instruction.position,
        effectPath,
        fail,
      );
    } else if (instruction.kind === 'swap-positions') {
      requireReference(
        references.tracks,
        instruction.trackId,
        `${effectPath}.trackId`,
        fail,
      );
      validateEffectTarget(instruction.left, `${effectPath}.left`, fail);
      validateEffectTarget(instruction.right, `${effectPath}.right`, fail);
    } else if (
      instruction.kind === 'draw-cards' ||
      instruction.kind === 'discard-random'
    ) {
      requireReference(
        references.decks,
        instruction.deckId,
        `${effectPath}.deckId`,
        fail,
      );
      requireReference(
        references.hands,
        instruction.handId,
        `${effectPath}.handId`,
        fail,
      );
      requirePositiveInteger(instruction.count, `${effectPath}.count`, fail);
    } else if (instruction.kind === 'discard-random-inventory') {
      requireReference(
        references.inventories,
        instruction.inventoryId,
        `${effectPath}.inventoryId`,
        fail,
      );
      requirePositiveInteger(instruction.count, `${effectPath}.count`, fail);
    } else if (instruction.kind === 'give-card') {
      requireReference(
        references.hands,
        instruction.handId,
        `${effectPath}.handId`,
        fail,
      );
      if (!instruction.cardId.trim()) fail(`${effectPath}.cardId`, 'ID vide');
      validateEffectTarget(instruction.from, `${effectPath}.from`, fail);
      validateEffectTarget(instruction.to, `${effectPath}.to`, fail);
    } else if (instruction.kind === 'steal-card') {
      requireReference(
        references.hands,
        instruction.handId,
        `${effectPath}.handId`,
        fail,
      );
      validateEffectTarget(instruction.from, `${effectPath}.from`, fail);
      validateEffectTarget(instruction.to, `${effectPath}.to`, fail);
      if (instruction.count != null) {
        requirePositiveInteger(instruction.count, `${effectPath}.count`, fail);
      }
    } else if (instruction.kind === 'swap-hands') {
      requireReference(
        references.hands,
        instruction.handId,
        `${effectPath}.handId`,
        fail,
      );
      validateEffectTarget(instruction.left, `${effectPath}.left`, fail);
      validateEffectTarget(instruction.right, `${effectPath}.right`, fail);
    } else if (instruction.kind === 'steal-random-inventory') {
      requireReference(
        references.inventories,
        instruction.inventoryId,
        `${effectPath}.inventoryId`,
        fail,
      );
      validateEffectTarget(instruction.from, `${effectPath}.from`, fail);
      validateEffectTarget(instruction.to, `${effectPath}.to`, fail);
      if (instruction.count != null) {
        requirePositiveInteger(instruction.count, `${effectPath}.count`, fail);
      }
    } else if (
      instruction.kind === 'swap-inventories' ||
      instruction.kind === 'exchange-random-inventory'
    ) {
      requireReference(
        references.inventories,
        instruction.inventoryId,
        `${effectPath}.inventoryId`,
        fail,
      );
      validateEffectTarget(instruction.left, `${effectPath}.left`, fail);
      validateEffectTarget(instruction.right, `${effectPath}.right`, fail);
    } else if (
      instruction.kind === 'gain-resource' ||
      instruction.kind === 'lose-resource' ||
      instruction.kind === 'transfer-resource'
    ) {
      if (!instruction.resource.trim()) {
        fail(`${effectPath}.resource`, 'ID vide');
      }
      requireFinite(instruction.amount, `${effectPath}.amount`, fail);
      if (instruction.kind === 'transfer-resource') {
        validateEffectTarget(instruction.from, `${effectPath}.from`, fail);
        validateEffectTarget(instruction.to, `${effectPath}.to`, fail);
      }
    } else if (instruction.kind === 'gain-score') {
      requireFinite(instruction.amount, `${effectPath}.amount`, fail);
    } else if (
      instruction.kind === 'skip-turn' ||
      instruction.kind === 'extra-turn'
    ) {
      if (instruction.count != null) {
        requirePositiveInteger(instruction.count, `${effectPath}.count`, fail);
      }
    } else if (instruction.kind === 'add-status') {
      if (!instruction.status.trim()) fail(`${effectPath}.status`, 'ID vide');
      if (instruction.turns != null) {
        requirePositiveInteger(instruction.turns, `${effectPath}.turns`, fail);
      }
    } else if (instruction.kind === 'remove-status') {
      if (!instruction.status.trim()) fail(`${effectPath}.status`, 'ID vide');
    } else if (instruction.kind === 'roll-dice') {
      requireReference(
        references.diceSets,
        instruction.diceId ?? 'main',
        `${effectPath}.diceId`,
        fail,
      );
    } else if (instruction.kind === 'custom') {
      if (!references.effects?.[instruction.effectId]) {
        fail(
          `${effectPath}.effectId`,
          `effet inconnu « ${instruction.effectId} »`,
        );
      }
    } else if (
      instruction.kind !== 'choose-player' &&
      instruction.kind !== 'complete-turn' &&
      instruction.kind !== 'reverse-turn-order'
    ) {
      fail(
        effectPath,
        `type d’effet inconnu « ${String(
          (instruction as { kind?: unknown }).kind,
        )} »`,
      );
    }
  }
}

function validateEffectCondition(
  condition: EffectCondition,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  if (!condition || typeof condition !== 'object') {
    fail(path, 'condition invalide');
  }
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
    if (!condition.resource.trim()) fail(`${path}.resource`, 'ID vide');
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
  } else if (condition.kind === 'track-position') {
    requireReference(
      references.tracks,
      condition.trackId,
      `${path}.trackId`,
      fail,
    );
    for (const value of [condition.position, condition.min, condition.max]) {
      if (value != null) requireFinite(value, path, fail);
    }
  }
}

function validateEffectTarget(
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
  if (target.kind === 'chosen-opponent' && target.choiceId === '') {
    fail(`${path}.choiceId`, 'ID vide');
  }
  if (target.kind === 'chosen-player') {
    if (
      target.playerIds.length === 0 ||
      target.playerIds.some(
        (playerId) => !Number.isInteger(playerId) || playerId < 1,
      ) ||
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

function requireReference(
  catalog: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  id: string,
  path: string,
  fail: ValidationFailure,
): void {
  if (!catalog.has(id)) fail(path, `référence inconnue « ${id} »`);
}

function requireFinite(
  value: number,
  path: string,
  fail: ValidationFailure,
): void {
  if (!Number.isFinite(value)) fail(path, 'nombre fini requis');
}

function requirePositiveInteger(
  value: number,
  path: string,
  fail: ValidationFailure,
): void {
  if (!Number.isInteger(value) || value < 1) {
    fail(path, 'entier positif requis');
  }
}
