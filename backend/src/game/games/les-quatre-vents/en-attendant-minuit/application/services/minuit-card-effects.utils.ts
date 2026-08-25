import type {
  GameStateEntity,
  PendingState,
} from '../../../../../core/application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../core/application/helpers/player-name.helper';
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

  if (/échangez votre position avec un autre joueur/i.test(text)) {
    const targets = deps.otherPlayers(next, playerId);
    targets.push({ id: -1, username: 'Refuser l’échange' });
    const pending: PendingState = {
      type: 'choose_target',
      label: 'Choisissez un joueur dans la liste, puis Entrée.',
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

  if (/vous offrez un cadeau à un autre joueur/i.test(text)) {
    const targets = deps.otherPlayers(next, playerId);
    const pending: PendingState = {
      type: 'choose_target',
      label: 'Choisissez un joueur dans la liste, puis Entrée.',
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
    return deps.appendLog(next, 'Protection malus activée.');
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
      'Protection « passe ton tour » activée.',
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

  if (/Piochez à nouveau une carte au lieu de lancer le dé/i.test(text)) {
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
      'Au prochain tour, piochez une carte à la place du dé.',
    );
  }

  if (/case neutre la plus proche derrière/i.test(text)) {
    const pos = meta.positions[playerId] ?? 0;
    const prevPos = findPrevMinuit(meta.tiles, pos, (t) => t.type === 'neutral');
    if (prevPos != null) {
      next = deps.appendLog(
        next,
        'Retour à la case neutre la plus proche derrière.',
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

  if (/jusqu['’]à la prochaine Carte Noël/i.test(text)) {
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

  if (/jusqu['’]à la case précédente Carte Noël/i.test(text)) {
    const prevPos = findPrevMinuit(
      meta.tiles,
      meta.positions[playerId] ?? 0,
      (t) => t.type === 'card',
    );
    if (prevPos != null) {
      next = deps.appendLog(
        next,
        "Recule jusqu'à la précédente Carte Noël.",
      );
      next = deps.setPos(next, playerId, prevPos);
      return deps.applyLanding(next, playerId);
    }
  }

  if (/position avec le joueur juste derrière/i.test(text)) {
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
        `${resolvePlayerNameFromState(next, playerId, MINUIT_PLAYER_NAME_OPTIONS)} échange sa position avec ${resolvePlayerNameFromState(next, behind, MINUIT_PLAYER_NAME_OPTIONS)}.`,
      );
      return next;
    }
  }

  if (
    /Relancez immédiatement le dé/i.test(text) ||
    /Relancez le dé maintenant/i.test(text)
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

  const delta = extractMinuitMoveDelta(text);
  if (delta !== 0) {
    next = deps.move(next, playerId, delta);
    return deps.applyLanding(next, playerId);
  }

  return next;
}
