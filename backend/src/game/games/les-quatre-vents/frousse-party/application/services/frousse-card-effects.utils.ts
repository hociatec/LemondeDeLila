import type {
  GameStateEntity,
  PendingState,
} from '../../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import type {
  FrousseCard,
  FrousseMetadata,
} from '../../model/frousse.types';
import type { FrousseRuntimeMetadata } from './frousse-action.utils';
import {
  clampFrousse,
  extractFrousseMoveDelta,
  extractFrousseSkipTurns,
  isFrousseTeleportToCase40,
} from './frousse-action.utils';

type FrousseOtherPlayer = { id: number; username: string };

type FrousseCardEffectDeps = {
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  pickOne: <T>(
    meta: FrousseMetadata,
    values: T[],
  ) => { meta: FrousseMetadata; value: T | null };
  otherPlayers: (
    state: GameStateEntity,
    playerId: number,
  ) => FrousseOtherPlayer[];
  otherPlayerIds: (meta: FrousseMetadata, me: number) => number[];
  move: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  applyLanding: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  setPos: (
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ) => GameStateEntity;
};

export function applyFrousseCardEffect(params: {
  state: GameStateEntity;
  playerId: number;
  card: FrousseCard;
  meta: FrousseRuntimeMetadata;
  deps: FrousseCardEffectDeps;
}): GameStateEntity {
  const { state, playerId, card, deps } = params;
  let next = state;
  let meta = params.meta;
  const text = card.text;

  if (/Bonus/i.test(card.category) && card.localNumber === 13) {
    next = deps.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} saute 6 cases.`,
    );
    next = deps.move(next, playerId, 6);
    return deps.applyLanding(next, playerId);
  }

  if (
    /FantÃƒÆ’Ã‚Â´me/i.test(card.category) &&
    /fantÃƒÆ’Ã‚Â´me farceur/i.test(text) &&
    /ÃƒÆ’Ã‚Â©chang|ÃƒÆ’Ã‚Â©change/i.test(text)
  ) {
    const targets = deps.otherPlayers(next, playerId);
    if (!targets.length) return next;
    const pick = deps.pickOne(meta, targets);
    meta = pick.meta as FrousseRuntimeMetadata;
    const target = pick.value;
    if (!target) {
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }
    const actorPos = meta.positions?.[playerId] ?? 0;
    const targetPos = meta.positions?.[target.id] ?? 0;
    meta = {
      ...meta,
      positions: {
        ...(meta.positions ?? {}),
        [playerId]: targetPos,
        [target.id]: actorPos,
      },
    };
    next = deps.appendLog(
      { ...next, metadata: { ...(next.metadata ?? {}), ...meta } },
      `${resolvePlayerNameFromState(next, playerId)} ÃƒÆ’Ã‚Â©change sa position avec ${resolvePlayerNameFromState(next, target.id)}.`,
    );
    return next;
  }

  if (
    /ÃƒÆ’Ã‚Â©chang|echange/i.test(text) &&
    (/votre place/i.test(text) || /vos places/i.test(text))
  ) {
    const targets = deps.otherPlayers(next, playerId);
    if (!targets.length) return next;
    const pending: PendingState = {
      type: 'choose_target',
      label:
        'Choisissez le joueur avec qui ÃƒÆ’Ã‚Â©changer votre position, ou "Refuser l\'ÃƒÆ’Ã‚Â©change".',
      playerId,
      blocking: true,
      choices: [...targets.map((t) => t.username), "Refuser l'ÃƒÆ’Ã‚Â©change."],
      data: {
        canDecline: true,
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

  if (/Ignorez les piÃƒÆ’Ã‚Â¨ges jusqu['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]au prochain symbole/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        ignoreTrapUntilNextDraw: {
          ...(meta.statuses.ignoreTrapUntilNextDraw ?? {}),
          [playerId]: true,
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (
    /Ignorez le prochain piÃƒÆ’Ã‚Â¨ge/i.test(text) ||
    /Ignorez les piÃƒÆ’Ã‚Â¨ges/i.test(text)
  ) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        ignoreNextTrap: {
          ...(meta.statuses.ignoreNextTrap ?? {}),
          [playerId]: true,
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/Ignorez la prochaine carte FantÃƒÆ’Ã‚Â´me/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        ignoreNextGhost: {
          ...(meta.statuses.ignoreNextGhost ?? {}),
          [playerId]: true,
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/annule une farce/i.test(text) || /rien ne vous arrive/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        ignoreNextPrank: {
          ...(meta.statuses.ignoreNextPrank ?? {}),
          [playerId]: true,
        },
      },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    return deps.appendLog(next, 'Protection farce activÃƒÆ’Ã‚Â©e.');
  }

  if (/Sautez\s+6\s+cases/i.test(text)) {
    next = deps.appendLog(
      next,
      `${resolvePlayerNameFromState(next, playerId)} saute 6 cases.`,
    );
    next = deps.move(next, playerId, 6);
    return deps.applyLanding(next, playerId);
  }

  const need56 = text.match(/lancer un (\d) ou un (\d)/i);
  if (need56) {
    const a = Number(need56[1]);
    const b = Number(need56[2]);
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        blocked: {
          ...(meta.statuses.blocked ?? {}),
          [playerId]: { kind: 'need_roll_one_of', allowed: [a, b] },
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  const need6 = text.match(/obtenir un 6/i);
  if (need6 && /jusqu/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        blocked: {
          ...(meta.statuses.blocked ?? {}),
          [playerId]: { kind: 'need_roll_one_of', allowed: [6] },
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  const needMin = text.match(/obtenez pas un (\d) ou plus/i);
  if (needMin) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        blocked: {
          ...(meta.statuses.blocked ?? {}),
          [playerId]: { kind: 'need_roll_min', min: Number(needMin[1]) },
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/nombre pair/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        blocked: {
          ...(meta.statuses.blocked ?? {}),
          [playerId]: { kind: 'need_roll_even' },
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/n['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]avancerez que d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢](une|un)e seule case/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        nextMoveCap: { ...(meta.statuses.nextMoveCap ?? {}), [playerId]: 1 },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/malus de moins 2/i.test(text) || /malus de -2/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        nextRollMalus: {
          ...(meta.statuses.nextRollMalus ?? {}),
          [playerId]: -2,
        },
      },
      keepTurnNow: true,
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (
    /gardez le plus petit/i.test(text) ||
    /gardez le chiffre le plus bas/i.test(text)
  ) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        nextRollKeepLowest: {
          ...(meta.statuses.nextRollKeepLowest ?? {}),
          [playerId]: true,
        },
      },
      keepTurnNow: true,
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/Doublez votre prochain lancer/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        nextRollDouble: {
          ...(meta.statuses.nextRollDouble ?? {}),
          [playerId]: true,
        },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/Si vous faites un trois, reculez de 2 cases/i.test(text)) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        nextRollIfThreeBackTwo: {
          ...(meta.statuses.nextRollIfThreeBackTwo ?? {}),
          [playerId]: true,
        },
      },
      keepTurnNow: true,
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (isFrousseTeleportToCase40(text)) {
    next = deps.setPos(next, playerId, 39);
    return deps.applyLanding(next, playerId);
  }

  if (
    /Relancez le dÃƒÆ’Ã‚Â©/i.test(text) ||
    (/Relancez/i.test(text) && /dÃƒÆ’Ã‚Â©/i.test(text))
  ) {
    meta.keepTurnNow = true;
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (/laissant les autres joueurs (filer|avancer) de 3 cases/i.test(text)) {
    const others = deps.otherPlayerIds(meta, playerId);
    for (const pid of others) {
      meta.positions[pid] = clampFrousse((meta.positions[pid] ?? 0) + 3, 0, 49);
    }
    const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: { ...(meta.statuses.skipTurn ?? {}), [playerId]: curr + 1 },
      },
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  if (
    /si le rÃƒÆ’Ã‚Â©sultat est impair, passez (?:votre|un|une|1)?\s*tour/i.test(text)
  ) {
    meta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        blocked: {
          ...(meta.statuses.blocked ?? {}),
          [playerId]: { kind: 'need_roll_even' },
        },
      },
      keepTurnNow: true,
    };
    return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
  }

  const skip = extractFrousseSkipTurns(text);
  if (skip > 0) {
    const curr = meta.statuses.skipTurn?.[playerId] ?? 0;
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

  if (
    /case dÃƒÆ’Ã‚Â©part/i.test(text) ||
    /Retour a la case une/i.test(text) ||
    (/Retournez/i.test(text) && /case une/i.test(text))
  ) {
    next = deps.setPos(next, playerId, 0);
    return deps.applyLanding(next, playerId);
  }

  if (/Allez en cuisine/i.test(text)) {
    next = deps.setPos(next, playerId, 19);
    return deps.applyLanding(next, playerId);
  }

  const delta = extractFrousseMoveDelta(text);
  if (delta !== 0) {
    next = deps.move(next, playerId, delta);
    return deps.applyLanding(next, playerId);
  }

  return next;
}
