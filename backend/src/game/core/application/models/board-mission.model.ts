export type BoardMissionDeckName = 'clients' | 'events';

export type BoardMissionFlowStepType =
  | 'ensure_active_client'
  | 'ensure_turn_event'
  | 'roll'
  | 'move_by_last_roll'
  | 'resolve_blocked_path'
  | 'resolve_destination'
  | 'advance_turn';

export interface BoardMissionFlowStep {
  type: BoardMissionFlowStepType;
}

export interface BoardMissionMessages {
  newClient: string;
  noClientAvailable: string;
  event: string;
  noEvent: string;
  move: string;
  blocked: string;
  dropoff: string;
  win: string;
}

export interface BoardMissionRules {
  version: 1;
  setup: {
    startTileIndex: number;
  };
  decks: {
    clients: BoardMissionDeckName;
    events: BoardMissionDeckName;
  };
  victory: {
    type: 'completed_trips';
    target: number;
  };
  turnFlow: BoardMissionFlowStep[];
  messages: BoardMissionMessages;
}

export interface BoardMissionTile {
  id: number;
  title: string;
}

export interface BoardMissionClientCard {
  id: number;
  clientName: string;
  destinationId: number;
  route?: string;
}

export interface BoardMissionEventCard {
  id: number;
  title: string;
  description: string;
  blockedTileId: number;
}

export interface BoardMissionMetadata {
  tiles: BoardMissionTile[];
  clients: BoardMissionClientCard[];
  events: BoardMissionEventCard[];
  deckClients: number[];
  deckEvents: number[];
  discardClients: number[];
  discardEvents: number[];
  positions: Record<number, number>;
  activeClients: Record<number, number | null>;
  completedTrips: Record<number, number>;
  blockedTileId: number | null;
  lastEventId: number | null;
  eventTurnPlayerId: number | null;
  winnerId: number | null;
}

export interface BoardMissionStatuses {
  skipTurn: Record<number, number>;
}

export type BoardMissionGameMetadata = BoardMissionMetadata & {
  statuses: BoardMissionStatuses;
  pendingContext: null;
};

export interface BoardMissionResolvedModel<TRules extends BoardMissionRules> {
  rules: TRules;
}

export interface BoardMissionDeckCatalog<
  TClientCard extends BoardMissionClientCard = BoardMissionClientCard,
  TEventCard extends BoardMissionEventCard = BoardMissionEventCard,
> {
  clients: { cards: TClientCard[] };
  events: { cards: TEventCard[] };
}
