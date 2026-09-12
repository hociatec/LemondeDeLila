import { jsonBalloonRaceSchema } from '../definitions/json-balloon-race-schema';
import { jsonBananaTroopsSchema } from '../definitions/json-banana-troops-schema';
import { jsonBoardSchema } from '../definitions/json-board-schema';
import { jsonCarAssemblySchema } from '../definitions/json-car-assembly-schema';
import { jsonCardCirclesSchema } from '../definitions/json-card-circles-schema';
import { jsonCatPattesSchema } from '../definitions/json-cat-pattes-schema';
import { jsonCollectionRaceSchema } from '../definitions/json-collection-race-schema';
import { jsonContesSchema } from '../definitions/json-contes-schema';
import { jsonCorridorSchema } from '../definitions/json-corridor-schema';
import { jsonDeliveryRaceSchema } from '../definitions/json-delivery-race-schema';
import { jsonDerapeRaceSchema } from '../definitions/json-derape-race-schema';
import { jsonEcosystemRaceSchema } from '../definitions/json-ecosystem-race-schema';
import { jsonEventRaceSchema } from '../definitions/json-event-race-schema';
import { jsonFouleesRaceSchema } from '../definitions/json-foulees-race-schema';
import { jsonFrousseRaceSchema } from '../definitions/json-frousse-race-schema';
import { jsonGalaxyRaceSchema } from '../definitions/json-galaxy-race-schema';
import { jsonGaloponsRaceSchema } from '../definitions/json-galopons-race-schema';
import { jsonGerardSchema } from '../definitions/json-gerard-schema';
import { jsonGooseRaceSchema } from '../definitions/json-goose-race-schema';
import { jsonGridSchema } from '../definitions/json-grid-schema';
import { jsonJudgedCardsSchema } from '../definitions/json-judged-cards-schema';
import { jsonLamaSchema } from '../definitions/json-lama-schema';
import { jsonMamanRaceSchema } from '../definitions/json-maman-race-schema';
import { jsonMidnightRaceSchema } from '../definitions/json-midnight-race-schema';
import { jsonMineDomainSchema } from '../definitions/json-mine-domain-schema';
import { jsonMnemosyneSchema } from '../definitions/json-mnemosyne-schema';
import { jsonNatureFamiliesSchema } from '../definitions/json-nature-families-schema';
import { jsonNawakSchema } from '../definitions/json-nawak-schema';
import { jsonOlympiaSchema } from '../definitions/json-olympia-schema';
import { jsonParadeSchema } from '../definitions/json-parade-schema';
import { jsonPawnRaceSchema } from '../definitions/json-pawn-race-schema';
import { jsonPirateRaceSchema } from '../definitions/json-pirate-race-schema';
import { jsonProfessionFamiliesSchema } from '../definitions/json-profession-families-schema';
import { jsonRitesSchema } from '../definitions/json-rites-schema';
import { jsonSacSchema } from '../definitions/json-sac-schema';
import { jsonVoyageSchema } from '../definitions/json-voyage-schema';
import { jsonWonderMarketSchema } from '../definitions/json-wonder-market-schema';
import { jsonZigEtZagSchema } from '../definitions/json-zig-et-zag-schema';

/** Closed schema registry for exceptional authoring profiles. */
export const jsonProgramExtensionSchemas = Object.freeze({
  board: jsonBoardSchema,
  grid: jsonGridSchema,
  judgedCards: jsonJudgedCardsSchema,
  eventRace: jsonEventRaceSchema,
  deliveryRace: jsonDeliveryRaceSchema,
  gooseRace: jsonGooseRaceSchema,
  collectionRace: jsonCollectionRaceSchema,
  corridor: jsonCorridorSchema,
  contes: jsonContesSchema,
  lama: jsonLamaSchema,
  ecosystemRace: jsonEcosystemRaceSchema,
  pirateRace: jsonPirateRaceSchema,
  parade: jsonParadeSchema,
  natureFamilies: jsonNatureFamiliesSchema,
  carAssembly: jsonCarAssemblySchema,
  catPattes: jsonCatPattesSchema,
  wonderMarket: jsonWonderMarketSchema,
  mamanRace: jsonMamanRaceSchema,
  cardCircles: jsonCardCirclesSchema,
  mineDomain: jsonMineDomainSchema,
  mnemosyne: jsonMnemosyneSchema,
  frousseRace: jsonFrousseRaceSchema,
  galoponsRace: jsonGaloponsRaceSchema,
  professionFamilies: jsonProfessionFamiliesSchema,
  fouleesRace: jsonFouleesRaceSchema,
  galaxyRace: jsonGalaxyRaceSchema,
  gerard: jsonGerardSchema,
  rites: jsonRitesSchema,
  sac: jsonSacSchema,
  midnightRace: jsonMidnightRaceSchema,
  bananaTroops: jsonBananaTroopsSchema,
  balloonRace: jsonBalloonRaceSchema,
  voyage: jsonVoyageSchema,
  derapeRace: jsonDerapeRaceSchema,
  nawak: jsonNawakSchema,
  olympia: jsonOlympiaSchema,
  zigEtZag: jsonZigEtZagSchema,
  pawnRace: jsonPawnRaceSchema,
});
