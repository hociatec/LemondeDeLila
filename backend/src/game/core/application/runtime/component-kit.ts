import type { PlayerStateEntity } from '../models/game-state.model';
import type { GameContext } from './game-rule-context';
import type {
  CardSetsDefinition,
  DeckDefinition,
  HandsDefinition,
} from './cards-kit';
import type { DiceDefinition } from './dice-kit';
import type { GridDefinition } from './grid-kit';
import type { InventoryDefinition } from './inventory-kit';
import type { MarketDefinition } from './economy-kit';
import type { OwnershipDefinition } from './ownership-kit';
import type { TrackDefinition } from './movement-kit';
import type { QuizDefinition } from './quiz-kit';
import type { PawnSetDefinition } from './pawn-kit';

type GameComponent =
  | DeckDefinition<unknown>
  | HandsDefinition
  | CardSetsDefinition
  | InventoryDefinition
  | MarketDefinition
  | OwnershipDefinition
  | DiceDefinition
  | GridDefinition
  | TrackDefinition
  | PawnSetDefinition
  | QuizDefinition;

export type GameComponentScope = 'match' | 'round';

export type GameComponentDefinition = GameComponent & {
  readonly scope?: GameComponentScope;
  /** Component key deliberately replaced from a pattern. */
  readonly overrides?: string;
};

export function overrideComponent<TComponent extends GameComponentDefinition>(
  component: TComponent,
): TComponent {
  return Object.freeze({
    ...component,
    overrides: `${component.component}:${component.id}`,
  }) as TComponent;
}

export function roundScoped<TComponent extends GameComponent>(
  component: TComponent,
): TComponent & { readonly scope: 'round' } {
  return Object.freeze({
    ...component,
    scope: 'round',
  }) as unknown as TComponent & {
    readonly scope: 'round';
  };
}

export function matchScoped<TComponent extends GameComponent>(
  component: TComponent,
): TComponent & { readonly scope: 'match' } {
  return Object.freeze({
    ...component,
    scope: 'match',
  }) as unknown as TComponent & {
    readonly scope: 'match';
  };
}

export type PerPlayerInitialValue = number | Readonly<Record<string, number>>;

export type GameInitialization = {
  /** Explicit keys intentionally replacing pattern initialization. */
  overrides?: readonly string[];
  firstPlayer?: 'first' | 'random' | number;
  startRound?: boolean;
  scores?: PerPlayerInitialValue;
  resources?: Readonly<Record<string, PerPlayerInitialValue>>;
  counters?: Readonly<Record<string, number>>;
  tracks?: Readonly<Record<string, PerPlayerInitialValue>>;
  pawns?: readonly {
    setId: string;
    assignment?: 'round-robin' | 'grouped' | 'random';
  }[];
};

export function overrideInitialization(
  overrides: readonly string[],
  initialization: Omit<GameInitialization, 'overrides'>,
): GameInitialization {
  return Object.freeze({
    ...initialization,
    overrides: Object.freeze([...overrides]),
  });
}

export function installGameComponents<TState extends object>(
  components: readonly GameComponentDefinition[],
  players: readonly PlayerStateEntity[],
  context: GameContext<TState>,
): void {
  for (const component of components) {
    if (component.component === 'cards.deck')
      context.cards.createDeck(component);
    else if (component.component === 'cards.hands') {
      context.cards.createHands(
        component,
        players.map((player) => player.id),
      );
    } else if (component.component === 'cards.sets') {
      context.cards.createSets(
        component,
        players.map((player) => player.id),
      );
    } else if (component.component === 'inventory.set') {
      context.inventory.create(
        component,
        players.map((player) => player.id),
      );
    } else if (component.component === 'economy.market') {
      context.economy.create(component);
    } else if (component.component === 'ownership.registry') {
      context.ownership.create(component);
    } else if (component.component === 'movement.track') {
      context.movement.createTrack(component);
    } else if (component.component === 'pawn.set') {
      context.pawns.create(component);
    } else if (component.component === 'dice.set')
      context.dice.create(component);
    else if (component.component === 'grid.board')
      context.grid.create(component);
    else if (component.component === 'quiz.bank')
      context.quiz.create(component);
  }
}

/** Clears and reinstalls every component owned by the requested lifecycle. */
export function resetGameComponents<TState extends object>(
  scope: GameComponentScope,
  components: readonly GameComponentDefinition[],
  players: readonly PlayerStateEntity[],
  context: GameContext<TState>,
): void {
  const scoped = components.filter(
    (component) => (component.scope ?? 'match') === scope,
  );
  for (const component of scoped) {
    if (component.component === 'cards.deck')
      context.cards.removeDeck(component.id);
    else if (component.component === 'cards.hands')
      context.cards.resetHands(component.id);
    else if (component.component === 'cards.sets')
      context.cards.resetSets(component.id);
    else if (component.component === 'inventory.set')
      context.inventory.reset(component.id);
    else if (component.component === 'economy.market')
      context.economy.reset(component.id);
    else if (component.component === 'ownership.registry')
      context.ownership.reset(component.id);
    else if (component.component === 'movement.track')
      context.movement.resetTrack(component.id);
    else if (component.component === 'pawn.set')
      context.pawns.reset(component.id);
    else if (component.component === 'dice.set')
      context.dice.reset(component.id);
    else if (component.component === 'grid.board')
      context.grid.reset(component.id);
    else if (component.component === 'quiz.bank')
      context.quiz.reset(component.id);
  }
  installGameComponents(scoped, players, context);
  if (scoped.length > 0) {
    context.events.emit('components.reset', {
      scope,
      componentIds: scoped.map((component) => component.id),
    });
  }
}

export function initializeGameComponents<TState extends object>(
  initialization: GameInitialization | undefined,
  players: readonly PlayerStateEntity[],
  context: GameContext<TState>,
): void {
  if (!initialization) return;
  for (const player of players) {
    if (initialization.scores != null) {
      context.score.set(
        player.id,
        initialValue(initialization.scores, player.id),
      );
    }
    for (const [resource, values] of Object.entries(
      initialization.resources ?? {},
    )) {
      context.resources.set(
        player.id,
        resource,
        initialValue(values, player.id),
      );
    }
    for (const [trackId, values] of Object.entries(
      initialization.tracks ?? {},
    )) {
      context.movement.moveTo(
        trackId,
        player.id,
        initialValue(values, player.id),
      );
    }
  }
  for (const [counter, value] of Object.entries(
    initialization.counters ?? {},
  )) {
    context.counters.set(counter, value);
  }
  for (const pawnSetup of initialization.pawns ?? []) {
    const available = context.pawns.available(pawnSetup.setId);
    const ordered =
      pawnSetup.assignment === 'random'
        ? context.random.shuffle(available)
        : available;
    const perPlayer = context.pawns.perPlayer(pawnSetup.setId);
    for (let slot = 0; slot < perPlayer; slot += 1) {
      for (const [index, player] of players.entries()) {
        const pawn =
          pawnSetup.assignment === 'grouped'
            ? ordered[index * perPlayer + slot]
            : ordered[slot * players.length + index];
        if (pawn) context.pawns.assign(pawnSetup.setId, player.id, pawn.id);
      }
    }
  }
  const firstPlayer =
    typeof initialization.firstPlayer === 'number'
      ? context.players.get(initialization.firstPlayer)
      : initialization.firstPlayer === 'random'
        ? context.random.pick(players)
        : players[0];
  if (!firstPlayer) return;
  context.turn.to(firstPlayer.id);
  if (initialization.startRound ?? true) context.round.start(firstPlayer.id);
}

function initialValue(values: PerPlayerInitialValue, playerId: number): number {
  return typeof values === 'number' ? values : (values[String(playerId)] ?? 0);
}
