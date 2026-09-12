import { assertPawnRaceReferences } from './json-pawn-race-schema';
import { assertGridReferences } from './json-grid-schema';
import { assertJudgedCardsReferences } from './json-judged-cards-schema';
import { assertBoardReferences } from './json-board-schema';
import { assertJsonSpecialPrograms } from './json-special-program-validation';
import { assertJsonRacePrograms } from './json-race-program-validation';
import type { JsonGameManifest } from './json-game-manifest';
import type { JsonGameDocument } from './json-game-schema';
import type { compileJsonPattern } from './json-game-patterns';

type JsonFailure = (path: string, reason: string) => never;
type Patterns = ReturnType<typeof compileJsonPattern>[] | undefined;

export function assertProgramReferences(
  document: JsonGameDocument,
  patterns: Patterns,
  manifest: JsonGameManifest,
  fail: JsonFailure,
): void {
  if (document.board)
    assertBoardReferences(
      document.board,
      [
        ...document.components,
        ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
      ],
      document.phases,
      document.initialPhase,
    );
  if (document.grid)
    assertGridReferences(
      document.grid,
      document.components,
      manifest.maxPlayers,
      manifest.code,
    );
  assertExclusiveProgram(document, fail);
  assertJsonRacePrograms(document, patterns, manifest.maxPlayers, fail);
  assertJsonSpecialPrograms(document, patterns, fail);
  assertPawnAndGridReferences(document, patterns, manifest, fail);
  assertJudgedAndSetupReferences(document, manifest, fail);
}

function assertExclusiveProgram(
  document: JsonGameDocument,
  fail: JsonFailure,
): void {
  const programs = [
    document.grid,
    document.board,
    document.judgedCards,
    document.eventRace,
    document.deliveryRace,
    document.gooseRace,
    document.collectionRace,
    document.ecosystemRace,
    document.pirateRace,
    document.parade,
    document.natureFamilies,
    document.carAssembly,
    document.catPattes,
    document.contes,
    document.wonderMarket,
    document.mamanRace,
    document.cardCircles,
    document.mineDomain,
    document.frousseRace,
    document.galoponsRace,
    document.professionFamilies,
    document.fouleesRace,
    document.galaxyRace,
    document.midnightRace,
    document.bananaTroops,
    document.balloonRace,
    document.voyage,
    document.derapeRace,
    document.nawak,
    document.olympia,
    document.zigEtZag,
    document.mnemosyne,
    document.corridor,
    document.lama,
    document.pawnRace,
    document.gerard,
    document.rites,
    document.sac,
  ];
  if (programs.filter(Boolean).length > 1)
    fail('programs', 'one game program per definition');
}

function assertPawnAndGridReferences(
  document: JsonGameDocument,
  patterns: Patterns,
  manifest: JsonGameManifest,
  fail: JsonFailure,
): void {
  if ((document.victory.kind === 'by-pawn-race') !== Boolean(document.pawnRace))
    fail('victory', 'pawn race program and victory required together');
  if (document.pawnRace)
    assertPawnRaceReferences(
      document.pawnRace,
      [
        ...document.components,
        ...(patterns ?? []).flatMap((pattern) => pattern.components ?? []),
      ],
      manifest.maxPlayers,
      fail,
    );
  if ((document.victory.kind === 'by-grid') !== Boolean(document.grid))
    fail(
      'victory',
      'grid program and by-grid victory must be declared together',
    );
  if (document.grid?.pawnSelection && document.setup.startRound === false)
    fail('setup.startRound', 'grid pawn selection requires a starting round');
}

function assertJudgedAndSetupReferences(
  document: JsonGameDocument,
  manifest: JsonGameManifest,
  fail: JsonFailure,
): void {
  if (
    (document.victory.kind === 'by-judged-cards') !==
    Boolean(document.judgedCards)
  )
    fail(
      'victory',
      'judged card program and victory must be declared together',
    );
  if (document.judgedCards)
    assertJudgedCardsReferences(
      document.judgedCards,
      document.components,
      document.phases,
      document.initialPhase,
      manifest.minPlayers,
    );
  if (
    document.board &&
    (document.setup.firstPlayer !== undefined ||
      document.setup.startRound !== undefined)
  )
    fail('setup', 'board owns the starting player and round');
  if (document.victory.kind === 'by-board' && !document.board)
    fail('victory', 'board required');
}
