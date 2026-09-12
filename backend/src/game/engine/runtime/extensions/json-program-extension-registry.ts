import { extension as boardGameExtension } from './board-game/extension';
import { extension as gridPlacementExtension } from './grid-placement/extension';
import { extension as judgedCardsExtension } from './judged-cards/extension';
import { extension as eventRaceExtension } from './event-race/extension';
import { extension as deliveryRaceExtension } from './delivery-race/extension';
import { extension as gooseRaceExtension } from './goose-race/extension';
import { extension as collectionRaceExtension } from './collection-race/extension';
import { extension as corridorExtension } from './corridor/extension';
import { extension as contesExtension } from './contes/extension';
import { extension as lamaExtension } from './lama/extension';
import { extension as ecosystemRaceExtension } from './ecosystem-race/extension';
import { extension as pirateRaceExtension } from './pirate-race/extension';
import { extension as paradeExtension } from './parade/extension';
import { extension as natureFamiliesExtension } from './nature-families/extension';
import { extension as carAssemblyExtension } from './car-assembly/extension';
import { extension as catPattesExtension } from './cat-pattes/extension';
import { extension as wonderMarketExtension } from './wonder-market/extension';
import { extension as mamanRaceExtension } from './maman-race/extension';
import { extension as cardCirclesExtension } from './card-circles/extension';
import { extension as mineDomainExtension } from './mine-domain/extension';
import { extension as mnemosyneExtension } from './mnemosyne/extension';
import { extension as frousseRaceExtension } from './frousse-race/extension';
import { extension as galoponsRaceExtension } from './galopons-race/extension';
import { extension as professionFamiliesExtension } from './profession-families/extension';
import { extension as fouleesRaceExtension } from './foulees-race/extension';
import { extension as galaxyRaceExtension } from './galaxy-race/extension';
import { extension as gerardExtension } from './gerard/extension';
import { extension as ritesExtension } from './rites/extension';
import { extension as sacExtension } from './sac/extension';
import { extension as midnightRaceExtension } from './midnight-race/extension';
import { extension as bananaTroopsExtension } from './banana-troops/extension';
import { extension as balloonRaceExtension } from './balloon-race/extension';
import { extension as voyageExtension } from './voyage/extension';
import { extension as derapeRaceExtension } from './derape-race/extension';
import { extension as nawakExtension } from './nawak/extension';
import { extension as olympiaExtension } from './olympia/extension';
import { extension as zigEtZagExtension } from './zig-et-zag/extension';
import { extension as pawnRaceExtension } from './pawn-race/extension';

/** Deterministic composition root. No filesystem discovery occurs at runtime. */
export const jsonProgramExtensions = Object.freeze([
  pawnRaceExtension,
  eventRaceExtension,
  deliveryRaceExtension,
  gooseRaceExtension,
  collectionRaceExtension,
  ecosystemRaceExtension,
  pirateRaceExtension,
  paradeExtension,
  natureFamiliesExtension,
  carAssemblyExtension,
  wonderMarketExtension,
  mamanRaceExtension,
  cardCirclesExtension,
  mineDomainExtension,
  frousseRaceExtension,
  galoponsRaceExtension,
  professionFamiliesExtension,
  fouleesRaceExtension,
  galaxyRaceExtension,
  midnightRaceExtension,
  bananaTroopsExtension,
  derapeRaceExtension,
  balloonRaceExtension,
  voyageExtension,
  catPattesExtension,
  gerardExtension,
  ritesExtension,
  sacExtension,
  nawakExtension,
  olympiaExtension,
  zigEtZagExtension,
  mnemosyneExtension,
  corridorExtension,
  contesExtension,
  lamaExtension,
  judgedCardsExtension,
  gridPlacementExtension,
  boardGameExtension,
] as const);

export type RegisteredJsonProgramExtension =
  (typeof jsonProgramExtensions)[number];
