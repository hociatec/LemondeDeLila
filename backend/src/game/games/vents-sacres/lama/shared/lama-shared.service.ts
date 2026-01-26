import { Injectable } from '@nestjs/common';
import type { LamaMetadata } from '../model/lama.model';

@Injectable()
export class LamaSharedService {
  asNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const n = Number(value.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  asBoolean(value: unknown): boolean {
    if (value === true) return true;
    if (value === false) return false;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const t = value.trim().toLowerCase();
      if (t === 'true' || t === '1' || t === 'yes' || t === 'oui' || t === 'on') return true;
      if (t === 'false' || t === '0' || t === 'no' || t === 'non' || t === 'off') return false;
    }
    return false;
  }

  playerLabel(players: any[], playerId: number): string {
    const raw = players.find((p) => p?.id === playerId)?.username;
    let name = String(raw ?? '').trim();
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    return name.length ? name : `joueur ${playerId}`;
  }

  ensureTurnTracker(meta: LamaMetadata, playerId: number): LamaMetadata {
    const current = (meta as any).turnTracker ?? { playerId, drawn: false, played: false };
    const currentPid = this.asNumberOrNull(current?.playerId);
    if (currentPid !== playerId) {
      return { ...meta, turnTracker: { playerId, drawn: false, played: false } };
    }

    return {
      ...meta,
      turnTracker: {
        playerId,
        drawn: this.asBoolean(current?.drawn),
        played: this.asBoolean(current?.played),
      },
    };
  }
}
