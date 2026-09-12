import { pawnRaceRules } from '../recipes/gameplay/pawn-race.recipes';
import { boardTurnRules } from '../recipes/gameplay/board-turn.recipes';
import { gridPlacementRules } from '../recipes/gameplay/grid-placement.recipes';
import { judgedCardsRules } from '../recipes/gameplay/judged-cards.recipes';
import { eventRaceRules } from '../recipes/gameplay/event-race.recipes';
import { deliveryRaceRules } from '../recipes/gameplay/delivery-race.recipes';
import { gooseRaceRules } from '../recipes/gameplay/goose-race.recipes';
import { collectionRaceRules } from '../recipes/gameplay/collection-race.recipes';
import { ecosystemRaceRules } from '../recipes/gameplay/ecosystem-race.recipes';
import { pirateRaceRules } from '../recipes/gameplay/pirate-race.recipes';
import { paradeRules } from '../recipes/gameplay/parade.recipes';
import { natureFamiliesRules } from '../recipes/gameplay/nature-families.recipes';
import { carAssemblyRules } from '../recipes/gameplay/car-assembly.recipes';
import { catPattesRules } from '../recipes/gameplay/cat-pattes.recipes';
import { wonderMarketRules } from '../recipes/gameplay/wonder-market.recipes';
import { mamanRaceRules } from '../recipes/gameplay/maman-race.recipes';
import { cardCirclesRules } from '../recipes/gameplay/card-circles.recipes';
import { mineDomainRules } from '../recipes/gameplay/mine-domain.recipes';
import { frousseRaceRules } from '../recipes/gameplay/frousse-race.recipes';
import { galoponsRaceRules } from '../recipes/gameplay/galopons-race.recipes';
import { professionFamiliesRules } from '../recipes/gameplay/profession-families.recipes';
import { fouleesRaceRules } from '../recipes/gameplay/foulees-race.recipes';
import { galaxyRaceRules } from '../recipes/gameplay/galaxy-race.recipes';
import { midnightRaceRules } from '../recipes/gameplay/midnight-race.recipes';
import { bananaTroopsRules } from '../recipes/gameplay/banana-troops.recipes';
import { balloonRaceRules } from '../recipes/gameplay/balloon-race.recipes';
import { voyageRules } from '../recipes/gameplay/voyage.recipes';
import { derapeRaceRules } from '../recipes/gameplay/derape-race.recipes';
import { nawakRules } from '../recipes/gameplay/nawak.recipes';
import { olympiaRules } from '../recipes/gameplay/olympia.recipes';
import { mnemosyneRules } from '../recipes/gameplay/mnemosyne.recipes';
import { corridorRules } from '../recipes/gameplay/corridor.recipes';
import { contesRules } from '../recipes/gameplay/contes.recipes';
import { lamaRules } from '../recipes/gameplay/lama.recipes';
import { zigEtZagRules } from '../recipes/gameplay/zig-et-zag.recipes';
import { gerardRules } from '../recipes/gameplay/gerard.recipes';
import { ritesRules } from '../recipes/gameplay/rites.recipes';
import { sacRules } from '../recipes/gameplay/sac.recipes';
import { compileJsonPattern } from './json-game-patterns';
import type { JsonGameDocument } from './json-game-schema';

export function compileJsonPrograms(document: JsonGameDocument) {
  const table = compileTablePrograms(document);
  return {
    ...compileRacePrograms(document),
    ...table,
    patterns: [
      ...(document.patterns?.map(compileJsonPattern) ?? []),
      ...(table.grid ? [table.grid.pattern] : []),
      ...(table.judged ? [table.judged.pattern] : []),
      ...(table.mnemosyne?.patterns ?? []),
      ...(table.corridor?.patterns ?? []),
      ...(table.contes?.patterns ?? []),
      ...(table.lama?.patterns ?? []),
      ...(table.catPattes?.patterns ?? []),
      ...(table.gerard?.patterns ?? []),
      ...(table.rites?.patterns ?? []),
      ...(table.sac?.patterns ?? []),
    ],
  };
}

function compileRacePrograms(document: JsonGameDocument) {
  return {
    pawnRace: document.pawnRace ? pawnRaceRules(document.pawnRace) : null,
    eventRace: document.eventRace ? eventRaceRules(document.eventRace) : null,
    deliveryRace: document.deliveryRace
      ? deliveryRaceRules(document.deliveryRace)
      : null,
    gooseRace: document.gooseRace ? gooseRaceRules(document.gooseRace) : null,
    collectionRace: document.collectionRace
      ? collectionRaceRules(document.collectionRace)
      : null,
    ecosystemRace: document.ecosystemRace
      ? ecosystemRaceRules(document.ecosystemRace)
      : null,
    pirateRace: document.pirateRace
      ? pirateRaceRules(document.pirateRace)
      : null,
    mamanRace: document.mamanRace ? mamanRaceRules(document.mamanRace) : null,
    frousseRace: document.frousseRace
      ? frousseRaceRules(document.frousseRace)
      : null,
    galoponsRace: document.galoponsRace
      ? galoponsRaceRules(document.galoponsRace)
      : null,
    fouleesRace: document.fouleesRace
      ? fouleesRaceRules(document.fouleesRace)
      : null,
    galaxyRace: document.galaxyRace
      ? galaxyRaceRules(document.galaxyRace)
      : null,
    midnightRace: document.midnightRace
      ? midnightRaceRules(document.midnightRace)
      : null,
    balloonRace: document.balloonRace
      ? balloonRaceRules(document.balloonRace)
      : null,
    voyage: document.voyage ? voyageRules(document.voyage) : null,
    derapeRace: document.derapeRace
      ? derapeRaceRules(document.derapeRace)
      : null,
  };
}

function compileTablePrograms(document: JsonGameDocument) {
  return {
    grid: document.grid ? gridPlacementRules(document.grid) : null,
    judged: document.judgedCards
      ? judgedCardsRules(document.judgedCards)
      : null,
    board: document.board ? boardTurnRules(document.board) : null,
    parade: document.parade ? paradeRules(document.parade) : null,
    natureFamilies: document.natureFamilies
      ? natureFamiliesRules(document.natureFamilies)
      : null,
    carAssembly: document.carAssembly
      ? carAssemblyRules(document.carAssembly)
      : null,
    catPattes: document.catPattes ? catPattesRules(document.catPattes) : null,
    gerard: document.gerard ? gerardRules(document.gerard) : null,
    rites: document.rites ? ritesRules(document.rites) : null,
    sac: document.sac ? sacRules(document.sac) : null,
    wonderMarket: document.wonderMarket
      ? wonderMarketRules(document.wonderMarket)
      : null,
    cardCircles: document.cardCircles
      ? cardCirclesRules(document.cardCircles)
      : null,
    mineDomain: document.mineDomain
      ? mineDomainRules(document.mineDomain)
      : null,
    professionFamilies: document.professionFamilies
      ? professionFamiliesRules(document.professionFamilies)
      : null,
    bananaTroops: document.bananaTroops
      ? bananaTroopsRules(document.bananaTroops)
      : null,
    nawak: document.nawak ? nawakRules(document.nawak) : null,
    olympia: document.olympia ? olympiaRules(document.olympia) : null,
    mnemosyne: document.mnemosyne ? mnemosyneRules(document.mnemosyne) : null,
    corridor: document.corridor ? corridorRules(document.corridor) : null,
    contes: document.contes ? contesRules(document.contes) : null,
    lama: document.lama ? lamaRules(document.lama) : null,
    zigEtZag: document.zigEtZag ? zigEtZagRules(document.zigEtZag) : null,
  };
}

export type CompiledJsonPrograms = ReturnType<typeof compileJsonPrograms>;
