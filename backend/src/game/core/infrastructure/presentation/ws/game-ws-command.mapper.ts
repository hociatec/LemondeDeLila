import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseStrictInteger } from '../../../../../shared/utils/public-api';
import type { GameSingleActionDto } from '../../../application/models/game-action.model';

@Injectable()
export class GameWsCommandMapper {
  resolveRoomId(payload: unknown): number {
    const record = this.asRecord(payload);
    const roomId = parseStrictInteger(record.roomId ?? record.id, { min: 1 });
    if (roomId === null) {
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
    const envelope = this.asRecord(payload);
    const commandId = this.stringValue(envelope.commandId);
    const knownVersion = this.integerValue(envelope.knownVersion);
    return this.decodeActions(payload).map((action, index, actions) =>
      this.withActor(action, actorId, {
        commandId:
          commandId && actions.length > 1 ? `${commandId}:${index}` : commandId,
        knownVersion,
      }),
    );
  }

  resolveCandidateQuery(payload: unknown): {
    actionType: string;
    query: Record<string, unknown>;
    offset: number;
    limit: number;
  } {
    const record = this.asRecord(payload);
    return {
      actionType: this.stringValue(record.actionType) ?? '',
      query: this.asRecord(record.query),
      offset: Math.max(0, this.integerValue(record.offset) ?? 0),
      limit: Math.max(1, Math.min(200, this.integerValue(record.limit) ?? 50)),
    };
  }

  private decodeActions(payload: unknown): GameSingleActionDto[] {
    const record = this.asRecord(payload);
    if (Array.isArray(record.actions)) {
      if (record.actions.length > 128) {
        throw new BadRequestException('Trop de commandes');
      }
      return record.actions
        .map((entry) => this.normalizeAction(entry))
        .filter((entry): entry is GameSingleActionDto => entry != null);
    }
    const source =
      record.action && typeof record.action === 'object'
        ? record.action
        : typeof record.type === 'string'
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
    const type = typeof record.type === 'string' ? record.type.trim() : '';
    if (type.length > 128) {
      throw new BadRequestException('Type de commande trop long');
    }
    return type;
  }

  private resolveActionPayload(
    record: Record<string, unknown>,
  ): Record<string, unknown> {
    if (record.payload && typeof record.payload === 'object') {
      return this.asRecord(record.payload);
    }
    return {};
  }

  private withActor(
    action: GameSingleActionDto,
    actorId: number,
    envelope: { commandId: string | null; knownVersion: number | null },
  ): GameSingleActionDto {
    const commandId =
      this.stringValue(action.meta?.commandId) ?? envelope.commandId;
    const knownVersion =
      this.integerValue(action.meta?.knownVersion) ?? envelope.knownVersion;
    return {
      ...action,
      payload: action.payload ?? {},
      meta: {
        actorId,
        ...(commandId ? { commandId } : {}),
        ...(knownVersion == null ? {} : { knownVersion }),
      },
    };
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private integerValue(value: unknown): number | null {
    if (value == null) return null;
    const parsed = parseStrictInteger(value, { min: 0 });
    if (parsed === null)
      throw new BadRequestException('Entier de commande invalide');
    return parsed;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
