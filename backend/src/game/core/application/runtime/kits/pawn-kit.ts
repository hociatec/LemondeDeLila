import {
  GameConfigurationError,
  GameNotFoundError,
  GameRuleViolationError,
  GameStateViolationError,
} from '../../../domain/errors/game-domain.errors';
import type { PlayerStateEntity } from '../../models/game-state.model';
import { resolveTrackPosition } from './movement-kit';

export type PawnDefinition = {
  id: string;
  label?: string;
  name?: string;
};

export type PawnSetDefinition = {
  readonly component: 'pawn.set';
  readonly id: string;
  readonly pawns: readonly PawnDefinition[];
  readonly perPlayer: number;
  readonly spaces?: number;
  readonly overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
  readonly initialPosition?: number;
  readonly entryRoll?: number;
  readonly entryPosition?: number;
  readonly exactFinish?: boolean;
  readonly homeStretchFrom?: number;
};

export type PawnMove = {
  pawnId: string;
  from: number;
  to: number;
  distance: number;
};

export type PawnKitState = {
  owners: Record<string, Record<string, number>>;
  assignments: Record<string, Record<string, string[]>>;
  positions: Record<string, Record<string, number>>;
};

export function createPawnKitState(): PawnKitState {
  return { owners: {}, assignments: {}, positions: {} };
}

export const pawns = {
  set(
    definition: Omit<PawnSetDefinition, 'component' | 'perPlayer'> & {
      perPlayer?: number;
    },
  ): PawnSetDefinition {
    const perPlayer = Math.max(1, Math.floor(definition.perPlayer ?? 1));
    const ids = definition.pawns.map((pawn) => pawn.id);
    if (ids.length === 0 || new Set(ids).size !== ids.length) {
      throw new GameConfigurationError('Catalogue de pions invalide');
    }
    return Object.freeze({
      ...definition,
      component: 'pawn.set',
      perPlayer,
      pawns: Object.freeze(
        definition.pawns.map((pawn) => Object.freeze({ ...pawn })),
      ),
    });
  },
};

export class GamePawnController {
  constructor(
    private readonly state: PawnKitState,
    private readonly players: readonly PlayerStateEntity[],
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
    ) => void = () => {},
    definitions: readonly PawnSetDefinition[] = [],
  ) {
    for (const definition of definitions) {
      this.staticDefinitions.set(definition.id, definition);
    }
    const legacy = this.state as PawnKitState & {
      sets?: Record<string, PawnSetDefinition>;
    };
    for (const definition of Object.values(legacy.sets ?? {})) {
      this.staticDefinitions.set(definition.id, definition);
    }
    delete legacy.sets;
  }

  private readonly staticDefinitions = new Map<string, PawnSetDefinition>();

  create(definition: PawnSetDefinition): void {
    this.staticDefinitions.set(definition.id, definition);
    this.state.owners[definition.id] ??= {};
    this.state.assignments[definition.id] ??= Object.fromEntries(
      this.players.map((player) => [String(player.id), []]),
    );
    this.state.positions[definition.id] ??= Object.fromEntries(
      definition.pawns.map((pawn) => [
        pawn.id,
        definition.initialPosition ?? 0,
      ]),
    );
  }

  reset(setId: string): void {
    this.staticDefinitions.delete(setId);
    delete this.state.owners[setId];
    delete this.state.assignments[setId];
    delete this.state.positions[setId];
  }

  assertValid(): void {
    for (const [setId, definition] of this.staticDefinitions) {
      const owners = this.state.owners[setId];
      const assignments = this.state.assignments[setId];
      const positions = this.state.positions[setId];
      if (!owners || !assignments || !positions) {
        throw new GameStateViolationError('État de pions incomplet', { setId });
      }
      const pawnIds = new Set(definition.pawns.map((pawn) => pawn.id));
      for (const [pawnId, playerId] of Object.entries(owners)) {
        if (
          !pawnIds.has(pawnId) ||
          !assignments[String(playerId)]?.includes(pawnId)
        ) {
          throw new GameStateViolationError('Propriétaire de pion invalide', {
            setId,
            pawnId,
            playerId,
          });
        }
      }
      for (const [playerId, assignedPawnIds] of Object.entries(assignments)) {
        if (
          !this.players.some((player) => String(player.id) === playerId) ||
          assignedPawnIds.length > definition.perPlayer ||
          new Set(assignedPawnIds).size !== assignedPawnIds.length ||
          assignedPawnIds.some(
            (pawnId) =>
              !pawnIds.has(pawnId) || owners[pawnId] !== Number(playerId),
          )
        ) {
          throw new GameStateViolationError('Affectation de pion invalide', {
            setId,
            playerId,
          });
        }
      }
      for (const [pawnId, position] of Object.entries(positions)) {
        const minimumPosition = Math.min(0, definition.initialPosition ?? 0);
        if (
          !pawnIds.has(pawnId) ||
          !Number.isInteger(position) ||
          position < minimumPosition ||
          (definition.spaces != null && position >= definition.spaces)
        ) {
          throw new GameStateViolationError('Position de pion invalide', {
            setId,
            pawnId,
            position,
          });
        }
      }
    }
  }

  definitions(setId: string): PawnDefinition[] {
    return [...structuredClone(this.requireSet(setId).pawns)];
  }

  perPlayer(setId: string): number {
    return this.requireSet(setId).perPlayer;
  }

  available(setId: string): PawnDefinition[] {
    const owners = this.state.owners[setId] ?? {};
    return this.definitions(setId).filter((pawn) => owners[pawn.id] == null);
  }

  assigned(setId: string, playerId: number): string[] {
    return [...(this.state.assignments[setId]?.[String(playerId)] ?? [])];
  }

  owner(setId: string, pawnId: string): number | null {
    return this.state.owners[setId]?.[pawnId] ?? null;
  }

  assign(setId: string, playerId: number, pawnId: string): void {
    const definition = this.requireSet(setId);
    if (!this.players.some((player) => player.id === playerId)) {
      throw new GameRuleViolationError('UNKNOWN_PLAYER', { playerId });
    }
    if (!definition.pawns.some((pawn) => pawn.id === pawnId)) {
      throw new GameRuleViolationError('UNKNOWN_PAWN', { setId, pawnId });
    }
    const owner = this.owner(setId, pawnId);
    if (owner != null && owner !== playerId) {
      throw new GameRuleViolationError('PAWN_ALREADY_ASSIGNED', {
        setId,
        pawnId,
        owner,
      });
    }
    const assignments = (this.state.assignments[setId] ??= {});
    const assigned = (assignments[String(playerId)] ??= []);
    if (assigned.includes(pawnId)) return;
    if (assigned.length >= definition.perPlayer) {
      throw new GameRuleViolationError('PLAYER_PAWN_LIMIT', {
        setId,
        playerId,
        limit: definition.perPlayer,
      });
    }
    assigned.push(pawnId);
    (this.state.owners[setId] ??= {})[pawnId] = playerId;
    this.emit('pawn.assigned', { setId, pawnId, playerId });
  }

  selectionComplete(setId: string): boolean {
    const definition = this.requireSet(setId);
    return this.players.every(
      (player) =>
        this.assigned(setId, player.id).length >= definition.perPlayer,
    );
  }

  legalMoves(
    setId: string,
    playerId: number,
    distance: number,
    options: {
      enterOn?: number;
      entryPosition?: number;
      exactFinish?: boolean;
      target?: (input: {
        pawnId: string;
        from: number;
        distance: number;
        finish: number | null;
      }) => number | null;
      canLand?: (move: Readonly<PawnMove>) => boolean;
    } = {},
  ): PawnMove[] {
    const definition = this.requireSet(setId);
    return this.assigned(setId, playerId).flatMap((pawnId) => {
      const from = this.position(setId, pawnId);
      let to: number;
      if (options.target) {
        const target = options.target({
          pawnId,
          from,
          distance: Math.trunc(distance),
          finish: definition.spaces == null ? null : definition.spaces - 1,
        });
        if (target == null) return [];
        to = target;
      } else if (from < 0) {
        const entryRoll = options.enterOn ?? definition.entryRoll;
        if (entryRoll != null && distance !== entryRoll) return [];
        to = options.entryPosition ?? definition.entryPosition ?? 0;
      } else if (definition.spaces) {
        const raw = from + Math.trunc(distance);
        const finish = definition.spaces - 1;
        const exactFinish = options.exactFinish ?? definition.exactFinish;
        if (exactFinish && raw > finish) return [];
        to = resolveTrackPosition(
          from,
          raw,
          definition.spaces,
          exactFinish ? 'exact' : (definition.overshoot ?? 'clamp'),
        );
      } else {
        to = from + Math.trunc(distance);
      }
      if (
        !Number.isInteger(to) ||
        to < (definition.initialPosition ?? 0) ||
        (definition.spaces != null && to >= definition.spaces)
      ) {
        return [];
      }
      const move = { pawnId, from, to, distance: Math.trunc(distance) };
      return options.canLand?.(move) === false ? [] : [move];
    });
  }

  applyMove(setId: string, move: PawnMove): number {
    if (this.position(setId, move.pawnId) !== move.from) {
      throw new GameRuleViolationError('STALE_PAWN_MOVE', {
        setId,
        pawnId: move.pawnId,
        expected: move.from,
        actual: this.position(setId, move.pawnId),
      });
    }
    return this.moveTo(setId, move.pawnId, move.to);
  }

  /** Applique un mouvement de course validé et exécute ses hooks métier. */
  applyRaceMove(
    setId: string,
    playerId: number,
    move: PawnMove,
    options: {
      beforeMove?: (move: Readonly<PawnMove>) => void;
      afterMove?: (move: Readonly<PawnMove>) => void;
      finishAt?: number;
      onFinish?: () => void;
    } = {},
  ): number {
    if (this.owner(setId, move.pawnId) !== playerId) {
      throw new GameRuleViolationError('PAWN_NOT_OWNED', {
        setId,
        pawnId: move.pawnId,
        playerId,
      });
    }
    options.beforeMove?.(move);
    const position = this.applyMove(setId, move);
    options.afterMove?.(move);
    const definition = this.requireSet(setId);
    const finishAt =
      options.finishAt ??
      (definition.exactFinish && definition.spaces != null
        ? definition.spaces - 1
        : undefined);
    if (
      finishAt != null &&
      this.assigned(setId, playerId).every(
        (pawnId) => this.position(setId, pawnId) >= finishAt,
      )
    ) {
      options.onFinish?.();
    }
    return position;
  }

  inHomeStretch(setId: string, pawnId: string): boolean {
    const definition = this.requireSet(setId);
    return (
      definition.homeStretchFrom != null &&
      this.position(setId, pawnId) >= definition.homeStretchFrom
    );
  }

  position(setId: string, pawnId: string): number {
    this.requirePawn(setId, pawnId);
    return this.state.positions[setId]?.[pawnId] ?? 0;
  }

  move(setId: string, pawnId: string, distance: number): number {
    const definition = this.requireSet(setId);
    this.requirePawn(setId, pawnId);
    const current = this.position(setId, pawnId);
    const next = definition.spaces
      ? resolveTrackPosition(
          current,
          current + Math.trunc(distance),
          definition.spaces,
          definition.overshoot ?? 'clamp',
        )
      : current + Math.trunc(distance);
    (this.state.positions[setId] ??= {})[pawnId] = next;
    this.emit('pawn.moved', {
      setId,
      pawnId,
      playerId: this.owner(setId, pawnId),
      from: current,
      to: next,
      distance: Math.trunc(distance),
    });
    return next;
  }

  moveTo(setId: string, pawnId: string, position: number): number {
    return this.move(setId, pawnId, position - this.position(setId, pawnId));
  }

  private requireSet(setId: string): PawnSetDefinition {
    const definition = this.staticDefinitions.get(setId);
    if (!definition) {
      throw new GameNotFoundError(`Jeu de pions inconnu: ${setId}`);
    }
    return definition;
  }

  private requirePawn(setId: string, pawnId: string): void {
    if (!this.requireSet(setId).pawns.some((pawn) => pawn.id === pawnId)) {
      throw new GameNotFoundError(`Pion inconnu: ${setId}/${pawnId}`);
    }
  }
}
