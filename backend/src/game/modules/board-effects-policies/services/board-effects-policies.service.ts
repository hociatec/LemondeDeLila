import { Injectable } from '@nestjs/common';
import type { PendingState } from '../../../core/entities/game-state.entity';
import { pawnPlacement } from '../../../core/helpers/game-log-text.helper';
import { stringOrEmpty } from '@common/utils/string-value.utils';

type LandingTile = {
  type?: string | null;
  label?: string | null;
  description?: string | null;
};

type DrawPolicy = {
  log: string;
  pendingLabel: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class BoardEffectsPoliciesService {
  formatTileLabel(position: number, rawLabel: unknown): string {
    const label = stringOrEmpty(rawLabel).trim();
    if (!label) return `Case ${position + 1}`;
    if (/^(case|depart|arrivee)\b/i.test(label)) return label;
    return `Case ${position + 1} - ${label}`;
  }

  createPlacementLog(params: {
    playerLabel: string;
    pawnLabel: string;
    position: number;
    tileLabel: string;
  }): string {
    return pawnPlacement(params);
  }

  resolveLanding(params: {
    position: number;
    tile?: LandingTile | null;
    playerId: number;
    drawPolicies?: Record<string, DrawPolicy>;
    finishTypes?: string[];
    defaultNeutralLog?: string | null;
  }): { logs: string[]; pending: PendingState | null; isFinish: boolean } {
    const logs: string[] = [];
    const tile = params.tile ?? null;
    const type = stringOrEmpty(tile?.type).trim().toLowerCase();
    const description = stringOrEmpty(tile?.description).trim();

    if (description) {
      logs.push(description);
    } else if (params.defaultNeutralLog) {
      logs.push(stringOrEmpty(params.defaultNeutralLog).trim());
    }

    const finishTypes = (params.finishTypes ?? ['finish']).map((value) =>
      stringOrEmpty(value).trim().toLowerCase(),
    );
    if (finishTypes.includes(type)) {
      return { logs, pending: null, isFinish: true };
    }

    const drawPolicy = params.drawPolicies?.[type];
    if (!drawPolicy) {
      return { logs, pending: null, isFinish: false };
    }

    logs.push(drawPolicy.log);
    const pending: PendingState = {
      type: 'draw',
      playerId: params.playerId,
      blocking: true,
      label: drawPolicy.pendingLabel,
      data: drawPolicy.data ?? {},
    };
    return { logs, pending, isFinish: false };
  }
}
