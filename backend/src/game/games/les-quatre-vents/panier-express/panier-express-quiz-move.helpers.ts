import { GameStateEntity } from '../../../application/models/game-state.model';
import { GameSingleActionDto } from '../../../models/game-action.model';
import {
  PanierExpressMetadata,
  PanierExpressPlayer,
  PanierExpressTile,
} from './model/panier-express-state.model';

export function handlePanierExpressAnswerQuiz(args: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  getActorIdFromAction: (action: GameSingleActionDto) => number | null;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  validateAnswer: (
    quizState: PanierExpressMetadata['quiz'],
    playerId: number,
    answer: string,
  ) => { correct: boolean; state: PanierExpressMetadata['quiz'] };
  appendActionLog: (
    state: GameStateEntity,
    playerId: number,
    type: string,
    payload?: Record<string, unknown>,
  ) => GameStateEntity;
  queueCourseDraws: (
    state: GameStateEntity,
    tasks: Array<{ playerId: number; standId?: string }>,
    label: string,
  ) => GameStateEntity;
  advanceTurn: (state: GameStateEntity) => GameStateEntity;
}): GameStateEntity {
  const playerId =
    args.getActorIdFromAction(args.action) ??
    args.state.turn?.currentPlayerId ??
    null;
  if (typeof playerId !== 'number') {
    return args.state;
  }

  const metadata = args.getMetadata(args.state);
  const quizState = metadata.quiz;
  const pending = quizState.pending[playerId];
  if (!pending) {
    return args.appendLog(
      args.state,
      `[Panier Express] Pas de question en attente pour ${args.playerName(args.state, playerId)}.`,
    );
  }

  const answer =
    typeof args.action.payload?.answer === 'string'
      ? args.action.payload.answer
      : null;
  if (!answer) {
    return args.appendLog(
      args.state,
      `[Panier Express] Quiz : rÃƒÆ’Ã‚Â©ponse manquante pour ${args.playerName(args.state, playerId)}.`,
    );
  }

  const result = args.validateAnswer(quizState, playerId, answer);
  const outcomeEntry = {
    correct: result.correct,
    message: result.correct ? 'Bonne rÃƒÆ’Ã‚Â©ponse !' : 'Mauvaise rÃƒÆ’Ã‚Â©ponse !',
    timestamp: Date.now(),
  };

  let next: GameStateEntity = {
    ...args.state,
    metadata: {
      ...metadata,
      quiz: result.state,
      quizOutcome: {
        ...(metadata.quizOutcome ?? {}),
        [playerId]: outcomeEntry,
      },
    },
    pending: null,
  };
  next = args.appendLog(
    next,
    `[Panier Express] RÃƒÆ’Ã‚Â©ponse ${result.correct ? 'correcte' : 'incorrecte'} pour ${args.playerName(args.state, playerId)}.`,
  );
  next = args.appendActionLog(next, playerId, 'answer_quiz', {
    correct: result.correct,
  });

  if (result.correct) {
    next = args.appendLog(next, '[Panier Express] Piochez un ingrÃƒÆ’Ã‚Â©dient.');
    next = args.queueCourseDraws(
      next,
      [{ playerId, standId: 'bonus' }],
      'Piocher une course bonus (Espace).',
    );
    if (next.pending) {
      return next;
    }
  }

  return args.advanceTurn(next);
}

export function applyPanierExpressMoveDelta(args: {
  state: GameStateEntity;
  playerId: number;
  delta: number;
  movePlayer: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  resolveTile: (state: GameStateEntity, playerId: number) => GameStateEntity;
}): GameStateEntity {
  if (!args.delta || args.delta === 0) {
    return args.state;
  }
  const next = args.movePlayer(args.state, args.playerId, args.delta);
  return args.resolveTile(next, args.playerId);
}

export function applyPanierExpressMoveChoice(args: {
  state: GameStateEntity;
  playerId: number;
  delta: number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const steps = Math.max(1, Math.abs(args.delta || 2));
  if (args.state.pending) {
    return args.appendLog(
      args.state,
      `[Panier Express] Un autre choix est dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â  en attente.`,
    );
  }

  return {
    ...args.state,
    pending: {
      type: 'pick',
      playerId: args.playerId,
      blocking: true,
      label: `Choisissez : avancer ou reculer de ${steps} cases, puis EntrÃƒÆ’Ã‚Â©e.`,
      choices: [`Avancer (+${steps})`, `Reculer (-${steps})`],
      data: { kind: 'tile.move_choice', delta: steps },
    },
  };
}

export function applyPanierExpressMoveToStandChoice(args: {
  state: GameStateEntity;
  playerId: number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  ensureMetadata: (state: GameStateEntity) => GameStateEntity;
  getMetadata: (state: GameStateEntity) => PanierExpressMetadata;
  buildTiles: () => PanierExpressTile[];
  tileLabel: (tile: PanierExpressTile | undefined) => string;
}): GameStateEntity {
  if (args.state.pending) {
    return args.appendLog(
      args.state,
      `[Panier Express] Un autre choix est dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â  en attente.`,
    );
  }

  const ensured = args.ensureMetadata(args.state);
  const metadata = args.getMetadata(ensured);
  const tiles =
    Array.isArray(metadata.tiles) && metadata.tiles.length
      ? metadata.tiles
      : args.buildTiles();
  const stands = tiles
    .map((tile, index) => {
      if (tile?.type !== 'stand') {
        return null;
      }
      return {
        position: index,
        label: args.tileLabel(tile),
        standId: tile.standId,
        caseNumber: index + 1,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        position: number;
        label: string;
        standId: string;
        caseNumber: number;
      } => Boolean(entry),
    );

  if (!stands.length) {
    return args.appendLog(
      ensured,
      `[Panier Express] aucun stand disponible pour effectuer un choix.`,
    );
  }

  const choices = stands.map(
    (entry) => `${entry.label} (case ${entry.caseNumber})`,
  );

  return {
    ...ensured,
    pending: {
      type: 'pick',
      playerId: args.playerId,
      blocking: true,
      label: 'Choisissez le stand à rejoindre.',
      choices,
      data: {
        kind: 'tile.move_to_stand_choice',
        targets: stands.map((entry) => ({
          position: entry.position,
          standId: entry.standId ?? null,
          label: entry.label,
          caseNumber: entry.caseNumber,
        })),
      },
    },
  };
}

export function updatePanierExpressPlayer(
  state: GameStateEntity,
  players: PanierExpressPlayer[],
  playerId: number,
  updater: (player: PanierExpressPlayer) => PanierExpressPlayer,
): GameStateEntity {
  return {
    ...state,
    players: players.map((player) =>
      player.id === playerId ? updater(player) : player,
    ),
  };
}




