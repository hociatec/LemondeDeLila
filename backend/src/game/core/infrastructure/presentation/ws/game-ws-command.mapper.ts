import { Injectable, NotFoundException } from '@nestjs/common';
import type { GameSingleActionDto } from '../../../application/models/game-action.model';

@Injectable()
export class GameWsCommandMapper {
  resolveRoomId(payload: unknown): number {
    const record = this.asRecord(payload);
    const roomId = Number(record.roomId ?? record.id);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new NotFoundException('roomId invalide');
    }
    return roomId;
  }

  resolveKey(payload: unknown): { key: string; gameType: string } {
    const record = this.asRecord(payload);
    return {
      key:
        typeof record.key === 'string' ? record.key.trim().toUpperCase() : '',
      gameType:
        typeof record.gameType === 'string' ? record.gameType.trim() : '',
    };
  }

  resolveClientSentAt(payload: unknown): unknown {
    return this.asRecord(payload).clientSentAtMs ?? null;
  }

  resolveActions(payload: unknown, actorId: number): GameSingleActionDto[] {
    return this.decodeActions(payload).map((action) =>
      this.withActor(action, actorId),
    );
  }

  private decodeActions(payload: unknown): GameSingleActionDto[] {
    const record = this.asRecord(payload);
    if (Array.isArray(record.actions)) {
      return record.actions
        .map((entry) => this.normalizeAction(entry))
        .filter((entry): entry is GameSingleActionDto => entry != null);
    }
    const source =
      record.action && typeof record.action === 'object'
        ? record.action
        : this.hasActionShape(record)
          ? record
          : null;
    const action = this.normalizeAction(source);
    return action ? [action] : [];
  }

  private normalizeAction(value: unknown): GameSingleActionDto | null {
    const record = this.asRecord(value);
    const type = this.resolveActionType(record);
    if (!type) return null;
    return {
      type,
      payload: this.resolveActionPayload(record),
      meta: this.asRecord(record.meta),
    };
  }

  private resolveActionType(record: Record<string, unknown>): string {
    for (const field of [
      'type',
      'actionType',
      'actionId',
      'intentId',
      'key',
      'action',
    ]) {
      const value = record[field];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  private hasActionShape(record: Record<string, unknown>): boolean {
    return ['type', 'actionType', 'actionId', 'intentId', 'key', 'action'].some(
      (field) => typeof record[field] === 'string',
    );
  }

  private resolveActionPayload(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    if (record.payload && typeof record.payload === 'object') {
      return this.asRecord(record.payload);
    }
    if (record.data && typeof record.data === 'object') {
      return this.asRecord(record.data);
    }

    const controlKeys = new Set([
      'roomId',
      'id',
      'type',
      'action',
      'actionType',
      'actionId',
      'intentId',
      'key',
      'meta',
      '_trace',
    ]);
    return Object.fromEntries(
      Object.entries(record).filter(([key]) => !controlKeys.has(key)),
    );
  }

  private withActor(
    action: GameSingleActionDto,
    actorId: number,
  ): GameSingleActionDto {
    return {
      ...action,
      payload: action.payload ?? {},
      meta: {
        ...(action.meta ?? {}),
        actorId,
      },
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
