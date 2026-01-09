import { Injectable } from '@nestjs/common';

type AnyAction = { type?: unknown; label?: unknown; payload?: any };

@Injectable()
export class GridCellActionsService {
  buildFromActions(
    actionsRaw: unknown,
    resolveLabel?: (action: AnyAction) => string,
  ): Record<string, Array<{ type: string; label: string; payload: any }>> {
    const result: Record<string, Array<{ type: string; label: string; payload: any }>> =
      {};

    const actions: AnyAction[] = Array.isArray(actionsRaw) ? (actionsRaw as any[]) : [];
    for (const action of actions) {
      const payload = (action as any)?.payload ?? {};
      const x = (payload as any)?.x;
      const y = (payload as any)?.y;
      if (typeof x !== 'number' || typeof y !== 'number') {
        continue;
      }

      const type = String((action as any)?.type ?? '').trim();
      if (!type) continue;

      const key = `${x},${y}`;
      const label =
        typeof resolveLabel === 'function'
          ? String(resolveLabel(action) ?? '').trim()
          : String((action as any)?.label ?? (action as any)?.type ?? '').trim();

      (result[key] ??= []).push({
        type,
        label: label || type,
        payload,
      });
    }

    return result;
  }
}

