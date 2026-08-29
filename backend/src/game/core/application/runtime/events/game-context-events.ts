import { GameConfigurationError } from '../../../domain/errors/game-domain.errors';
import type { EventVisibility } from '../../models/game-event.model';
import type { GameLogEntry } from '../../models/game-state.model';
import {
  ENGINE_EVENT_VISIBILITY,
  type EngineEventMap,
  type EngineEventType,
  isEngineEventType,
} from './engine-event-registry';

export type EventDataMap = Record<string, object>;
export type DomainEvent<TEvents extends EventDataMap = EventDataMap> = {
  [TType in keyof TEvents & string]: {
    type: TType;
    data: TEvents[TType];
    visibility: EventVisibility;
  };
}[keyof TEvents & string];

type EngineVisibilityArguments<TType extends EngineEventType> =
  (typeof ENGINE_EVENT_VISIBILITY)[TType] extends 'dynamic'
    ? [visibility: EventVisibility]
    : [visibility?: EventVisibility];

export class GameContextEvents {
  private readonly buffer: DomainEvent[] = [];

  constructor(
    private readonly log: GameLogEntry[],
    private readonly nowIso: () => string,
  ) {}

  readonly api = {
    emit: (
      type: string,
      data: Record<string, unknown> = {},
      visibility: EventVisibility = { kind: 'public' },
    ) => this.buffer.push({ type, data, visibility }),
    engine: <TType extends keyof EngineEventMap>(
      type: TType,
      data: EngineEventMap[TType],
      ...[visibility]: EngineVisibilityArguments<TType>
    ) => {
      this.buffer.push({
        type,
        data,
        visibility: resolveEngineVisibility(type, visibility),
      });
    },
    message: (key: string, params: Record<string, unknown> = {}) => {
      const normalizedKey = key.trim();
      if (!normalizedKey) return;
      this.buffer.push({
        type: 'game.message',
        data: { key: normalizedKey, params: structuredClone(params) },
        visibility: { kind: 'public' },
      });
      this.log.push({
        key: normalizedKey,
        params: structuredClone(params),
        timestamp: this.nowIso(),
      });
    },
    latestMessage: () => {
      const entry = this.log.at(-1);
      return entry == null ? null : structuredClone(entry);
    },
    messages: () => structuredClone(this.log),
  };

  emitDomainEvent(
    type: string,
    data: Record<string, unknown>,
    visibility?: EventVisibility,
  ): void {
    this.buffer.push({
      type,
      data,
      visibility: isEngineEventType(type)
        ? resolveEngineVisibility(type, visibility)
        : (visibility ?? { kind: 'public' }),
    });
  }

  consume(): DomainEvent[] {
    return this.buffer.splice(0);
  }
}

function resolveEngineVisibility(
  type: EngineEventType,
  visibility?: EventVisibility,
): EventVisibility {
  if (visibility) return visibility;
  const policy = ENGINE_EVENT_VISIBILITY[type];
  if (policy === 'public' || policy === 'internal') return { kind: policy };
  throw new GameConfigurationError(
    `L'événement ${type} requiert une visibilité explicite`,
  );
}
