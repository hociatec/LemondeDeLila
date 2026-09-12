import type { BalloonRaceProgram } from './balloon-race/program';
import type { BananaTroopsProgram } from './banana-troops/program';
import type { BoardGameProgram } from './board-game/program';
import type { CarAssemblyProgram } from './car-assembly/program';
import type { CardCirclesProgram } from './card-circles/program';
import type { CatPattesProgram } from './cat-pattes/program';
import type { CollectionRaceProgram } from './collection-race/program';
import type { ContesProgram } from './contes/program';
import type { CorridorProgram } from './corridor/program';
import type { DeliveryRaceProgram } from './delivery-race/program';
import type { DerapeRaceProgram } from './derape-race/program';
import type { EcosystemRaceProgram } from './ecosystem-race/program';
import type { EventRaceProgram } from './event-race/program';
import type { FouleesRaceProgram } from './foulees-race/program';
import type { FrousseRaceProgram } from './frousse-race/program';
import type { GalaxyRaceProgram } from './galaxy-race/program';
import type { GaloponsRaceProgram } from './galopons-race/program';
import type { GerardProgram } from './gerard/program';
import type { GooseRaceProgram } from './goose-race/program';
import type { GridPlacementProgram } from './grid-placement/program';
import type { JudgedCardsProgram } from './judged-cards/program';
import type { LamaProgram } from './lama/program';
import type { MamanRaceProgram } from './maman-race/program';
import type { MidnightRaceProgram } from './midnight-race/program';
import type { MineDomainProgram } from './mine-domain/program';
import type { MnemosyneProgram } from './mnemosyne/program';
import type { NatureFamiliesProgram } from './nature-families/program';
import type { NawakProgram } from './nawak/program';
import type { OlympiaProgram } from './olympia/program';
import type { ParadeProgram } from './parade/program';
import type { PawnRaceProgram } from './pawn-race/program';
import type { PirateRaceProgram } from './pirate-race/program';
import type { ProfessionFamiliesProgram } from './profession-families/program';
import type { RitesProgram } from './rites/program';
import type { SacProgram } from './sac/program';
import type { VoyageProgram } from './voyage/program';
import type { WonderMarketProgram } from './wonder-market/program';
import type { ZigEtZagProgram } from './zig-et-zag/program';

/**
 * Closed catalog of exceptional JSON authoring profiles.
 *
 * The core document depends on this single boundary. Adding a game that composes
 * existing components, effects, patterns and recipes never changes this map.
 */
export type JsonProgramExtensions = {
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
};
