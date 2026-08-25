import { Injectable } from '@nestjs/common';

type GridActionPayload = Record<string, unknown>;
type GridCellAction = { type?: unknown; label?: unknown; payload?: unknown };
type ResolvedGridCellAction = {
  type: string;
  label: string;
  payload: GridActionPayload;
};

@Injectable()
export class GridCellActionsService {
  buildFromActions(
    actionsRaw: unknown,
    resolveLabel?: (action: GridCellAction) => string,
  ): Record<string, ResolvedGridCellAction[]> {
    const result: Record<string, ResolvedGridCellAction[]> = {};

    const actions: GridCellAction[] = Array.isArray(actionsRaw) ? actionsRaw : [];
    for (const action of actions) {
      const payload =
        action?.payload && typeof action.payload === 'object'
          ? (action.payload as GridActionPayload)
          : {};
      const x = payload?.x;
      const y = payload?.y;
      if (typeof x !== 'number' || typeof y !== 'number') {
        continue;
      }

      const type = String(action?.type ?? '').trim();
      if (!type) continue;

      const key = `${x},${y}`;
      const label =
        typeof resolveLabel === 'function'
          ? String(resolveLabel(action) ?? '').trim()
          : String(action?.label ?? action?.type ?? '').trim();

      (result[key] ??= []).push({
        type,
        label: label || type,
        payload,
      });
    }

    return result;
  }
}
