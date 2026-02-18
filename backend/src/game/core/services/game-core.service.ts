import { Injectable } from '@nestjs/common';
import { RoomPayload } from '../../../room/dto/room-response.dto';
import {
  GameLogEntry,
  GameStateEntity,
  PlayerStateEntity,
} from '../entities/game-state.entity';
import { ensureSeededRng } from '../../../common/utils/seeded-rng';
import { seededShuffle } from '../../../common/utils/seeded-shuffle';
import { normalizeGameLogMessage } from '../helpers/log-style.helper';

@Injectable()
export class GameCoreService {
  private sanitizePlayerName(raw: unknown): string {
    let name = String(raw ?? '').trim();
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    const lowered = name.toLowerCase();
    if (
      lowered.endsWith('(zone de jeu)') ||
      lowered.endsWith('(zone de jeux)') ||
      lowered.endsWith('(game zone)')
    ) {
      const openParen = name.lastIndexOf('(');
      if (openParen > 0) {
        name = name.slice(0, openParen).trimEnd();
      }
    }
    return name;
  }

  buildBaseState(payload: RoomPayload, gameType: string): GameStateEntity {
    const status = payload.room.status || 'setup';
    const roomOwnerId =
      typeof payload?.room?.owner?.id === 'number' ? payload.room.owner.id : null;
    const metadata: Record<string, unknown> = {
      roomId: payload?.room?.id ?? null,
      roomOwnerId,
      gameType,
      roomStartedAt: payload?.room?.startedAt ?? null,
      roomRunId:
        typeof (payload?.room as any)?.runId === 'number'
          ? (payload.room as any).runId
          : null,
      generatedAt: new Date().toISOString(),
    };
    const rng = ensureSeededRng(metadata as any);
    metadata.rng = rng;

    const playersBase = this.buildPlayers(payload);
    const players = this.shouldRandomizeStarter(status)
      ? this.shufflePlayers(playersBase, rng.seed)
      : playersBase;

    // ownerPlayerId: identifiant du "propriétaire de la table" (par id joueur).
    // Important: ne pas l'utiliser pour la seed RNG (donc le calculer après ensureSeededRng).
    metadata.ownerPlayerId =
      roomOwnerId != null && players.some((p) => p?.id === roomOwnerId)
        ? roomOwnerId
        : (players[0]?.id ?? null);

    return {
      status,
      phase: 'playing',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      lastDraw: null,
      log: [],
      players,
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1,
      },
      metadata,
      botThinking: false,
    };
  }

  cloneState(state: GameStateEntity): GameStateEntity {
    return {
      ...state,
      log: [...(state.log || [])],
      players: state.players ? [...state.players] : undefined,
      turn: state.turn ? { ...state.turn } : undefined,
      metadata: state.metadata ? { ...state.metadata } : undefined,
      pending: state.pending ? { ...state.pending } : state.pending,
    };
  }

  appendLog(state: GameStateEntity, message: string): GameStateEntity {
    const normalizedMessage = normalizeGameLogMessage(message);
    if (!normalizedMessage) return state;
    const entry: GameLogEntry = {
      message: normalizedMessage,
      timestamp: new Date().toISOString(),
    };
    const next = this.cloneState(state);
    next.log.push(entry);
    return next;
  }

  private buildPlayers(payload: RoomPayload): PlayerStateEntity[] {
    const players: PlayerStateEntity[] = [];
    payload.room.players.forEach((p) =>
      players.push({
        id: p.id,
        username: this.sanitizePlayerName(p.username),
        isBot: false,
        basket: [],
        inventory: [],
        shoppingList: [],
      }),
    );
    payload.room.bots.forEach((b, idx) =>
      players.push({
        // Stable id: avoid shifting bot ids when the room bot list order changes.
        // This prevents games from "remembering" a different bot after add/remove/reorder.
        id: -Math.abs(b.id),
        username: this.sanitizePlayerName(b.name),
        isBot: true,
        basket: [],
        inventory: [],
        shoppingList: [],
      }),
    );
    return players;
  }

  private shouldRandomizeStarter(status: string): boolean {
    return String(status ?? '').toLowerCase() === 'started';
  }

  private shufflePlayers(
    players: PlayerStateEntity[],
    seed: number,
  ): PlayerStateEntity[] {
    return seededShuffle(players, seed, 'game-core:starter');
  }
}
