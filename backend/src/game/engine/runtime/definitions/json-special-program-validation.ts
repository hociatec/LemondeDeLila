import type { JsonGameDocument } from './json-game-schema';
import type { GamePattern } from '../contracts/pattern-definition';
import { assertParadeReferences } from './json-parade-schema';
import { assertNatureFamiliesReferences } from './json-nature-families-schema';
import { assertCarAssemblyReferences } from './json-car-assembly-schema';
import { assertCatPattesReferences } from './json-cat-pattes-schema';
import { assertWonderMarketReferences } from './json-wonder-market-schema';
import { assertMamanRaceReferences } from './json-maman-race-schema';
import { assertCardCirclesReferences } from './json-card-circles-schema';
import { assertMineDomainReferences } from './json-mine-domain-schema';
import { assertFrousseRaceReferences } from './json-frousse-race-schema';
import { assertGaloponsRaceReferences } from './json-galopons-race-schema';
import { assertProfessionFamiliesReferences } from './json-profession-families-schema';
import { assertFouleesRaceReferences } from './json-foulees-race-schema';
import { assertGalaxyRaceReferences } from './json-galaxy-race-schema';
import { assertMidnightRaceReferences } from './json-midnight-race-schema';
import { assertBananaTroopsReferences } from './json-banana-troops-schema';
import { assertBalloonRaceReferences } from './json-balloon-race-schema';
import { assertVoyageReferences } from './json-voyage-schema';
import { assertDerapeRaceReferences } from './json-derape-race-schema';
import { assertNawakReferences } from './json-nawak-schema';
import { assertOlympiaReferences } from './json-olympia-schema';
import { assertMnemosyneReferences } from './json-mnemosyne-schema';
import { assertCorridorReferences } from './json-corridor-schema';
import { assertContesReferences } from './json-contes-schema';
import { assertLamaReferences } from './json-lama-schema';
import { assertZigEtZagReferences } from './json-zig-et-zag-schema';
import { assertGerardReferences } from './json-gerard-schema';
import { assertRitesReferences } from './json-rites-schema';
import { assertSacReferences } from './json-sac-schema';

type Failure = (path: string, reason: string) => never;

export function assertJsonSpecialPrograms(
  document: JsonGameDocument,
  patterns: readonly GamePattern<Record<string, never>>[] | undefined,
  fail: Failure,
): void {
  const components = [
    ...document.components,
    ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
  ];
  const resources = new Set([
    ...document.resourceIds,
    ...(patterns ?? []).flatMap((pattern) => pattern.resourceIds ?? []),
  ]);
  const counters = new Set([
    ...Object.keys(document.setup.counters ?? {}),
    ...(patterns ?? []).flatMap((pattern) =>
      Object.keys(pattern.initialization?.counters ?? {}),
    ),
  ]);
  const assertCardPrograms = () => {
    if ((document.victory.kind === 'by-parade') !== Boolean(document.parade))
      fail('victory', 'parade program and victory required together');
    if (document.parade)
      assertParadeReferences(document.parade, components, resources);
    if (
      (document.victory.kind === 'by-nature-families') !==
      Boolean(document.natureFamilies)
    )
      fail('victory', 'nature families program and victory required together');
    if (document.natureFamilies)
      assertNatureFamiliesReferences(
        document.natureFamilies,
        components,
        counters,
      );
    if (
      (document.victory.kind === 'by-car-assembly') !==
      Boolean(document.carAssembly)
    )
      fail('victory', 'car assembly program and victory required together');
    if (document.carAssembly)
      assertCarAssemblyReferences(
        document.carAssembly,
        components,
        resources,
        counters,
      );
    if (
      (document.victory.kind === 'by-cat-pattes') !==
      Boolean(document.catPattes)
    )
      fail('victory', 'Cat Pattes program and victory required together');
    if (document.catPattes) assertCatPattesReferences(document.catPattes);
    if (
      (document.victory.kind === 'by-wonder-market') !==
      Boolean(document.wonderMarket)
    )
      fail('victory', 'wonder market program and victory required together');
    if (document.wonderMarket)
      assertWonderMarketReferences(
        document.wonderMarket,
        components,
        resources,
        counters,
      );
    if (
      (document.victory.kind === 'by-maman-race') !==
      Boolean(document.mamanRace)
    )
      fail('victory', 'maman race program and victory required together');
    if (document.mamanRace)
      assertMamanRaceReferences(document.mamanRace, components, resources);
    if (
      (document.victory.kind === 'by-card-circles') !==
      Boolean(document.cardCircles)
    )
      fail('victory', 'card circles program and victory required together');
    if (document.cardCircles)
      assertCardCirclesReferences(document.cardCircles, components);
  };
  const assertRacePrograms = () => {
    if (
      (document.victory.kind === 'by-mine-domain') !==
      Boolean(document.mineDomain)
    )
      fail('victory', 'mine domain program and victory required together');
    if (document.mineDomain)
      assertMineDomainReferences(document.mineDomain, components);
    if (
      (document.victory.kind === 'by-frousse-race') !==
      Boolean(document.frousseRace)
    )
      fail('victory', 'frousse race program and victory required together');
    if (document.frousseRace)
      assertFrousseRaceReferences(document.frousseRace, components);
    if (
      (document.victory.kind === 'by-galopons-race') !==
      Boolean(document.galoponsRace)
    )
      fail('victory', 'galopons race program and victory required together');
    if (document.galoponsRace)
      assertGaloponsRaceReferences(
        document.galoponsRace,
        components,
        resources,
      );
    if (
      (document.victory.kind === 'by-profession-families') !==
      Boolean(document.professionFamilies)
    )
      fail(
        'victory',
        'profession families program and victory required together',
      );
    if (document.professionFamilies)
      assertProfessionFamiliesReferences(
        document.professionFamilies,
        components,
        resources,
      );
    if (
      (document.victory.kind === 'by-foulees-race') !==
      Boolean(document.fouleesRace)
    )
      fail('victory', 'foulees race program and victory required together');
    if (document.fouleesRace)
      assertFouleesRaceReferences(document.fouleesRace, components);
    if (
      (document.victory.kind === 'by-galaxy-race') !==
      Boolean(document.galaxyRace)
    )
      fail('victory', 'galaxy race program and victory required together');
    if (document.galaxyRace)
      assertGalaxyRaceReferences(document.galaxyRace, components);
    if (
      (document.victory.kind === 'by-midnight-race') !==
      Boolean(document.midnightRace)
    )
      fail('victory', 'midnight race program and victory required together');
    if (document.midnightRace)
      assertMidnightRaceReferences(document.midnightRace, components);
    if (
      (document.victory.kind === 'by-banana-troops') !==
      Boolean(document.bananaTroops)
    )
      fail('victory', 'banana troops program and victory required together');
    if (document.bananaTroops)
      assertBananaTroopsReferences(document.bananaTroops, components);
  };
  const assertRemainingPrograms = () => {
    if (
      (document.victory.kind === 'by-derape-race') !==
      Boolean(document.derapeRace)
    )
      fail('victory', 'derape race program and victory required together');
    if (document.derapeRace)
      assertDerapeRaceReferences(
        document.derapeRace,
        components,
        resources,
        counters,
      );
    if ((document.victory.kind === 'by-nawak') !== Boolean(document.nawak))
      fail('victory', 'nawak program and victory required together');
    if (document.nawak) assertNawakReferences(document.nawak);
    if ((document.victory.kind === 'by-olympia') !== Boolean(document.olympia))
      fail('victory', 'olympia program and victory required together');
    if (document.olympia) assertOlympiaReferences(document.olympia, components);
    if (
      (document.victory.kind === 'by-zig-et-zag') !==
      Boolean(document.zigEtZag)
    )
      fail('victory', 'Zig et Zag program and victory required together');
    if (document.zigEtZag) assertZigEtZagReferences(document.zigEtZag);
    if (
      (document.victory.kind === 'by-mnemosyne') !==
      Boolean(document.mnemosyne)
    )
      fail('victory', 'Mnemosyne program and victory required together');
    if (document.mnemosyne) assertMnemosyneReferences(document.mnemosyne);
    if (
      (document.victory.kind === 'by-corridor') !==
      Boolean(document.corridor)
    )
      fail('victory', 'Corridor program and victory required together');
    if (document.corridor) assertCorridorReferences(document.corridor);
    if ((document.victory.kind === 'by-contes') !== Boolean(document.contes))
      fail('victory', 'Contes program and victory required together');
    if (document.contes) assertContesReferences(document.contes);
    if ((document.victory.kind === 'by-lama') !== Boolean(document.lama))
      fail('victory', 'LAMA program and victory required together');
    if (document.lama) assertLamaReferences(document.lama);
    if (document.balloonRace)
      assertBalloonRaceReferences(document.balloonRace, components);
    if ((document.victory.kind === 'by-voyage') !== Boolean(document.voyage))
      fail('victory', 'Voyage program and victory required together');
    if (document.voyage) assertVoyageReferences(document.voyage, components);
    if ((document.victory.kind === 'by-gerard') !== Boolean(document.gerard))
      fail('victory', 'Gerard program and victory required together');
    if (document.gerard) assertGerardReferences(document.gerard);
    if ((document.victory.kind === 'by-rites') !== Boolean(document.rites))
      fail('victory', 'Entre Rites program and victory required together');
    if (document.rites) assertRitesReferences(document.rites);
    if ((document.victory.kind === 'by-sac') !== Boolean(document.sac))
      fail('victory', 'Sac program and victory required together');
    if (document.sac) assertSacReferences(document.sac);
  };
  assertCardPrograms();
  assertRacePrograms();
  assertRemainingPrograms();
}
