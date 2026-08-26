import type { PendingState } from '../models/game-state.model';

type ChoiceOptions<TValue> = {
  id: string;
  player: number;
  options: readonly TValue[];
  timeoutMs?: number;
  label?: (value: TValue) => string;
};

export class GameChoiceController {
  constructor(
    private readonly getPending: () => PendingState | null | undefined,
    private readonly setPending: (pending: PendingState | null) => void,
    private readonly nowMs: () => number,
  ) {}

  one<TValue>(options: ChoiceOptions<TValue>): void {
    this.create('one', options, 1, 1);
  }

  players(options: ChoiceOptions<number> & { min: number; max: number }): void {
    this.create('players', options, options.min, options.max);
  }

  confirm(options: Omit<ChoiceOptions<boolean>, 'options'>): void {
    this.create('confirm', { ...options, options: [true, false] }, 1, 1);
  }

  current(): PendingState | null {
    return this.getPending() ?? null;
  }

  clear(): void {
    this.setPending(null);
  }

  private create<TValue>(
    kind: 'one' | 'players' | 'confirm',
    options: ChoiceOptions<TValue>,
    min: number,
    max: number,
  ): void {
    if (this.current()) throw new Error('Un choix est déjà en attente');
    const values = [...options.options];
    this.setPending({
      type: `engine.choice.${kind}`,
      label: 'Choix requis',
      playerId: options.player,
      blocking: true,
      choices: values.map((value) => options.label?.(value) ?? String(value)),
      data: {
        kind,
        choiceId: options.id,
        options: values,
        min,
        max,
        deadlineMs:
          options.timeoutMs == null
            ? null
            : this.nowMs() + Math.max(0, options.timeoutMs),
      },
    });
  }
}
