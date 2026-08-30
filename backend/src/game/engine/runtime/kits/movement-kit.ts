import {
  GameConfigurationError,
  GameNotFoundError,
  GameStateViolationError,
} from '../../../core/domain/errors/game-domain.errors';
import type { GameEffectInstruction } from '../effects/effects-kit';

export type TrackDefinition = {
  readonly component: 'movement.track';
  id: string;
  spaces: number;
  overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
  finish?: number;
  homeStretch?: { from: number; to?: number };
  landingEffects?: Readonly<Record<number, readonly GameEffectInstruction[]>>;
};

export type MovementKitState = {
  positions: Record<string, Record<string, number>>;
};

export type MovementLanding<TTile> = {
  trackId: string;
  playerId: number;
  position: number;
  tile: TTile | undefined;
  depth: number;
};

export type MovementLandingOptions<TTile> = {
  trackId: string;
  playerId: number;
  tiles?: readonly TTile[];
  tileAt?: (position: number) => TTile | undefined;
  depth?: number;
  maxDepth?: number;
  blocked?: () => boolean;
  onLand: (landing: MovementLanding<TTile>) => void;
  onComplete?: (landing: MovementLanding<TTile>) => void;
};

export type MovementPipelineOptions<TTile> = MovementLandingOptions<TTile> & {
  distance: number;
  onPass?: (input: {
    trackId: string;
    playerId: number;
    position: number;
  }) => void;
};

export const movement = {
  track(definition: Omit<TrackDefinition, 'component'>): TrackDefinition {
    if (!Number.isInteger(definition.spaces) || definition.spaces < 1) {
      throw new GameConfigurationError(
        'Une piste doit contenir au moins une case',
      );
    }
    if (
      Object.keys(definition.landingEffects ?? {}).some((position) => {
        const value = Number(position);
        return (
          !Number.isInteger(value) || value < 0 || value >= definition.spaces
        );
      })
    ) {
      throw new GameConfigurationError(
        `Effet associé à une case inexistante: ${definition.id}`,
      );
    }
    return deepFreeze({ ...definition, component: 'movement.track' });
  },
};

export class GameMovementController {
  private readonly definitions = new Map<string, TrackDefinition>();

  constructor(
    private readonly state: MovementKitState,
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void = () => {},
    definitions: readonly TrackDefinition[] = [],
    private readonly scheduleEffects: (
      ...effects: readonly GameEffectInstruction[]
    ) => void = () => {},
  ) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
  }

  createTrack(definition: TrackDefinition): void {
    this.definitions.set(definition.id, definition);
    this.state.positions[definition.id] ??= {};
  }

  resetTrack(trackId: string): void {
    delete this.state.positions[trackId];
    this.definitions.delete(trackId);
  }

  assertValid(): void {
    for (const [trackId, positions] of Object.entries(this.state.positions)) {
      const track = this.definitions.get(trackId);
      if (!track) {
        throw new GameStateViolationError('Positions de piste absentes', {
          trackId,
        });
      }
      for (const [playerId, position] of Object.entries(positions)) {
        if (
          !Number.isInteger(position) ||
          position < 0 ||
          position >= track.spaces
        ) {
          throw new GameStateViolationError('Position de piste invalide', {
            trackId,
            playerId,
            position,
          });
        }
      }
    }
  }

  position(trackId: string, playerId: number): number {
    return this.state.positions[trackId]?.[String(playerId)] ?? 0;
  }

  positions(trackId: string): Record<number, number> {
    return Object.fromEntries(
      Object.entries(this.state.positions[trackId] ?? {}).map(
        ([playerId, position]) => [Number(playerId), position],
      ),
    );
  }

  finishPosition(trackId: string): number {
    const track = this.requireTrack(trackId);
    return Math.max(
      0,
      Math.min(track.spaces - 1, track.finish ?? track.spaces - 1),
    );
  }

  atFinish(trackId: string, playerId: number): boolean {
    return this.position(trackId, playerId) === this.finishPosition(trackId);
  }

  distanceToFinish(trackId: string, playerId: number): number {
    return Math.max(
      0,
      this.finishPosition(trackId) - this.position(trackId, playerId),
    );
  }

  inHomeStretch(trackId: string, playerId: number): boolean {
    const track = this.requireTrack(trackId);
    if (!track.homeStretch) return false;
    const position = this.position(trackId, playerId);
    return (
      position >= track.homeStretch.from &&
      position <= (track.homeStretch.to ?? this.finishPosition(trackId))
    );
  }

  preview(trackId: string, playerId: number, distance: number): number {
    const track = this.requireTrack(trackId);
    const current = this.position(trackId, playerId);
    return resolveTrackPosition(
      current,
      current + Math.trunc(distance),
      track.spaces,
      track.overshoot ?? 'clamp',
    );
  }

  move(trackId: string, playerId: number, distance: number): number {
    return this.performMove(trackId, playerId, distance);
  }

  private performMove(
    trackId: string,
    playerId: number,
    distance: number,
    onPass?: (position: number) => void,
  ): number {
    const current = this.position(trackId, playerId);
    const next = this.preview(trackId, playerId, distance);
    (this.state.positions[trackId] ??= {})[String(playerId)] = next;
    this.emit('pawn.moved', {
      trackId,
      playerId,
      from: current,
      to: next,
      distance: Math.trunc(distance),
    });
    for (const position of this.passedPositions(trackId, current, distance)) {
      onPass?.(position);
    }
    this.emit('pawn.landed', { trackId, playerId, position: next });
    const effects = this.definitions.get(trackId)?.landingEffects?.[next] ?? [];
    this.scheduleEffects(...effects);
    return next;
  }

  /** Résout une destination courante avec les garde-fous communs. */
  resolveLanding<TTile>(options: MovementLandingOptions<TTile>): number | null {
    const depth = options.depth ?? 0;
    if (depth > (options.maxDepth ?? Number.POSITIVE_INFINITY)) return null;
    if (options.blocked?.()) return null;
    const position = this.position(options.trackId, options.playerId);
    const landing: MovementLanding<TTile> = {
      trackId: options.trackId,
      playerId: options.playerId,
      position,
      tile: options.tileAt?.(position) ?? options.tiles?.[position],
      depth,
    };
    options.onLand(landing);
    options.onComplete?.(landing);
    return position;
  }

  /** Exécute move -> onPass -> onLand -> effets déclarés -> fin de mouvement. */
  moveAndResolve<TTile>(
    options: MovementPipelineOptions<TTile>,
  ): number | null {
    const depth = options.depth ?? 0;
    if (depth > (options.maxDepth ?? Number.POSITIVE_INFINITY)) return null;
    if (options.blocked?.()) return null;
    this.performMove(
      options.trackId,
      options.playerId,
      options.distance,
      (position) =>
        options.onPass?.({
          trackId: options.trackId,
          playerId: options.playerId,
          position,
        }),
    );
    return this.resolveLanding(options);
  }

  moveTo(trackId: string, playerId: number, position: number): number {
    return this.move(
      trackId,
      playerId,
      position - this.position(trackId, playerId),
    );
  }

  swap(trackId: string, leftPlayerId: number, rightPlayerId: number): void {
    const left = this.position(trackId, leftPlayerId);
    const right = this.position(trackId, rightPlayerId);
    this.moveTo(trackId, leftPlayerId, right);
    this.moveTo(trackId, rightPlayerId, left);
  }

  private passedPositions(
    trackId: string,
    current: number,
    distance: number,
  ): number[] {
    const track = this.requireTrack(trackId);
    const steps = Math.abs(Math.trunc(distance));
    if (steps <= 1) return [];
    const direction = distance < 0 ? -1 : 1;
    const passed: number[] = [];
    for (let step = 1; step < steps; step += 1) {
      const position = resolveTrackPosition(
        current,
        current + direction * step,
        track.spaces,
        track.overshoot ?? 'clamp',
      );
      passed.push(position);
    }
    return passed;
  }

  private requireTrack(trackId: string): TrackDefinition {
    const track = this.definitions.get(trackId);
    if (!track) throw new GameNotFoundError(`Piste inconnue: ${trackId}`);
    return track;
  }
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export function resolveTrackPosition(
  current: number,
  target: number,
  spaces: number,
  policy: NonNullable<TrackDefinition['overshoot']>,
): number {
  const last = Math.max(0, spaces - 1);
  if (policy === 'exact') {
    return target < 0 || target > last ? current : target;
  }
  if (policy === 'wrap') {
    return ((target % spaces) + spaces) % spaces;
  }
  if (policy === 'bounce') {
    if (target < 0) return 0;
    if (last === 0) return 0;
    const period = last * 2;
    const normalized = ((target % period) + period) % period;
    return normalized <= last ? normalized : period - normalized;
  }
  return Math.min(last, Math.max(0, target));
}

export function createMovementKitState(): MovementKitState {
  return { positions: {} };
}
