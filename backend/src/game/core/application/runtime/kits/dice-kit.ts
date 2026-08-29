import type { GameRng } from '../../models/game-execution-context.model';
import {
  GameConfigurationError,
  GameStateViolationError,
} from '../../../domain/errors/game-domain.errors';

export type DiceDefinition = {
  readonly component: 'dice.set';
  readonly id: string;
  readonly count: number;
  readonly sides: number;
};

export type DiceKitState = {
  rolls: Record<string, { values: number[]; total: number }>;
  rollsByPlayer: Record<
    string,
    Record<string, { values: number[]; total: number }>
  >;
  lastRollId: string | null;
  sequence: number;
};

export type DiceRollResult = { values: number[]; total: number };

export type DiceRollPolicy = {
  extraDice?: number;
  attempts?: number;
  select?: 'first' | 'last' | 'best' | 'worst';
  keep?: 'all' | 'highest' | 'lowest';
  modifier?: number;
  multiplier?: number;
  reroll?: {
    while(result: Readonly<DiceRollResult>): boolean;
    max?: number;
  };
};

export function diceKit(options: {
  id?: string;
  count: number;
  sides: number;
}): DiceDefinition {
  const count = Math.floor(options.count);
  const sides = Math.floor(options.sides);
  if (count < 1 || sides < 2) {
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
    this.state.lastRollId ??= Object.keys(this.state.rolls).at(-1) ?? null;
    this.state.sequence ??= Object.keys(this.state.rolls).length;
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
    const legacy = this.state as DiceKitState & {
      sets?: Record<string, Omit<DiceDefinition, 'component'>>;
    };
    for (const definition of Object.values(legacy.sets ?? {})) {
      this.definitions.set(definition.id, {
        ...definition,
        component: 'dice.set',
      });
    }
    delete legacy.sets;
  }

  private readonly definitions = new Map<string, DiceDefinition>();

  create(definition: DiceDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  reset(id: string): void {
    this.definitions.delete(id);
    delete this.state.rolls[id];
    if (this.state.lastRollId === id) {
      this.state.lastRollId = Object.keys(this.state.rolls).at(-1) ?? null;
    }
  }

  assertValid(): void {
    for (const [id, roll] of Object.entries(this.state.rolls)) {
      const definition = this.definitions.get(id) ?? { count: 1, sides: 6 };
      if (
        !Array.isArray(roll.values) ||
        roll.values.length < 1 ||
        roll.values.some(
          (value) =>
            !Number.isInteger(value) || value < 1 || value > definition.sides,
        ) ||
        !Number.isFinite(roll.total)
      ) {
        throw new GameStateViolationError('Résultat de dés invalide', { id });
      }
    }
  }

  roll(id = 'main'): DiceRollResult {
    return this.rollWith(id);
  }

  rollWith(id = 'main', policy: DiceRollPolicy = {}): DiceRollResult {
    const definition = this.definitions.get(id) ?? { id, count: 1, sides: 6 };
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
      const current = results.at(-1)!;
      if (!policy.reroll?.while(current)) break;
      results.push(this.rawRoll(definition.count, definition.sides));
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
    this.state.rolls[id] = result;
    const actorPlayerId = this.actorPlayerId();
    if (actorPlayerId != null) {
      (this.state.rollsByPlayer[String(actorPlayerId)] ??= {})[id] =
        structuredClone(result);
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
    return structuredClone(this.state.rolls[id] ?? null);
  }

  private rawRoll(count: number, sides: number): DiceRollResult {
    const values = Array.from(
      { length: count },
      () => this.random.int(sides) + 1,
    );
    return { values, total: values.reduce((sum, value) => sum + value, 0) };
  }
}

function selectRoll(
  results: readonly DiceRollResult[],
  selection: NonNullable<DiceRollPolicy['select']>,
): DiceRollResult {
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
  return results.at(-1)!;
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
