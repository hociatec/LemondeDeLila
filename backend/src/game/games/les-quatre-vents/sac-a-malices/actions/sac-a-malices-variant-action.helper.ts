import type { GameStateEntity } from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type { GameSingleActionDto } from '../../../../application/models/game-action.model';
import {
  SAC_VARIANT_BY_ID,
  parseVariantInput,
} from '../sac-a-malices-variants';
import type { SacVariantId } from '../model/sac-a-malices.types';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function toNumberValue(value: unknown): number | null {
  const candidate =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length
        ? Number(value.trim())
        : NaN;
  return Number.isFinite(candidate) ? candidate : null;
}

type ApplySacAMalicesVariantConfigInput = {
  state: GameStateEntity;
  action: GameSingleActionDto;
  variantId: SacVariantId | undefined;
  setupStep: string | undefined;
  applyVariantSelection: (
    state: GameStateEntity,
    variantId: SacVariantId,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
};

export function applySacAMalicesVariantConfig(
  input: ApplySacAMalicesVariantConfigInput,
): GameStateEntity {
  if (input.setupStep !== 'setup_config') {
    return input.state;
  }

  const payload = asRecord(input.action?.payload);
  const candidateVariant =
    toStringValue(payload.variant ?? payload.variantId ?? payload.value) ??
    toStringValue(input.variantId);
  const parsedCandidate = parseVariantInput(candidateVariant ?? null);
  const parsed = parsedCandidate ?? 'classic';
  const variant = SAC_VARIANT_BY_ID[parsed] ?? SAC_VARIANT_BY_ID['classic'];
  const chosenId = (variant?.id ?? 'classic') as SacVariantId;

  let next = input.applyVariantSelection(input.state, chosenId);
  const actionMeta = asRecord(
    (input.action as unknown as { meta?: unknown }).meta,
  );
  const actorId = toNumberValue(actionMeta.actorId);
  const label = variant?.label ?? chosenId;

  if (!parsedCandidate) {
    return input.appendLog(next, `Variante inconnue, défaut "${label}".`);
  }

  if (actorId != null) {
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, actorId)} choisit la variante : ${label}.`,
    );
  }

  return input.appendLog(next, `Variante choisie : ${label}.`);
}
