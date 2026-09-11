import type {
  GameComponentDefinition,
  GameInitialization,
} from '../definitions/component-kit';

export type DefinitionToValidate = {
  id: string;
  players: { min: number; max: number };
  actions: Readonly<
    Record<string, { enumerateInputs?: unknown; validateInput?: unknown }>
  >;
  phases?: Readonly<
    Record<
      string,
      {
        actions?: readonly string[];
        next?: string;
        transitions?: readonly string[];
        terminal?: boolean;
        visibility?: string;
        timeout?: { afterMs?: number; action?: { type?: string } };
      }
    >
  >;
  initialPhase?: string;
  components?: readonly GameComponentDefinition[];
  initialization?: GameInitialization;
  resourceIds?: readonly string[];
  automatic?: readonly {
    id: string;
    priority?: number;
    when?: unknown;
    apply?: unknown;
  }[];
  choices?: Readonly<Record<string, { input?: unknown }>>;
  events?: readonly {
    type: string;
    data?: { parse?: unknown };
    emit?: unknown;
  }[];
  stateVersion?: number;
  contentVersion?: string;
  rulesVersion?: string;
  config?: {
    input?: { parse?: unknown; describe?: unknown };
    defaults?: unknown;
    phase?: string;
    permission?: string;
  };
  content?: {
    kind?: unknown;
    gameId?: unknown;
    version?: unknown;
    data?: unknown;
  };
  effects?: Readonly<Record<string, { input?: unknown; resolveRaw?: unknown }>>;
};

export type ValidationFailure = (path: string, reason: string) => never;
