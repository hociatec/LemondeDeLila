import type { GameRng } from '../models/game-execution-context.model';

export type DiceDefinition = {
  readonly component: 'dice.set';
  readonly id: string;
  readonly count: number;
  readonly sides: number;
};

export type DiceKitState = {
  sets: Record<string, Omit<DiceDefinition, 'component'>>;
  rolls: Record<string, { values: number[]; total: number }>;
};

export function diceKit(options: {
  id?: string;
  count: number;
  sides: number;
}): DiceDefinition {
  const count = Math.floor(options.count);
  const sides = Math.floor(options.sides);
  if (count < 1 || sides < 2) throw new Error('Configuration de dés invalide');
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
  ) {}

  create(definition: DiceDefinition): void {
    this.state.sets[definition.id] = {
      id: definition.id,
      count: definition.count,
      sides: definition.sides,
    };
  }

  roll(id = 'main'): { values: number[]; total: number } {
    const definition = this.state.sets[id] ?? { id, count: 1, sides: 6 };
    const values = Array.from(
      { length: definition.count },
      () => this.random.int(definition.sides) + 1,
    );
    const result = {
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    };
    this.state.rolls[id] = result;
    return structuredClone(result);
  }

  last(id = 'main'): { values: number[]; total: number } | null {
    return structuredClone(this.state.rolls[id] ?? null);
  }
}

export function createDiceKitState(): DiceKitState {
  return { sets: {}, rolls: {} };
}
