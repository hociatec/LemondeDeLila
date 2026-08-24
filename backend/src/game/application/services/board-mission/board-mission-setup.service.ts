import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../models/game-state.model';
import { getSafePlayers } from '../../helpers/setup-service.helper';
import { RandomService } from '../../services/random.service';
import type {
  BoardMissionDeckCatalog,
  BoardMissionMetadata,
  BoardMissionResolvedModel,
  BoardMissionRules,
} from '../../models/board-mission.model';

type RuntimeMeta<TMeta extends BoardMissionMetadata> = TMeta &
  Record<string, unknown>;

@Injectable()
export class BoardMissionSetupService {
  constructor(private readonly random: RandomService) {}

  hydrateInitialState<
    TMeta extends BoardMissionMetadata,
    TRules extends BoardMissionRules,
  >(
    baseState: GameStateEntity,
    model: BoardMissionResolvedModel<TRules> & {
      board: { tiles: TMeta['tiles'] };
    } & BoardMissionDeckCatalog<
        TMeta['clients'][number],
        TMeta['events'][number]
      >,
    enrichMeta?: (meta: TMeta, baseState: GameStateEntity) => TMeta,
  ): GameStateEntity {
    const clientsDeck = model[model.rules.decks.clients];
    const eventsDeck = model[model.rules.decks.events];
    const players = getSafePlayers(baseState);
    const positions: Record<number, number> = {};
    const statuses: Record<number, number> = {};
    const completedTrips: Record<number, number> = {};
    const activeClients: Record<number, number | null> = {};

    for (const player of players) {
      if (player?.id == null) continue;
      positions[player.id] = model.rules.setup.startTileIndex;
      statuses[player.id] = 0;
      completedTrips[player.id] = 0;
      activeClients[player.id] = null;
    }

    const seedMeta = this.getRuntimeMeta<TMeta>(baseState);
    const clientIds = (clientsDeck.cards ?? []).map((card) => card.id);
    const firstShuffle = this.random.shuffle(seedMeta, clientIds);
    let meta = {
      ...seedMeta,
      ...firstShuffle.meta,
      tiles: model.board.tiles ?? [],
      clients: clientsDeck.cards ?? [],
      events: eventsDeck.cards ?? [],
      deckClients: firstShuffle.values,
      discardClients: [],
      deckEvents: [],
      discardEvents: [],
      positions,
      activeClients,
      completedTrips,
      blockedTileId: null,
      lastEventId: null,
      eventTurnPlayerId: null,
      winnerId: null,
    } as TMeta;

    const eventIds = (eventsDeck.cards ?? []).map((card) => card.id);
    const eventShuffle = this.random.shuffle(meta, eventIds);
    meta = {
      ...meta,
      ...eventShuffle.meta,
      deckEvents: eventShuffle.values,
      discardEvents: [],
    } as TMeta;

    const finalMeta = enrichMeta ? enrichMeta(meta, baseState) : meta;

    return {
      ...baseState,
      phase: 'playing',
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...finalMeta },
    };
  }

  private getRuntimeMeta<TMeta extends BoardMissionMetadata>(
    state: GameStateEntity,
  ): RuntimeMeta<TMeta> {
    return (state.metadata ?? {}) as RuntimeMeta<TMeta>;
  }
}





