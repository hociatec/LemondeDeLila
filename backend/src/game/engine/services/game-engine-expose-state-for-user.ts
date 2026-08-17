import type { BoardPayloadService } from '../../modules/board/services/board-payload.service';
import type { GridRenderService } from '../../modules/grid/services/grid-render.service';
import type { TurnLabelService } from '../../modules/turn/services/turn-label.service';
import { fixMojibakeDeep } from '@common/utils/mojibake';
import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../dto/game-action.dto';
import type { GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { attachUiDescriptors } from './game-engine-ui-descriptors';
import {
  attachCurrentPlayerView,
  attachTurnLabel,
  stripBoardAndGridIfNotStarted,
} from './game-engine-presentation';
import { attachViewerContext } from './game-engine-viewer-context';
import { attachStartLifecycle } from './game-engine-lifecycle';
import { attachShortcuts } from './game-engine-shortcuts';
import {
  attachPendingChoiceActions,
  attachSyntheticPendingFromActions,
} from './game-engine-pending-presentation';
import { attachCanonicalPositionPanel } from './game-engine-position-panel';

export function exposeGameStateForUser(params: {
  state: GameStateEntity;
  gameType: string;
  userId: number;
  turnLabel: TurnLabelService;
  registryGetHandler: (gameType: string) => GameRulesAdapter | undefined;
  gridRender: GridRenderService;
  boardPayload: BoardPayloadService;
  normalizeMetadataString: (value: unknown) => string;
}): GameStateWithActions {
  const {
    state,
    gameType,
    userId,
    turnLabel,
    registryGetHandler,
    gridRender,
    boardPayload,
    normalizeMetadataString,
  } = params;

  const label = turnLabel.compute(state, gameType);
  const handler = registryGetHandler(gameType);
  const exposed = handler?.exposeStateForUser
    ? handler.exposeStateForUser(state, userId)
    : handler?.exposeState
      ? handler.exposeState(state)
      : (state as GameStateWithActions);

  const withLabel = attachTurnLabel(exposed, label);
  const withDescriptors = attachCanonicalPositionPanel({
    state: attachUiDescriptors({
      state: gridRender.attachGridRenderDescriptors(
        attachViewerContext(attachCurrentPlayerView(withLabel), userId),
      ),
      normalizeString: normalizeMetadataString,
    }),
    internal: state,
    userId,
    boardPayload,
    normalizeString: normalizeMetadataString,
  });

  const withShortcuts = attachShortcuts({ state: withDescriptors, handler });
  const withLifecycle = attachStartLifecycle({ state: withShortcuts, userId });
  const withSyntheticPending = attachSyntheticPendingFromActions(withLifecycle);
  const withChoiceActions = attachPendingChoiceActions(withSyntheticPending);
  return fixMojibakeDeep(stripBoardAndGridIfNotStarted(withChoiceActions));
}
