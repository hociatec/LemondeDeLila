import {
  componentCapabilities,
  mechanicCapabilities,
  interactionCapabilities,
} from '../contracts/compiled-game-plan';
import type {
  OptionalGameCapability,
  CompiledGamePlan,
} from '../contracts/compiled-game-plan';
import type { CompiledGameDiagnostics } from '../contracts/compiled-game-definition';
import type { CompiledDescriptorInput } from './compiled-game-diagnostics';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

/** Lower author metadata once; execution consumes only the resulting data. */
export function compileGamePlan<TState extends object>(
  normalized: CompiledDescriptorInput<TState> & {
    readonly compiled: CompiledGameDiagnostics;
    readonly capabilities?: readonly OptionalGameCapability[];
  },
): CompiledGamePlan {
  const capabilities = new Set<OptionalGameCapability>();
  for (const component of normalized.components ?? []) {
    if (Object.hasOwn(componentCapabilities, component.component)) {
      capabilities.add(
        componentCapabilities[
          component.component as keyof typeof componentCapabilities
        ],
      );
    }
  }
  for (const pattern of normalized.patterns ?? []) {
    for (const mechanic of pattern.mechanics) {
      if (Object.hasOwn(mechanicCapabilities, mechanic)) {
        for (const capability of mechanicCapabilities[
          mechanic as keyof typeof mechanicCapabilities
        ])
          capabilities.add(capability);
      }
    }
  }
  for (const capability of normalized.capabilities ?? []) {
    if (
      !interactionCapabilities.some((value) => value === capability) &&
      !capabilities.has(capability)
    )
      throw new GameConfigurationError(
        `Unknown optional capability: ${capability}`,
      );
    capabilities.add(capability);
  }
  return {
    version: 1 as const,
    patterns: (normalized.patterns ?? []).map(({ id, mechanics }) => ({
      id,
      mechanics: [...mechanics],
    })),
    capabilities: [...capabilities].sort(),
    componentIds: normalized.compiled.componentIds,
    actionIds: normalized.compiled.actionIds,
    phaseIds: normalized.compiled.phaseIds,
    choiceIds: normalized.compiled.choiceIds,
    effectIds: normalized.compiled.effectIds,
  };
}
