import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import type { MinuitCard, MinuitMetadata } from '../../model/minuit.types';
import {
  clampMinuit,
  extractMinuitMoveDelta,
  extractMinuitSkipTurns,
  findBehindMinuit,
  findNextMinuit,
  findPrevMinuit,
} from './minuit-action.utils';

const MINUIT_PLAYER_NAME_OPTIONS = {
  coerceNumericIds: true,
} as const;

type MinuitOtherPlayer = { id: number; username: string };

type MinuitCardEffectDeps = {
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  otherPlayers: (
    state: GameStateEntity,
    playerId: number,
  ) => MinuitOtherPlayer[];
  setPos: (
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ) => GameStateEntity;
  move: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  applyLanding: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
};

export function applyMinuitCardEffect(params: {
  state: GameStateEntity;
  playerId: number;
  card: MinuitCard;
  meta: MinuitMetadata;
  deps: MinuitCardEffectDeps;
}): GameStateEntity {
  const { state, playerId, card, deps } = params;
  let next = state;
  let meta = params.meta;
  const text = (card.lines ?? []).join(' ');

  if (/ÃƒÆ’Ã‚Â©changez votre position avec un autre joueur/i.test(text)) {
    const targets = deps.otherPlayers(next, playerId);
    targets.push({ id: -1, username: 'Refuser lÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã‚Â©change' });
    const pending: PendingState = {
      type: 'choose_target',
      label: 'Choisissez un joueur dans la liste, puis EntrÃƒÆ’Ã‚Â©e.',
      playerId,
      blocking: true,
      choices: targets.map((t) => t.username),
      data: {
        targets: targets.map((t) => ({
          targetPlayerId: t.id,
          targetUsername: t.username,
        })),
      },
    };
    meta = { ...meta, pendingContext: { kind: 'swap', actorId: playerId } };
    return {
      ...next,
      pending,
      metadata: { ...(next.metadata ?? {}), ...meta },
    };
  }

  if (/vous offrez un cadeau ÃƒÆ’Ã‚Â  un autre joueur/i.test(text)) {
    const targets = deps.otherPlayers(next, playerId);
    const pending: PendingState = {
      type: 'choose_target',
      label: 'Choisissez un joueur dans la liste, puis EntrÃƒÆ’Ã‚Â©e.',
      playerId,
      blocking: true,
      choices: targets.map((t) => t.username),
      data: {
        targets: targets.map((t) => ({
          targetPlayerId: t.id,
          targetUsername: t.username,
        })),
      },
    };
    meta = { ...meta, pendingContext: { kind: 'gift', actorId: playerId } };
    return {
      ...next,
      pending,
      metadata: { ...(next.metadata ?? {}), ...meta },
    };
  }

  if (/Ignorez la prochaine case malus/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        ignoreNextMalus: {
          ...(meta.statuses.ignoreNextMalus ?? {}),
          [playerId]: true,
        },
      },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return deps.appendLog(next, 'Protection malus activÃƒÆ’Ã‚Â©e.');
  }

  if (/Ignorez la prochaine case.*Passe ton tour/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        ignoreNextSkip: {
          ...(meta.statuses.ignoreNextSkip ?? {}),
          [playerId]: true,
        },
      },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return deps.appendLog(
      next,
      'Protection Ãƒâ€šÃ‚Â« passe ton tour Ãƒâ€šÃ‚Â» activÃƒÆ’Ã‚Â©e.',
    );
  }

  if (/Les autres joueurs avancent de 1 case, sauf vous/i.test(text)) {
    const others = Object.keys(meta.positions ?? {})
      .map(Number)
      .filter((id) => Number.isFinite(id) && id !== playerId);
    const updated = { ...(meta.positions ?? {}) };
    for (const id of others) {
      updated[id] = clampMinuit((updated[id] ?? 0) + 1, 0, 55);
    }
    meta = { ...meta, positions: updated };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/Piochez ÃƒÆ’Ã‚Â  nouveau une carte au lieu de lancer le dÃƒÆ’Ã‚Â©/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        forceDrawNextTurn: {
          ...(meta.statuses.forceDrawNextTurn ?? {}),
          [playerId]: true,
        },
      },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return deps.appendLog(
      next,
      'Au prochain tour, piochez une carte ÃƒÆ’Ã‚Â  la place du dÃƒÆ’Ã‚Â©.',
    );
  }

  if (/case neutre la plus proche derriÃƒÆ’Ã‚Â¨re/i.test(text)) {
    const pos = meta.positions[playerId] ?? 0;
    const prevPos = findPrevMinuit(meta.tiles, pos, (t) => t.type === 'neutral');
    if (prevPos != null) {
      next = deps.appendLog(
        next,
        'Retour ÃƒÆ’Ã‚Â  la case neutre la plus proche derriÃƒÆ’Ã‚Â¨re.',
      );
      next = deps.setPos(next, playerId, prevPos);
      return deps.applyLanding(next, playerId);
    }
  }

  const skip = extractMinuitSkipTurns(text);
  if (skip > 0) {
    const curr = meta.statuses?.skipTurn?.[playerId] ?? 0;
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [playerId]: curr + skip,
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/jusqu['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]ÃƒÆ’Ã‚Â  la prochaine Carte NoÃƒÆ’Ã‚Â«l/i.test(text)) {
    const nextPos = findNextMinuit(
      meta.tiles,
      meta.positions[playerId] ?? 0,
      (t) => t.type === 'card',
    );
    if (nextPos != null) {
      next = deps.setPos(next, playerId, nextPos);
      return deps.applyLanding(next, playerId);
    }
  }

  if (/jusqu['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]ÃƒÆ’Ã‚Â  la case prÃƒÆ’Ã‚Â©cÃƒÆ’Ã‚Â©dente Carte NoÃƒÆ’Ã‚Â«l/i.test(text)) {
    const prevPos = findPrevMinuit(
      meta.tiles,
      meta.positions[playerId] ?? 0,
      (t) => t.type === 'card',
    );
    if (prevPos != null) {
      next = deps.appendLog(
        next,
        "Recule jusqu'ÃƒÆ’Ã‚Â  la prÃƒÆ’Ã‚Â©cÃƒÆ’Ã‚Â©dente Carte NoÃƒÆ’Ã‚Â«l.",
      );
      next = deps.setPos(next, playerId, prevPos);
      return deps.applyLanding(next, playerId);
    }
  }

  if (/position avec le joueur juste derriÃƒÆ’Ã‚Â¨re/i.test(text)) {
    const behind = findBehindMinuit(meta.positions, playerId);
    if (behind != null) {
      const actorPos = meta.positions[playerId] ?? 0;
      const behindPos = meta.positions[behind] ?? 0;
      meta = {
        ...meta,
        positions: {
          ...meta.positions,
          [playerId]: behindPos,
          [behind]: actorPos,
        },
      };
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
      next = deps.appendLog(
        next,
        `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} ÃƒÆ’Ã‚Â©change sa position avec ${resolvePlayerNameFromState(next, behind, MINUIT_PLAYER_NAME_OPTIONS)}.`,
      );
      return next;
    }
  }

  if (
    /Relancez immÃƒÆ’Ã‚Â©diatement le dÃƒÆ’Ã‚Â©/i.test(text) ||
    /Relancez le dÃƒÆ’Ã‚Â© maintenant/i.test(text)
  ) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        keepTurn: {
          ...(meta.statuses.keepTurn ?? {}),
          [playerId]: (meta.statuses.keepTurn?.[playerId] ?? 0) + 1,
        },
      },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return deps.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} rejoue.`,
    );
  }

  if (/Lancez le dÃƒÆ’Ã‚Â© et avancez du nombre obtenu/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        keepTurn: {
          ...(meta.statuses.keepTurn ?? {}),
          [playerId]: (meta.statuses.keepTurn?.[playerId] ?? 0) + 1,
        },
      },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return deps.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} doit lancer le dÃƒÆ’Ã‚Â© pour appliquer ce bonus.`,
    );
  }

  const delta = extractMinuitMoveDelta(text);
  if (delta !== 0) {
    next = deps.move(next, playerId, delta);
    return deps.applyLanding(next, playerId);
  }

  return next;
}
