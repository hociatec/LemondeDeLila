import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type { GamePresentation } from '../contracts/author-rule-contracts';
import type { BananaTroopsProgram } from '../contracts/banana-troops-program';
import type { BalloonRaceProgram } from '../contracts/balloon-race-program';
import type { BoardGameProgram } from '../contracts/board-game-program';
import type { CarAssemblyProgram } from '../contracts/car-assembly-program';
import type { CatPattesProgram } from '../contracts/cat-pattes-program';
import type { CardCirclesProgram } from '../contracts/card-circles-program';
import type { CollectionRaceProgram } from '../contracts/collection-race-program';
import type { CorridorProgram } from '../contracts/corridor-program';
import type { ContesProgram } from '../contracts/contes-program';
import type { DeliveryRaceProgram } from '../contracts/delivery-race-program';
import type { DerapeRaceProgram } from '../contracts/derape-race-program';
import type { EcosystemRaceProgram } from '../contracts/ecosystem-race-program';
import type { EventRaceProgram } from '../contracts/event-race-program';
import type { FouleesRaceProgram } from '../contracts/foulees-race-program';
import type { FrousseRaceProgram } from '../contracts/frousse-race-program';
import type { GalaxyRaceProgram } from '../contracts/galaxy-race-program';
import type { GerardProgram } from '../contracts/gerard-program';
import type { RitesProgram } from '../contracts/rites-program';
import type { SacProgram } from '../contracts/sac-program';
import type { GaloponsRaceProgram } from '../contracts/galopons-race-program';
import type { GooseRaceProgram } from '../contracts/goose-race-program';
import type { JudgedCardsProgram } from '../contracts/judged-cards-program';
import type { LamaProgram } from '../contracts/lama-program';
import type { MamanRaceProgram } from '../contracts/maman-race-program';
import type { MidnightRaceProgram } from '../contracts/midnight-race-program';
import type { MineDomainProgram } from '../contracts/mine-domain-program';
import type { MnemosyneProgram } from '../contracts/mnemosyne-program';
import type { NatureFamiliesProgram } from '../contracts/nature-families-program';
import type { NawakProgram } from '../contracts/nawak-program';
import type { OlympiaProgram } from '../contracts/olympia-program';
import type { ParadeProgram } from '../contracts/parade-program';
import type { PawnRaceProgram } from '../contracts/pawn-race-program';
import type { PirateRaceProgram } from '../contracts/pirate-race-program';
import type { ProfessionFamiliesProgram } from '../contracts/profession-families-program';
import type { WonderMarketProgram } from '../contracts/wonder-market-program';
import type { VoyageProgram } from '../contracts/voyage-program';
import type { ZigEtZagProgram } from '../contracts/zig-et-zag-program';
import type { ContentSnapshotMigration } from '../content/game-content';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { JsonGameAction, JsonGameVictory } from './json-game-action-types';
import type { JsonGamePattern } from './json-game-patterns';
import type { GridPlacementProgram } from '../contracts/grid-placement-program';

export type JsonGameDocument = {
  schemaVersion: 1;
  contentVersion: string;
  definitionVersion: string;
  snapshotMigrations?: readonly ContentSnapshotMigration[];
  category: string;
  world: string;
  presentation?: GamePresentation;
  patterns?: readonly JsonGamePattern[];
  board?: BoardGameProgram;
  grid?: GridPlacementProgram;
  judgedCards?: JudgedCardsProgram;
  lama?: LamaProgram;
  eventRace?: EventRaceProgram;
  deliveryRace?: DeliveryRaceProgram;
  gooseRace?: GooseRaceProgram;
  collectionRace?: CollectionRaceProgram;
  corridor?: CorridorProgram;
  contes?: ContesProgram;
  ecosystemRace?: EcosystemRaceProgram;
  pirateRace?: PirateRaceProgram;
  parade?: ParadeProgram;
  natureFamilies?: NatureFamiliesProgram;
  carAssembly?: CarAssemblyProgram;
  catPattes?: CatPattesProgram;
  wonderMarket?: WonderMarketProgram;
  mamanRace?: MamanRaceProgram;
  cardCircles?: CardCirclesProgram;
  mineDomain?: MineDomainProgram;
  mnemosyne?: MnemosyneProgram;
  frousseRace?: FrousseRaceProgram;
  galoponsRace?: GaloponsRaceProgram;
  professionFamilies?: ProfessionFamiliesProgram;
  fouleesRace?: FouleesRaceProgram;
  galaxyRace?: GalaxyRaceProgram;
  gerard?: GerardProgram;
  rites?: RitesProgram;
  sac?: SacProgram;
  midnightRace?: MidnightRaceProgram;
  bananaTroops?: BananaTroopsProgram;
  balloonRace?: BalloonRaceProgram;
  voyage?: VoyageProgram;
  derapeRace?: DerapeRaceProgram;
  nawak?: NawakProgram;
  olympia?: OlympiaProgram;
  zigEtZag?: ZigEtZagProgram;
  pawnRace?: PawnRaceProgram;
  shortcuts?: readonly GameShortcutHint[];
  components: readonly Extract<
    GameComponentDefinition,
    {
      component:
        | 'cards.deck'
        | 'cards.hands'
        | 'cards.sets'
        | 'movement.track'
        | 'dice.set'
        | 'inventory.set'
        | 'ownership.registry'
        | 'pawn.set'
        | 'quiz.bank'
        | 'collection.view';
    }
  >[];
  setup: Pick<
    GameInitialization,
    | 'firstPlayer'
    | 'startRound'
    | 'scores'
    | 'resources'
    | 'counters'
    | 'tracks'
    | 'pawns'
    | 'deals'
    | 'gridPlacements'
  >;
  resourceIds: readonly string[];
  initialPhase: string;
  phases: Readonly<
    Record<
      string,
      {
        actions: readonly string[];
        terminal?: boolean;
        transitions?: readonly string[];
      }
    >
  >;
  actions: Readonly<Record<string, JsonGameAction>>;
  victory: JsonGameVictory;
};
