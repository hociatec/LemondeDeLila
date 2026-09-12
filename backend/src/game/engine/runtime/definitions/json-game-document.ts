import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type { GamePresentation } from '../contracts/author-rule-contracts';
import type { BananaTroopsProgram } from '../extensions/banana-troops/program';
import type { BalloonRaceProgram } from '../extensions/balloon-race/program';
import type { BoardGameProgram } from '../extensions/board-game/program';
import type { CarAssemblyProgram } from '../extensions/car-assembly/program';
import type { CatPattesProgram } from '../extensions/cat-pattes/program';
import type { CardCirclesProgram } from '../extensions/card-circles/program';
import type { CollectionRaceProgram } from '../extensions/collection-race/program';
import type { CorridorProgram } from '../extensions/corridor/program';
import type { ContesProgram } from '../extensions/contes/program';
import type { DeliveryRaceProgram } from '../extensions/delivery-race/program';
import type { DerapeRaceProgram } from '../extensions/derape-race/program';
import type { EcosystemRaceProgram } from '../extensions/ecosystem-race/program';
import type { EventRaceProgram } from '../extensions/event-race/program';
import type { FouleesRaceProgram } from '../extensions/foulees-race/program';
import type { FrousseRaceProgram } from '../extensions/frousse-race/program';
import type { GalaxyRaceProgram } from '../extensions/galaxy-race/program';
import type { GerardProgram } from '../extensions/gerard/program';
import type { RitesProgram } from '../extensions/rites/program';
import type { SacProgram } from '../extensions/sac/program';
import type { GaloponsRaceProgram } from '../extensions/galopons-race/program';
import type { GooseRaceProgram } from '../extensions/goose-race/program';
import type { JudgedCardsProgram } from '../extensions/judged-cards/program';
import type { LamaProgram } from '../extensions/lama/program';
import type { MamanRaceProgram } from '../extensions/maman-race/program';
import type { MidnightRaceProgram } from '../extensions/midnight-race/program';
import type { MineDomainProgram } from '../extensions/mine-domain/program';
import type { MnemosyneProgram } from '../extensions/mnemosyne/program';
import type { NatureFamiliesProgram } from '../extensions/nature-families/program';
import type { NawakProgram } from '../extensions/nawak/program';
import type { OlympiaProgram } from '../extensions/olympia/program';
import type { ParadeProgram } from '../extensions/parade/program';
import type { PawnRaceProgram } from '../extensions/pawn-race/program';
import type { PirateRaceProgram } from '../extensions/pirate-race/program';
import type { ProfessionFamiliesProgram } from '../extensions/profession-families/program';
import type { WonderMarketProgram } from '../extensions/wonder-market/program';
import type { VoyageProgram } from '../extensions/voyage/program';
import type { ZigEtZagProgram } from '../extensions/zig-et-zag/program';
import type { ContentSnapshotMigration } from '../content/game-content';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { JsonGameAction, JsonGameVictory } from './json-game-action-types';
import type { JsonGamePattern } from './json-game-patterns';
import type { GridPlacementProgram } from '../extensions/grid-placement/program';

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
