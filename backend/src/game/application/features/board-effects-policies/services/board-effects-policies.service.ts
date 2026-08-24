import { Injectable } from '@nestjs/common';

@Injectable()
export class BoardEffectsPoliciesService {
  formatTileLabel(position: number, label: string): string {
    const base = `Case ${Number(position) + 1}`;
    const clean = String(label ?? '').trim();
    if (!clean) return base;
    return clean.toLowerCase().startsWith(base.toLowerCase())
      ? clean
      : `${base} - ${clean}`;
  }

  createPlacementLog(params: {
    playerLabel: string;
    pawnLabel: string;
    position: number;
    tileLabel: string;
  }): string {
    return `${params.playerLabel} place ${params.pawnLabel} en case ${Number(params.position) + 1} (${params.tileLabel}).`;
  }

  resolveLanding(params: {
    playerId: number;
    position?: number;
    tile?: { type?: string; description?: string | null };
    drawPolicies?: Record<
      string,
      { log?: string; pendingLabel?: string; data?: Record<string, unknown> }
    >;
    finishTypes?: string[];
  }): {
    isFinish: boolean;
    logs: string[];
    pending: {
      type: string;
      playerId: number;
      blocking: true;
      label: string;
      data: Record<string, unknown>;
    } | null;
  } {
    const logs: string[] = [];
    const description = String(params.tile?.description ?? '').trim();
    if (description) logs.push(description);
    const type = String(params.tile?.type ?? '').trim();
    if ((params.finishTypes ?? ['finish']).includes(type)) {
      return { isFinish: true, logs, pending: null };
    }
    const drawPolicy = params.drawPolicies?.[type];
    if (!drawPolicy) return { isFinish: false, logs, pending: null };
    if (drawPolicy.log) logs.push(drawPolicy.log);
    return {
      isFinish: false,
      logs,
      pending: {
        type: 'draw',
        playerId: params.playerId,
        blocking: true,
        label: drawPolicy.pendingLabel ?? 'Piocher une carte.',
        data: drawPolicy.data ?? {},
      },
    };
  }

  isMovementBlocked(params: {
    blockedTiles?: Array<{ x: number; y: number }>;
    x: number;
    y: number;
  }): boolean {
    return (params.blockedTiles ?? []).some(
      (tile) => tile.x === params.x && tile.y === params.y,
    );
  }
}
