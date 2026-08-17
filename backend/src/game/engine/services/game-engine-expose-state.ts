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
import { attachStartLifecycle } from './game-engine-lifecycle';
import { attachCanonicalPositionPanel } from './game-engine-position-panel';

export function exposeGameState(params: {
  state: GameStateEntity;
  gameType: string;
  turnLabel: TurnLabelService;
  registryGetHandler: (gameType: string) => GameRulesAdapter | undefined;
  gridRender: GridRenderService;
  boardPayload: BoardPayloadService;
  normalizeMetadataString: (value: unknown) => string;
}): GameStateWithActions {
  const {
    state,
    gameType,
    turnLabel,
    registryGetHandler,
    gridRender,
    boardPayload,
    normalizeMetadataString,
  } = params;

  // Le label de tour doit rester aligné avec l'état interne (source de vérité),
  // même si exposeState() d'un jeu masque/transforme la liste des joueurs.
  const label = turnLabel.compute(state, gameType);
  const handler = registryGetHandler(gameType);
  const exposed = handler?.exposeState
    ? handler.exposeState(state)
    : (state as GameStateWithActions);
  const withLabel = attachTurnLabel(exposed, label);

  const withDescriptors = attachCanonicalPositionPanel({
    state: attachUiDescriptors({
      state: gridRender.attachGridRenderDescriptors(
        attachCurrentPlayerView(withLabel),
      ),
      normalizeString: normalizeMetadataString,
    }),
    internal: state,
    userId: null,
    boardPayload,
    normalizeString: normalizeMetadataString,
  });

  const withLifecycle = attachStartLifecycle({ state: withDescriptors });
  return fixMojibakeDeep(stripBoardAndGridIfNotStarted(withLifecycle));
}

