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

export const GAME_SYSTEM_VIEW_VERSION = 1 as const;

export type StableGameSystemView = {
  version: typeof GAME_SYSTEM_VIEW_VERSION;
  match: MatchKitState;
  round: RoundKitState;
  turn: GameTurnPlayerView;
  setup: GameSetupPlayerView;
};

export type StableGameKitsView = {
  cards: CardsPlayerView | null;
  movement: MovementPlayerView | null;
  pawns: PawnSetsPlayerView | null;
  grid: NonNullable<GameKitsPlayerView['grid']> | null;
  dice: DicePlayerView | null;
  score: ScorePlayerView;
  status: GameStatusPlayerView;
  inventory: GameKitsPlayerView['inventory'] | null;
  economy: GameKitsPlayerView['economy'] | null;
  ownership: GameKitsPlayerView['ownership'] | null;
  quiz: GameKitsPlayerView['quiz'] | null;
};

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
  viewVersion: typeof GAME_SYSTEM_VIEW_VERSION;
  system: StableGameSystemView;
  kits: StableGameKitsView;
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
  const match = structuredClone(runtime.engine.match);
  const turn = projectTurn(runtime.turn, runtime.engine.playerValues);
  const round = structuredClone(runtime.engine.round);
  const setup = projectSetup(
    runtime.phase,
    runtime.engine.configuration,
    input.hasConfiguration ?? false,
  );
  const cards = kits.cards ?? null;
  const dice = kits.dice ?? null;
  const score = values.scoring;
  const status = {
    viewer: values.statuses,
    byPlayer: structuredClone(runtime.engine.playerValues.statuses),
  };
  const board = {
    movement: kits.movement ?? null,
    pawns: kits.pawns ?? null,
    grid: kits.grid ?? null,
  };
  return {
    viewVersion: GAME_SYSTEM_VIEW_VERSION,
    system: {
      version: GAME_SYSTEM_VIEW_VERSION,
      match,
      round,
      turn,
      setup,
    },
    kits: {
      cards,
      movement: board.movement,
      pawns: board.pawns,
      grid: board.grid,
      dice,
      score,
      status,
      inventory: kits.inventory ?? null,
      economy: kits.economy ?? null,
      ownership: kits.ownership ?? null,
      quiz: kits.quiz ?? null,
    },
    ...kits,
    match,
    turn,
    round,
    setup,
    board,
    cards,
    dice,
    score,
    scores: values.scores,
    resources: values.resources,
    counters: values.counters,
    statuses: values.statuses,
    status,
    inventory: kits.inventory,
    economy: kits.economy,
    ownership: kits.ownership,
    quiz: kits.quiz,
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
