import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../models/game-action.model';
import type { GameAutomaticActionPlan } from '../models/game-automation.model';
import type { GameExecutionContext } from '../models/game-execution-context.model';
import type { GameState } from '../models/game-state.model';
import type {
  GameShortcutHint,
  GameShortcutsContext,
} from '../../../shortcuts/public-api';

/** Unique engine-facing contract. Games only author a declarative definition. */
export interface GameRuntime {
  readonly gameType: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly displayName: string;
  readonly description?: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  hydrateInitialState(
    baseState: GameState,
    context?: GameExecutionContext,
  ): GameState;
  validateAction(
    state: GameState,
    action: GameSingleActionDto,
    actorId: number | null,
    context?: GameExecutionContext,
  ): GameSingleActionDto;
  validateActor(
    state: GameState,
    actions: GameSingleActionDto[],
    actorId: number | null,
    context?: GameExecutionContext,
  ): boolean;
  applyActions(
    state: GameState,
    actions: GameSingleActionDto[],
    context?: GameExecutionContext,
  ): GameState;
  getAvailableActions(
    state: GameState,
    playerId: number,
    context?: GameExecutionContext,
  ): GameSingleActionDto[];
  getActionCandidates(
    state: GameState,
    playerId: number,
    actionType: string,
    options?: GameActionCandidateQuery,
    context?: GameExecutionContext,
  ): GameActionCandidatePage;
  exposeStateForUser(
    state: GameState,
    userId: number | null,
    context?: GameExecutionContext,
  ): GameStateWithActions;
  getBotActions(
    state: GameState,
    botPlayerId: number,
    context?: GameExecutionContext,
  ): GameSingleActionDto[] | null;
  getAutomaticActions(state: GameState): GameAutomaticActionPlan | null;
  getShortcuts(context: GameShortcutsContext): GameShortcutHint[];
  getDescriptor(): GameRuntimeDescriptor;
}

export type GameActionCandidateQuery = {
  query?: Readonly<Record<string, unknown>>;
  offset?: number;
  limit?: number;
};

export type GameActionCandidatePage = {
  actionType: string;
  items: GameSingleActionDto[];
  offset: number;
  limit: number;
  nextOffset: number | null;
};

export type GameRuntimeDescriptor = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  stateVersion: number;
  rulesVersion: string;
  players: { min: number; max: number };
  presentation?: {
    score?: {
      label: string;
      unit: { singular: string; plural: string };
      changeNarration?: 'total' | 'delta-and-total';
      visibility?: 'always' | 'active-match';
    };
  };
  actions: Array<{
    type: string;
    input: Record<string, unknown>;
    documentation?: string;
    paginatedCandidates?: boolean;
    ui?: {
      label?: string;
      icon?: string;
      intent?: 'primary' | 'secondary' | 'danger' | 'success';
      control?: 'button' | 'card' | 'player' | 'pawn' | 'number' | 'form';
      shortcut?: string;
    };
  }>;
  choices: Array<{
    id: string;
    input: Record<string, unknown>;
    documentation?: string;
    ui: {
      label: string;
      icon?: string;
      control: 'button' | 'card' | 'player' | 'pawn' | 'number' | 'form';
    };
  }>;
  phases: Array<{
    id: string;
    actions: string[];
    next?: string;
    visibility: 'public' | 'hidden';
    timeoutMs?: number;
  }>;
  components: Array<{ component: string; id?: string }>;
  patterns: Array<{ id: string; mechanics: string[] }>;
  configuration?: {
    actionType: string;
    input: Record<string, unknown>;
    defaults: Record<string, unknown>;
    permission: 'owner' | 'any-player';
    phase?: string;
    ui?: {
      title?: string;
      description?: string;
      submitLabel?: string;
    };
  };
  content?: {
    gameId: string;
    version: string;
    sections: readonly string[];
  };
};

export type GameCatalogDefinition = {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
  status?: 'construction' | 'beta' | 'finished';
  manifestPath?: string;
  rulesPath?: string;
};
