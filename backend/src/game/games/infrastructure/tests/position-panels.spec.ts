import { BoardPayloadService } from '../../../core/application/services/board-payload.service';
import type { GameStateEntity } from '../../../core/application/models/game-state.model';
import { AventureSauvagePresenterService } from '../../les-quatre-vents/aventure-sauvage/application/services/aventure-sauvage-presenter.service';
import { AFondLesBallonsPresenterService } from '../../les-quatre-vents/a-fond-les-ballons/application/services/a-fond-les-ballons-presenter.service';
import { CaPresenterService } from '../../les-quatre-vents/ca-derape/application/services/ca-presenter.service';
import { ContesPresenterService } from '../../les-quatre-vents/contes-et-cacahuetes/application/services/contes-presenter.service';
import { FroussePresenterService } from '../../les-quatre-vents/frousse-party/application/services/frousse-presenter.service';
import { GaloponsPresenterService } from '../../les-quatre-vents/galopons-ensemble/application/services/galopons-presenter.service';
import { MinuitPresenterService } from '../../les-quatre-vents/en-attendant-minuit/application/services/minuit-presenter.service';
import { MissionGalaxiePresenterService } from '../../les-quatre-vents/mission-galaxie/application/services/mission-galaxie-presenter.service';
import { MonVillagePresenterService } from '../../les-quatre-vents/mon-village-mon-histoire/application/services/mon-village-presenter.service';
import { PiratesEnVadrouillePresenterService } from '../../les-quatre-vents/pirates-en-vadrouille/application/services/pirates-en-vadrouille-presenter.service';
import { PrimalisPresenterService } from '../../les-quatre-vents/primalis/application/services/primalis-presenter.service';
import { SacAMalicesPresenterService } from '../../les-quatre-vents/sac-a-malices/application/services/sac-a-malices-presenter.service';
import { ToutPresDeMamanPresenterService } from '../../les-quatre-vents/tout-pres-de-maman/application/services/tout-pres-de-maman-presenter.service';
import { VoyagePresenterService } from '../../les-quatre-vents/voyage-en-terre-de-brumes/application/services/voyage-presenter.service';
import { JeuOiePresenterService } from '../../vents-sacres/jeu-oie/application/services/jeu-oie-presenter.service';
import { BoardMissionPresenterService } from '../../../core/application/services/board-mission/board-mission-presenter.service';
import { BoardMissionRuntimeSupportService } from '../../../core/application/services/board-mission/board-mission-runtime-support.service';

type PresenterCase = {
  label: string;
  presenter: {
    exposeStateForUser(
      state: GameStateEntity,
      userId: number,
    ): {
      extras?: {
        ui?: {
          panels?: Record<string, unknown>;
        };
      };
      [key: string]: unknown;
    };
  };
  metadata: Record<string, unknown>;
};

function createBaseState(metadata: Record<string, unknown>): GameStateEntity {
  return {
    status: 'started',
    phase: 'playing',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Lila' },
      { id: 2, username: 'Mouche' },
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    pending: null,
    extras: {},
    metadata,
  };
}

describe('Position panels', () => {
  const board = new BoardPayloadService();
  const boardMissionPresenter = new BoardMissionPresenterService(
    board,
    new BoardMissionRuntimeSupportService(),
  );
  const sharedTiles = [{}, {}, {}];
  const sharedPositions = { 1: 0, 2: 2 };

  const cases: PresenterCase[] = [
    {
      label: 'Aventure Sauvage',
      presenter: new AventureSauvagePresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions },
    },
    {
      label: 'À fond les ballons',
      presenter: new AFondLesBallonsPresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions },
    },
    {
      label: 'Ça dérape',
      presenter: new CaPresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions },
    },
    {
      label: 'Contes et Cacahuètes',
      presenter: new ContesPresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions },
    },
    {
      label: 'En attendant minuit',
      presenter: new MinuitPresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions },
    },
    {
      label: 'Frousse Party',
      presenter: new FroussePresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions },
    },
    {
      label: 'Galopons Ensemble',
      presenter: new GaloponsPresenterService(board),
      metadata: {
        tiles: sharedTiles,
        positions: sharedPositions,
        apples: { 1: 0, 2: 1 },
      },
    },
    {
      label: 'Jeu de l’oie',
      presenter: new JeuOiePresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions, laps: {} },
    },
    {
      label: 'Mission Galaxie',
      presenter: new MissionGalaxiePresenterService(board),
      metadata: { tiles: sharedTiles, positions: sharedPositions },
    },
    {
      label: 'Mon Village Mon Histoire',
      presenter: new MonVillagePresenterService(board),
      metadata: {
        tiles: sharedTiles,
        positions: sharedPositions,
        decks: {},
        collections: {},
      },
    },
    {
      label: 'Pirates en vadrouille',
      presenter: new PiratesEnVadrouillePresenterService(board),
      metadata: {
        tiles: sharedTiles,
        positions: sharedPositions,
        collections: {
          1: { treasures: [], bonus: [], obstacles: [], goldPieces: 0 },
          2: { treasures: [], bonus: [], obstacles: [], goldPieces: 0 },
        },
      },
    },
    {
      label: 'Primalis',
      presenter: new PrimalisPresenterService(board),
      metadata: {
        tiles: sharedTiles,
        positions: sharedPositions,
        collections: {},
      },
    },
    {
      label: 'Sac à malices',
      presenter: new SacAMalicesPresenterService(board),
      metadata: {
        tiles: [
          { type: 'property', title: 'Prairie' },
          { type: 'station', title: 'Gare' },
          { type: 'utility', title: 'Moulin' },
        ],
        positions: sharedPositions,
        money: { 1: 1500, 2: 1400 },
        ownership: {},
      },
    },
    {
      label: 'Taxi Express',
      presenter: {
        exposeStateForUser(state: GameStateEntity, userId: number) {
          return boardMissionPresenter.exposeStateForUser(
            state,
            userId,
            {
              rules: {
                version: 1,
                setup: { startTileIndex: 0 },
                decks: { clients: 'clients', events: 'events' },
                victory: { type: 'completed_trips', target: 5 },
                turnFlow: [{ type: 'roll' }],
                messages: {
                  newClient: '',
                  noClientAvailable: '',
                  event: '',
                  noEvent: '',
                  move: '',
                  blocked: '',
                  dropoff: '',
                  win: '',
                },
              },
            },
            {
              phases: ['turn'],
              scorePanelTitle: 'Trajets',
            },
          );
        },
      },
      metadata: {
        tiles: sharedTiles,
        positions: sharedPositions,
        completedTrips: { 1: 0, 2: 0 },
        activeClients: {},
        clients: [],
        events: [],
        lastEventId: null,
      },
    },
    {
      label: 'Tout près de Maman',
      presenter: new ToutPresDeMamanPresenterService(board),
      metadata: {
        tiles: sharedTiles,
        positions: sharedPositions,
        tokens: { 1: 0, 2: 1 },
        deckCards: [],
        cards: [],
      },
    },
    {
      label: 'Voyage en Terre de Brumes',
      presenter: new VoyagePresenterService(board),
      metadata: {
        tiles: sharedTiles,
        positions: sharedPositions,
        collections: {},
      },
    },
  ];

  it.each(cases)('$label does not expose a local position panel', (entry) => {
    const exposed = entry.presenter.exposeStateForUser(
      createBaseState(entry.metadata),
      1,
    );

    expect(exposed.extras?.ui?.panels?.position).toBeUndefined();
  });
});




