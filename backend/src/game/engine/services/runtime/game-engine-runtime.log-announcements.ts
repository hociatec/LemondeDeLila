import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../interfaces/game-rules-adapter.interface';

export function appendBoardArrivalAnnouncements(params: {
  gameType: string;
  handler: GameRulesAdapter | null | undefined;
  previous: GameStateEntity;
  next: GameStateEntity;
  toMetadata: (target: { metadata?: unknown }) => Record<string, unknown>;
  getMetadataObject: (
    metadata: Record<string, unknown>,
    key: string,
  ) => Record<string, unknown> | null;
  normalizeMetadataString: (value: unknown) => string;
  normalizeUsernameForLog: (username: unknown) => string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const {
    gameType: _gameType,
    handler,
    previous,
    next,
    toMetadata,
    getMetadataObject,
    normalizeMetadataString,
    normalizeUsernameForLog,
    appendLog,
  } = params;
  try {
    if (!handler?.shouldAnnounceBoardArrivals?.()) {
      return next;
    }
    if (
      String(next.status ?? '')
        .toLowerCase()
        .trim() !== 'started'
    ) {
      return next;
    }

    const prevMeta = toMetadata(previous);
    const nextMeta = toMetadata(next);

    const tiles = Array.isArray(nextMeta['tiles'])
      ? (nextMeta['tiles'] as Record<string, unknown>[])
      : [];
    const prevPositions =
      getMetadataObject(prevMeta, 'positions') ??
      ({} as Record<string, unknown>);
    const nextPositions =
      getMetadataObject(nextMeta, 'positions') ??
      ({} as Record<string, unknown>);

    if (tiles.length === 0) {
      return next;
    }

    type PlayerMovement = {
      id: number;
      username: string;
      prevPos: number | null;
      nextPos: number | null;
    };

    const players = Array.isArray(next.players) ? next.players : [];
    const changed = players
      .map<PlayerMovement | null>((player) => {
        if (!player || typeof player.id !== 'number') return null;
        const username =
          normalizeUsernameForLog(player.username) || `joueur ${player.id}`;
        const prevRaw = prevPositions[String(player.id)];
        const nextRaw = nextPositions[String(player.id)];
        const prevPos = typeof prevRaw === 'number' ? prevRaw : Number(prevRaw);
        const nextPos = typeof nextRaw === 'number' ? nextRaw : Number(nextRaw);
        return {
          id: player.id,
          username,
          prevPos: Number.isFinite(prevPos) ? Math.trunc(prevPos) : null,
          nextPos: Number.isFinite(nextPos) ? Math.trunc(nextPos) : null,
        };
      })
      .filter(
        (player): player is PlayerMovement =>
          player != null &&
          player.nextPos != null &&
          player.prevPos != null &&
          player.nextPos !== player.prevPos,
      )
      .sort((left, right) => left.id - right.id);

    if (changed.length === 0) {
      return next;
    }

    let out = next;
    for (const player of changed) {
      const idx = player.nextPos as number;
      if (idx < 0 || idx >= tiles.length) continue;

      const tile = tiles[idx] ?? {};
      const labelRaw = normalizeMetadataString(tile['label']);
      const titleRaw = normalizeMetadataString(tile['title'] ?? tile['name']);
      const descriptionRaw = normalizeMetadataString(tile['description']);

      const caseNumber = idx + 1;
      const label = labelRaw || titleRaw ? labelRaw || titleRaw : '';
      const desc = descriptionRaw ? ` ${descriptionRaw}` : '';
      const name = player.username || `joueur ${player.id}`;

      const recentMsgs = (() => {
        const log = Array.isArray(out.log) ? out.log : [];
        const msgs: string[] = [];
        for (let i = log.length - 1; i >= 0 && msgs.length < 4; i -= 1) {
          const entry = log[i];
          const msg = entry?.message;
          if (typeof msg === 'string' && msg.trim().length > 0) {
            msgs.push(String(msg).trim());
          }
        }
        return msgs;
      })();
      const needleByNumber = `arrive sur case ${caseNumber}`.toLowerCase();
      const needleByLabel = label ? `arrive sur ${label}`.toLowerCase() : '';
      const needleByPlacement = `en case ${caseNumber}`.toLowerCase();
      const hasRecentArrival = recentMsgs.some((message) => {
        const lower = message.toLowerCase();
        return (
          lower.includes(needleByNumber) ||
          (needleByLabel && lower.includes(needleByLabel)) ||
          lower.includes(needleByPlacement)
        );
      });
      if (hasRecentArrival) continue;

      const gameTypeRaw = normalizeMetadataString(nextMeta['gameType']);
      const isContes = gameTypeRaw === 'contes-et-cacahuetes';

      if (
        label &&
        (/^case\\s+\\d+/i.test(label) || (isContes && /^case\s+/i.test(label)))
      ) {
        out = appendLog(out, `${name} arrive sur ${label}.${desc}`.trim());
      } else {
        const suffix = label ? ` - ${label}` : '';
        out = appendLog(
          out,
          `${name} arrive sur case ${caseNumber}${suffix}.${desc}`.trim(),
        );
      }
    }

    return out;
  } catch {
    return next;
  }
}

export function appendSkipTurnAnnouncements(params: {
  state: GameStateEntity;
  toMetadata: (target: { metadata?: unknown }) => Record<string, unknown>;
  getMetadataObject: (
    metadata: Record<string, unknown>,
    key: string,
  ) => Record<string, unknown> | null;
  normalizeUsernameForLog: (username: unknown) => string;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  const { toMetadata, getMetadataObject, normalizeUsernameForLog, appendLog } =
    params;
  const { state } = params;
  try {
    const meta = toMetadata(state);
    const turnFlow =
      getMetadataObject(meta, 'turnFlow') ?? ({} as Record<string, unknown>);
    const skippedRaw = turnFlow['skipped'];
    const skipped = Array.isArray(skippedRaw) ? (skippedRaw as unknown[]) : [];
    if (!skipped.length) {
      return state;
    }

    const currentPlayerId = state.turn?.currentPlayerId ?? null;
    const currentPlayer =
      currentPlayerId != null
        ? (state.players?.find((player) => player?.id === currentPlayerId) ??
          null)
        : null;
    const currentName = normalizeUsernameForLog(currentPlayer?.username);
    const expectedTurnAnnouncement = currentName
      ? `C'est au tour de ${currentName}.`
      : null;

    let out = state;
    const existingLog = Array.isArray(state.log) ? [...state.log] : [];
    const lastEntry =
      existingLog.length > 0 ? existingLog[existingLog.length - 1] : null;
    const lastMessage =
      lastEntry && typeof lastEntry.message === 'string'
        ? String(lastEntry.message).trim()
        : '';
    const shouldMoveTurnAnnouncement =
      expectedTurnAnnouncement != null &&
      lastMessage === expectedTurnAnnouncement;
    if (shouldMoveTurnAnnouncement) {
      existingLog.pop();
      out = {
        ...out,
        log: existingLog,
      };
    }

    for (const entry of skipped) {
      if (!entry || typeof entry !== 'object') continue;
      const data = entry as Record<string, unknown>;
      const id = typeof data['id'] === 'number' ? data['id'] : null;
      if (id == null) continue;
      const remaining =
        typeof data['remainingAfter'] === 'number' ? data['remainingAfter'] : 0;
      const player = out.players?.find((item) => item?.id === id) ?? null;
      const name = normalizeUsernameForLog(player?.username);
      const who = name ? name : `joueur ${id}`;
      const suffix =
        remaining > 0 && remaining < 100 ? ` (${remaining} restant)` : '';
      out = appendLog(out, `${who} passe son tour${suffix}.`);
    }

    if (shouldMoveTurnAnnouncement) {
      out = appendLog(out, expectedTurnAnnouncement);
    }

    const cleanedTurnFlow = { ...turnFlow, skipped: [] };
    return {
      ...out,
      metadata: {
        ...meta,
        turnFlow: cleanedTurnFlow,
      },
    };
  } catch {
    return state;
  }
}
