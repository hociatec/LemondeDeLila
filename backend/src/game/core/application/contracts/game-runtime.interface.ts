import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../models/game-action.model';
import type { GameAutomaticActionPlan } from '../models/game-automation.model';
import type { GameExecutionContext } from '../models/game-execution-context.model';
import type { GameStateEntity } from '../models/game-state.model';
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
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions;
  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] | null;
  getAutomaticActions(state: GameStateEntity): GameAutomaticActionPlan | null;
  getShortcuts(context: GameShortcutsContext): GameShortcutHint[];
}

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
