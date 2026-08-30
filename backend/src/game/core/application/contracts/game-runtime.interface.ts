import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../contracts/game-action.model';
import type { GameAutomaticActionPlan } from '../contracts/game-automation.model';
import type { GameExecutionContext } from '../contracts/game-execution-context.model';
import type { GameStateEntity } from '../contracts/game-state.model';
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
    baseState: GameStateEntity,
    context?: GameExecutionContext,
  ): GameStateEntity;
  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto;
  validateActor(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    actorId: number | null,
  ): boolean;
  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
    context?: GameExecutionContext,
  ): GameStateEntity;
  getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[];
  getActionCandidates(
    state: GameStateEntity,
    playerId: number,
    actionType: string,
    options?: GameActionCandidateQuery,
  ): GameActionCandidatePage;
  exposeStateForUser(
    state: GameStateEntity,
    userId: number | null,
  ): GameStateWithActions;
  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null;
  getAutomaticActions(state: GameStateEntity): GameAutomaticActionPlan | null;
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
