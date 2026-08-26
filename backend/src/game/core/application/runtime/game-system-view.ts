import type { TurnStateEntity } from '../models/game-state.model';
import type { GameConfigurationState } from './configuration-kit';
import type { GameComponentDefinition } from './component-kit';
import type { DeclarativeState } from './game-definition';
import {
  projectGameKits,
  type DicePlayerView,
  type GameKitsPlayerView,
  type MovementPlayerView,
  type PawnSetsPlayerView,
} from './game-kit-view';
import type { CardsPlayerView } from './cards-kit';
import type { MatchKitState } from './match-kit';
import {
  projectPlayerValues,
  type PlayerStatus,
  type ScorePlayerView,
} from './player-values-kit';
import type { RoundKitState } from './round-kit';
import type { EffectSource } from './effects-kit';

export type GameTurnPlayerView = {
  currentPlayerId: number | null;
  direction: 1 | -1;
  number: number;
  actionPointsRemaining: number | null;
  immediateExtraTurns: number;
  skipTurnsByPlayer: Record<string, number>;
  extraTurnsByPlayer: Record<string, number>;
};

export type GameSetupPlayerView = {
  complete: boolean;
  phase: string;
  ownerPlayerId: number | null;
};

export type GenericBoardPlayerView = {
  movement: MovementPlayerView | null;
  pawns: PawnSetsPlayerView | null;
  grid: NonNullable<GameKitsPlayerView['grid']> | null;
};

export type GameStatusPlayerView = {
  viewer: PlayerStatus[];
  byPlayer: Record<string, PlayerStatus[]>;
};

export type GenericGamePlayerView = Omit<
  GameKitsPlayerView,
  'cards' | 'dice'
> & {
  match: MatchKitState;
  turn: GameTurnPlayerView;
  round: RoundKitState;
  board: GenericBoardPlayerView;
  cards: CardsPlayerView | null;
  dice: DicePlayerView | null;
  score: ScorePlayerView;
  scores: Record<string, number>;
  resources: Record<string, Record<string, number>>;
  counters: Record<string, number>;
  statuses: PlayerStatus[];
  status: GameStatusPlayerView;
  setup: GameSetupPlayerView;
  effect: { source: EffectSource | null };
};

export function projectGameSystemView<TState extends object>(input: {
  runtime: DeclarativeState<TState>;
  viewerPlayerId: number | null;
  components?: readonly GameComponentDefinition[];
  hasConfiguration?: boolean;
}): GenericGamePlayerView {
  const { runtime, viewerPlayerId } = input;
  const values = projectPlayerValues(
    runtime.engine.playerValues,
    viewerPlayerId,
  );
  const kits = projectGameKits(
    runtime.engine.kits,
    viewerPlayerId,
    runtime.turn?.turnNumber ?? 0,
    input.components ?? [],
  );
  return {
    ...kits,
    match: structuredClone(runtime.engine.match),
    turn: projectTurn(runtime.turn, runtime.engine.playerValues),
    round: structuredClone(runtime.engine.round),
    board: {
      movement: kits.movement ?? null,
      pawns: kits.pawns ?? null,
      grid: kits.grid ?? null,
    },
    cards: kits.cards ?? null,
    dice: kits.dice ?? null,
    score: values.scoring,
    scores: values.scores,
    resources: values.resources,
    counters: values.counters,
    statuses: values.statuses,
    status: {
      viewer: values.statuses,
      byPlayer: structuredClone(runtime.engine.playerValues.statuses),
    },
    setup: projectSetup(
      runtime.phase,
      runtime.engine.configuration,
      input.hasConfiguration ?? false,
    ),
    effect: {
      source: runtime.engine.effects.source
        ? structuredClone(runtime.engine.effects.source)
        : null,
    },
  };
}

function projectTurn(
  turn: TurnStateEntity | undefined,
  values: DeclarativeState<object>['engine']['playerValues'],
): GameTurnPlayerView {
  return {
    currentPlayerId: turn?.currentPlayerId ?? null,
    direction: turn?.direction ?? 1,
    number: turn?.turnNumber ?? 0,
    actionPointsRemaining: turn?.actionPointsRemaining ?? null,
    immediateExtraTurns: turn?.extraTurns ?? 0,
    skipTurnsByPlayer: structuredClone(values.scheduledSkips),
    extraTurnsByPlayer: structuredClone(values.scheduledExtraTurns),
  };
}

function projectSetup(
  phase: string,
  configuration: GameConfigurationState,
  hasConfiguration: boolean,
): GameSetupPlayerView {
  return {
    complete:
      phase !== 'setup' && (!hasConfiguration || configuration.complete),
    phase,
    ownerPlayerId: configuration.ownerPlayerId,
  };
}
