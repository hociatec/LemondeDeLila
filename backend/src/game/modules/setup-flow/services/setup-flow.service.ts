import { Injectable } from '@nestjs/common';
import type { PendingState } from '../../../core/entities/game-state.entity';
import { stringOrEmpty } from '@common/utils/string-value.utils';

type SetupPlayer = { id: number; username?: string | null };
type SetupChoice = { id: string; label: string; [key: string]: unknown };
type PawnChoice = {
  id?: unknown;
  label?: unknown;
  description?: unknown;
  [key: string]: unknown;
};
type ChoiceLike = { id?: unknown; label?: unknown; value?: unknown };

@Injectable()
export class SetupFlowService {
  createSequentialChoicePending(params: {
    players: SetupPlayer[];
    startPlayerId?: number | null;
    isAssigned: (playerId: number) => boolean;
    pendingType: string;
    choices: SetupChoice[];
    labelForPlayer?: (playerLabel: string) => string;
    dataBuilder?: (choices: SetupChoice[]) => Record<string, unknown>;
  }): { pending: PendingState; playerId: number; turnIndex: number } | null {
    const players = Array.isArray(params.players) ? params.players : [];
    if (!players.length) return null;

    const startId = this.toPlayerId(params.startPlayerId);
    const startIndex =
      startId != null
        ? players.findIndex((p) => this.toPlayerId(p?.id) === startId)
        : -1;
    const baseIndex = startIndex >= 0 ? startIndex : 0;
    let nextIndex = -1;
    for (let i = 0; i < players.length; i += 1) {
      const idx = (baseIndex + i) % players.length;
      const pid = this.toPlayerId(players[idx]?.id);
      if (pid == null) continue;
      if (!params.isAssigned(pid)) {
        nextIndex = idx;
        break;
      }
    }
    if (nextIndex < 0) return null;

    const normalizedChoices = this.normalizeChoices(params.choices);
    if (!normalizedChoices.length) return null;

    const playerId = this.toPlayerId(players[nextIndex].id);
    if (playerId == null) return null;
    const playerLabel = this.playerLabel(players[nextIndex]);
    const label =
      typeof params.labelForPlayer === 'function'
        ? params.labelForPlayer(playerLabel)
        : `C'est à ${playerLabel} de faire un choix.`;
    const pending: PendingState = {
      type: String(params.pendingType ?? '').trim() || 'setup_choice',
      playerId,
      blocking: true,
      label,
      choices: normalizedChoices.map((c) => c.label),
      data:
        typeof params.dataBuilder === 'function'
          ? params.dataBuilder(normalizedChoices)
          : { choices: normalizedChoices },
    };

    return {
      pending,
      playerId,
      turnIndex: nextIndex,
    };
  }

  createSequentialPawnPending(params: {
    players: SetupPlayer[];
    startPlayerId?: number | null;
    isAssigned: (playerId: number) => boolean;
    pawns: PawnChoice[];
    pendingType?: string;
    labelForPlayer?: (playerLabel: string) => string;
    choiceLabelBuilder?: (pawn: PawnChoice) => string;
    pawnDataMapper?: (pawn: PawnChoice) => Record<string, unknown>;
    includeChoiceMapData?: boolean;
    extraPendingData?: Record<string, unknown>;
  }): { pending: PendingState; playerId: number; turnIndex: number } | null {
    const pawns = this.normalizePawnChoices(params.pawns);
    if (!pawns.length) return null;

    return this.createSequentialChoicePending({
      players: params.players,
      startPlayerId: params.startPlayerId,
      isAssigned: params.isAssigned,
      pendingType: String(params.pendingType ?? '').trim() || 'choose_pawn',
      choices: pawns.map((pawn) => ({
        ...pawn,
        label:
          typeof params.choiceLabelBuilder === 'function'
            ? String(
                params.choiceLabelBuilder(pawn as PawnChoice) ?? pawn.label,
              ).trim()
            : pawn.label,
      })),
      labelForPlayer:
        params.labelForPlayer ??
        ((playerLabel) => `C'est à ${playerLabel} de choisir son pion.`),
      dataBuilder: (availableChoices) => ({
        ...(params.extraPendingData ?? {}),
        ...(params.includeChoiceMapData === true
          ? {
              choices: availableChoices.map((choice) =>
                String(choice?.label ?? '').trim(),
              ),
            }
          : {}),
        pawns: availableChoices.map((choice) =>
          typeof params.pawnDataMapper === 'function'
            ? params.pawnDataMapper(choice as PawnChoice)
            : this.defaultPawnData(choice as PawnChoice),
        ),
      }),
    });
  }

  private toPlayerId(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  resolveChoice<TChoice extends { id?: unknown; label?: unknown }>(
    raw: unknown,
    options: TChoice[],
  ): TChoice | null {
    const normalizedOptions = Array.isArray(options) ? options : [];
    if (!normalizedOptions.length) return null;

    const rawChoice = this.readChoiceLike(raw);
    const value =
      typeof raw === 'object' && raw != null
        ? (rawChoice.id ?? rawChoice.value ?? raw)
        : raw;
    const key = this.normalizeKey(value);
    if (!key) return null;

    for (const option of normalizedOptions) {
      const idKey = this.normalizeKey(option?.id);
      if (idKey && idKey === key) return option;
    }
    for (const option of normalizedOptions) {
      const labelKey = this.normalizeKey(option?.label);
      if (labelKey && labelKey === key) return option;
    }
    return null;
  }

  resolvePawnChoice<TChoice extends PawnChoice>(
    raw: unknown,
    options: TChoice[],
  ): TChoice | null {
    const normalized = this.normalizePawnChoices(options).map((pawn) => ({
      ...(pawn as TChoice),
      label: pawn.label,
    }));
    if (!normalized.length) return null;

    const rawChoice = this.readChoiceLike(raw);
    const candidate =
      typeof raw === 'object' && raw != null
        ? (rawChoice.id ??
          rawChoice.pawnId ??
          rawChoice.pawn ??
          rawChoice.value ??
          rawChoice.label ??
          raw)
        : raw;

    return this.resolveChoice(candidate, normalized) as TChoice | null;
  }

  normalizeKey(value: unknown): string {
    return stringOrEmpty(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  private normalizeChoices(choices: SetupChoice[]): SetupChoice[] {
    return (Array.isArray(choices) ? choices : [])
      .map((choice) => ({
        ...choice,
        id: stringOrEmpty(choice?.id).trim(),
        label: stringOrEmpty(choice?.label).trim(),
      }))
      .filter((choice) => choice.id.length > 0 && choice.label.length > 0);
  }

  private normalizePawnChoices<TChoice extends PawnChoice>(
    choices: TChoice[],
  ): Array<TChoice & SetupChoice> {
    return (Array.isArray(choices) ? choices : [])
      .map((choice) => {
        const id = stringOrEmpty(choice?.id).trim();
        const label = stringOrEmpty(choice?.label ?? id).trim();
        return { ...choice, id, label } as TChoice & SetupChoice;
      })
      .filter((choice) => choice.id.length > 0 && choice.label.length > 0);
  }

  private defaultPawnData(choice: PawnChoice): Record<string, unknown> {
    return {
      id: stringOrEmpty(choice?.id).trim(),
      label: stringOrEmpty(choice?.label).trim(),
      description: stringOrEmpty(choice?.description).trim(),
    };
  }

  private readChoiceLike(value: unknown): ChoiceLike & {
    pawnId?: unknown;
    pawn?: unknown;
  } {
    if (value == null || typeof value !== 'object') {
      return {};
    }
    return value as ChoiceLike & { pawnId?: unknown; pawn?: unknown };
  }

  private playerLabel(player: SetupPlayer | null | undefined): string {
    const username = stringOrEmpty(player?.username).trim();
    if (username.length > 0) return username;
    const id = Number(player?.id ?? 0);
    return Number.isFinite(id) && id > 0 ? `Joueur ${id}` : 'Joueur';
  }
}
