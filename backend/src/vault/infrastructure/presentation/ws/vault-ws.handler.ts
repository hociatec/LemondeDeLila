import { Injectable } from '@nestjs/common';
import { requireUser } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { VaultRoomSnapshotsService } from '../../../application/services/vault-room-snapshots.service';
import {
  VaultAbandonWsDto,
  VaultIdWsDto,
  VaultSaveWsDto,
} from './dto/vault-ws.dto';

@Injectable()
export class VaultWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly vault: VaultRoomSnapshotsService,
  ) {}

  async list(session: WsSession) {
    const user = requireUser(session);
    const items = await this.vault.list(user.id);
    return { type: 'vault.list', payload: { items } };
  }

  async save(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(VaultSaveWsDto, payload);
    const res = await this.vault.save(user.id, dto.roomId, dto.id);
    return { type: 'vault.save', payload: { id: res.id } };
  }

  async restore(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(VaultIdWsDto, payload);
    const res = await this.vault.restore(user.id, dto.id);
    return { type: 'vault.restore', payload: { roomId: res.roomId } };
  }

  async delete(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(VaultIdWsDto, payload);
    const ok = await this.vault.delete(user.id, dto.id);
    return { type: 'vault.delete', payload: { ok } };
  }

  async abandon(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(VaultAbandonWsDto, payload);
    const ok = await this.vault.abandonRestoredRoom(user.id, dto.roomId);
    return { type: 'vault.abandon', payload: { ok } };
  }
}

