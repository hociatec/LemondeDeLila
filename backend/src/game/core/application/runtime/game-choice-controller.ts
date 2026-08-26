import type { PendingState } from '../models/game-state.model';
import {
  GameConfigurationError,
  GameStateViolationError,
} from '../../domain/errors/game-domain.errors';

export type ChoiceTimeout<TValue> = {
  afterMs: number;
  strategy?: 'first' | 'last' | 'random' | 'default' | 'pass';
  value?: TValue;
};

export type ChoiceOptions<TValue> = {
  id: string;
  player: number;
  options: readonly TValue[];
  timeout?: ChoiceTimeout<TValue>;
  label?: (value: TValue) => string;
  data?: Readonly<object>;
};

export class GameChoiceController {
  private resolvedData: Record<string, unknown> | null = null;

  constructor(
    private readonly getPending: () => PendingState | null | undefined,
    private readonly setPending: (pending: PendingState | null) => void,
    private readonly nowMs: () => number,
  ) {}

  one<TValue>(options: ChoiceOptions<TValue>): void {
    this.create('one', options, 1, 1);
  }

  many<TValue>(
    options: ChoiceOptions<TValue> & { min?: number; max?: number },
  ): void {
    this.create(
      'many',
      options,
      options.min ?? 0,
      options.max ?? options.options.length,
    );
  }

  player(options: ChoiceOptions<number>): void {
    this.create('player', options, 1, 1);
  }

  card(options: ChoiceOptions<string>): void {
    this.create('card', options, 1, 1);
  }

  pawn(options: ChoiceOptions<string>): void {
    this.create('pawn', options, 1, 1);
  }

  number(
    options: Omit<ChoiceOptions<number>, 'options'> & {
      min: number;
      max: number;
      step?: number;
    },
  ): void {
    const step = Math.max(1, Math.floor(options.step ?? 1));
    const count = Math.floor((options.max - options.min) / step) + 1;
    if (count < 1 || count > 1_000) {
      throw new GameConfigurationError(
        'Intervalle de choix numérique invalide',
      );
    }
    this.create(
      'number',
      {
        ...options,
        options: Array.from(
          { length: count },
          (_entry, index) => options.min + index * step,
        ),
      },
      1,
      1,
    );
  }

  ordering<TValue>(options: ChoiceOptions<TValue>): void {
    this.create(
      'ordering',
      options,
      options.options.length,
      options.options.length,
    );
  }

  vote(options: ChoiceOptions<number>): void {
    this.create('vote', options, 1, 1);
  }

  players(options: ChoiceOptions<number> & { min: number; max: number }): void {
    this.create('players', options, options.min, options.max);
  }

  confirm(options: Omit<ChoiceOptions<boolean>, 'options'>): void {
    this.create('confirm', { ...options, options: [true, false] }, 1, 1);
  }

  forPlayers<TValue>(
    options: Omit<ChoiceOptions<TValue>, 'player'> & {
      players: readonly number[];
    },
  ): void {
    const playerIds = [...new Set(options.players)];
    if (playerIds.length === 0) {
      throw new GameConfigurationError('Un choix collectif requiert des joueurs');
    }
    this.create(
      'one',
      { ...options, player: playerIds[0] },
      1,
      1,
      { playerIds },
    );
  }

  sequence<TValue>(options: {
    id: string;
    players: readonly number[];
    options: readonly TValue[] | ((playerId: number) => readonly TValue[]);
    timeout?: ChoiceTimeout<TValue>;
    label?: (value: TValue) => string;
    data?: Readonly<object>;
  }): void {
    const playerIds = [...new Set(options.players)];
    for (const [index, playerId] of playerIds.entries()) {
      const values =
        typeof options.options === 'function'
          ? options.options(playerId)
          : options.options;
      this.create(
        'one',
        {
          id: options.id,
          player: playerId,
          options: values,
          timeout: options.timeout,
          label: options.label,
          data: options.data,
        },
        1,
        1,
        { enqueue: index > 0 },
      );
    }
  }

  current(): PendingState | null {
    return this.getPending() ?? null;
  }

  data<TData extends object>(): TData | null {
    const data = this.current()?.data ?? this.resolvedData;
    return data ? (structuredClone(data) as TData) : null;
  }

  consumeData<TData extends object>(): TData | null {
    const data = this.data<TData>();
    this.resolvedData = null;
    return data;
  }

  clear(): void {
    this.promoteQueue();
  }

  resolvePlayer(playerId: number): void {
    const pending = this.current();
    this.resolvedData = structuredClone(pending?.data ?? {});
    if (!pending?.playerIds?.length) {
      this.promoteQueue();
      return;
    }
    pending.resolvedPlayerIds = [
      ...new Set([...(pending.resolvedPlayerIds ?? []), playerId]),
    ];
    if (
      pending.playerIds.every((participantId) =>
        pending.resolvedPlayerIds?.includes(participantId),
      )
    ) {
      this.promoteQueue();
    } else {
      this.setPending(pending);
    }
  }

  private create<TValue>(
    kind:
      | 'one'
      | 'many'
      | 'player'
      | 'players'
      | 'card'
      | 'pawn'
      | 'number'
      | 'ordering'
      | 'vote'
      | 'confirm',
    options: ChoiceOptions<TValue>,
    min: number,
    max: number,
    mode: { enqueue?: boolean; playerIds?: number[] } = {},
  ): void {
    if (this.current() && !mode.enqueue) {
      throw new GameStateViolationError('Un choix est déjà en attente');
    }
    const values = [...options.options];
    const pending: PendingState = {
      type: `engine.choice.${kind}`,
      label: 'Choix requis',
      playerId: options.player,
      ...(mode.playerIds
        ? { playerIds: [...mode.playerIds], resolvedPlayerIds: [] }
        : {}),
      blocking: true,
      choices: values.map((value) => options.label?.(value) ?? String(value)),
      data: {
        ...structuredClone(options.data ?? {}),
        kind,
        choiceId: options.id,
        options: values,
        min,
        max,
        timeoutStrategy: options.timeout?.strategy ?? 'first',
        ...(options.timeout?.value === undefined
          ? {}
          : { timeoutValue: options.timeout.value }),
        deadlineMs:
          options.timeout == null
            ? null
            : this.nowMs() + Math.max(0, options.timeout.afterMs),
      },
    };
    if (!this.current()) {
      this.setPending(pending);
      return;
    }
    const current = this.current();
    if (!current) return;
    current.queue = [...(current.queue ?? []), pending];
    this.setPending(current);
  }

  private promoteQueue(): void {
    const current = this.current();
    const [next, ...queue] = current?.queue ?? [];
    this.setPending(next ? { ...next, queue } : null);
  }
}
