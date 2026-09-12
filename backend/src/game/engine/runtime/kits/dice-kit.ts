import type { GameRng } from '../../../core/application/models/game-execution-context.model';
import { assertGameCount, assertGameValue } from './numeric-invariants';
import { assertDiceRoll } from './dice-roll-contract';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type {
  DiceDefinition,
  DiceRollPolicy,
  DiceRollResult,
  PersistedDiceRoll,
} from './dice-contracts';

export type {
  DiceDefinition,
  DiceRollPolicy,
  DiceRollResult,
  PersistedDiceRoll,
} from './dice-contracts';

export type DiceKitState = {
  rolls: Record<string, PersistedDiceRoll>;
  rollsByPlayer: Record<string, Record<string, PersistedDiceRoll>>;
  lastRollId: string | null;
  sequence: number;
};

export function diceKit(options: {
  id?: string;
  count: number;
  sides: number;
}): DiceDefinition {
  const count = Math.floor(options.count);
  const sides = Math.floor(options.sides);
  if (
    !Number.isSafeInteger(options.count) ||
    !Number.isSafeInteger(options.sides) ||
    count < 1 ||
    count > 100 ||
    sides < 2 ||
    sides > 1_000_000
  ) {
    throw new GameConfigurationError('Configuration de dés invalide');
  }
  return Object.freeze({
    component: 'dice.set',
    id: options.id ?? 'main',
    count,
    sides,
  });
}

export class GameDiceController {
  constructor(
    private readonly state: DiceKitState,
    private readonly random: GameRng,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void = () => {},
    definitions: readonly DiceDefinition[] = [],
    private readonly actorPlayerId: () => number | null = () => null,
  ) {
    this.state.rollsByPlayer ??= {};
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
    this.state.lastRollId ??= this.fallbackLastRollId();
    this.state.sequence ??= Object.keys(this.state.rolls).length;
  }

  private readonly definitions = new Map<string, DiceDefinition>();

  create(definition: DiceDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  reset(id: string): void {
    this.definitions.delete(id);
    delete this.state.rolls[id];
    for (const rolls of Object.values(this.state.rollsByPlayer))
      delete rolls[id];
    if (this.state.lastRollId === id) {
      this.state.lastRollId = this.fallbackLastRollId();
    }
  }

  assertValid(): void {
    assertGameCount(this.state.sequence);
    const rolls = [
      this.state.rolls,
      ...Object.values(this.state.rollsByPlayer),
    ];
    for (const [id, roll] of rolls.flatMap((collection) =>
      Object.entries(collection),
    )) {
      const definition = this.definitions.get(id) ?? { count: 1, sides: 6 };
      assertDiceRoll(id, roll, definition);
    }
  }

  roll(id = 'main'): DiceRollResult {
    return this.rollWith(id);
  }

  rollWith(id = 'main', policy: DiceRollPolicy = {}): DiceRollResult {
    const definition = this.definitions.get(id) ?? { id, count: 1, sides: 6 };
    assertGameCount(this.state.sequence, Number.MAX_SAFE_INTEGER - 1);
    assertGameCount(definition.count, 100);
    assertGameCount(definition.sides, 1_000_000);
    assertGameCount(policy.extraDice ?? 0, 100);
    assertGameCount(policy.attempts ?? 1, 100);
    assertGameCount(policy.reroll?.max ?? 0, 100);
    assertGameValue(policy.modifier ?? 0);
    assertGameValue(policy.multiplier ?? 1);
    assertGameValue(
      (definition.count + (policy.extraDice ?? 0)) *
        definition.sides *
        Math.abs(policy.multiplier ?? 1) +
        Math.abs(policy.modifier ?? 0),
    );
    if (
      definition.count < 1 ||
      definition.sides < 2 ||
      (policy.attempts ?? 1) < 1 ||
      !['all', 'highest', 'lowest'].includes(policy.keep ?? 'all') ||
      !['first', 'last', 'best', 'worst'].includes(policy.select ?? 'last')
    )
      throw new GameConfigurationError('Configuration de dés invalide');
    const results = Array.from(
      { length: Math.max(1, Math.floor(policy.attempts ?? 1)) },
      () =>
        this.rawRoll(
          definition.count + Math.max(0, Math.floor(policy.extraDice ?? 0)),
          definition.sides,
        ),
    );
    const maximumRerolls = Math.max(0, Math.floor(policy.reroll?.max ?? 0));
    for (let rerolls = 0; rerolls < maximumRerolls; rerolls += 1) {
      const current = selectRoll(results, 'last');
      if (!policy.reroll?.while(structuredClone(current))) break;
      results.push(
        this.rawRoll(
          definition.count + (policy.extraDice ?? 0),
          definition.sides,
        ),
      );
    }
    const selected = selectRoll(results, policy.select ?? 'last');
    const values = keepValues(selected.values, policy.keep ?? 'all');
    const result = {
      values,
      total:
        values.reduce((sum, value) => sum + value, 0) *
          (policy.multiplier ?? 1) +
        (policy.modifier ?? 0),
    };
    const persisted: PersistedDiceRoll = {
      ...result,
      policy: {
        extraDice: policy.extraDice ?? 0,
        keep: policy.keep ?? 'all',
        multiplier: policy.multiplier ?? 1,
        modifier: policy.modifier ?? 0,
      },
    };
    assertDiceRoll(id, persisted, definition);
    this.state.rolls[id] = persisted;
    const actorPlayerId = this.actorPlayerId();
    if (actorPlayerId != null) {
      (this.state.rollsByPlayer[String(actorPlayerId)] ??= {})[id] =
        structuredClone(persisted);
    }
    this.state.lastRollId = id;
    this.state.sequence += 1;
    this.emit('dice.rolled', {
      diceId: id,
      ...result,
      attempts: results.length,
      selection: policy.select ?? 'last',
    });
    return structuredClone(result);
  }

  bestOf(rolls: number, id = 'main'): DiceRollResult {
    return this.rollWith(id, { attempts: rolls, select: 'best' });
  }

  worstOf(rolls: number, id = 'main'): DiceRollResult {
    return this.rollWith(id, { attempts: rolls, select: 'worst' });
  }

  last(id = 'main'): { values: number[]; total: number } | null {
    const result = this.state.rolls[id];
    return result ? { values: [...result.values], total: result.total } : null;
  }

  private fallbackLastRollId(): string | null {
    const declared = [...this.definitions.keys()].filter(
      (id) => this.state.rolls[id] != null,
    );
    return (
      declared.at(-1) ??
      Object.keys(this.state.rolls).sort(compareIds).at(-1) ??
      null
    );
  }

  private rawRoll(count: number, sides: number): DiceRollResult {
    const values = Array.from(
      { length: count },
      () => this.random.int(sides) + 1,
    );
    return { values, total: values.reduce((sum, value) => sum + value, 0) };
  }
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectRoll(
  results: readonly DiceRollResult[],
  selection: NonNullable<DiceRollPolicy['select']>,
): DiceRollResult {
  if (results.length === 0)
    throw new GameConfigurationError('Aucun lancer de dés à sélectionner');
  if (selection === 'first') return results[0];
  if (selection === 'best') {
    return results.reduce((best, current) =>
      current.total > best.total ? current : best,
    );
  }
  if (selection === 'worst') {
    return results.reduce((worst, current) =>
      current.total < worst.total ? current : worst,
    );
  }
  return results[results.length - 1];
}

function keepValues(
  values: readonly number[],
  keep: NonNullable<DiceRollPolicy['keep']>,
): number[] {
  if (keep === 'highest') return [Math.max(...values)];
  if (keep === 'lowest') return [Math.min(...values)];
  return [...values];
}

export function createDiceKitState(): DiceKitState {
  return { rolls: {}, rollsByPlayer: {}, lastRollId: null, sequence: 0 };
}
