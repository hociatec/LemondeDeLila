import { compileJsonGame } from '../../../engine/json/public-api';
import type { GameContent } from '../../../engine/sdk/public-api';
import {
  GENERATED_GAME_DEFINITIONS,
  GENERATED_GAME_PACKAGES,
} from '../../../composition/generated-game-registry';

const externalPath = '../../../engine/runtime/content/external-content-release';
type Definition = { id: string; content: GameContent };
type Loaded = { content: GameContent; exports: Record<string, unknown> };

function _legacyLoad(id: string, source: unknown, family: string): Loaded {
  let result!: Loaded;
  jest.isolateModules(() => {
    jest.doMock(externalPath, () => ({
      loadExternalGameContent: (gameId: string) =>
        gameId === id && source !== null
          ? { source, version: 'test-release' }
          : null,
    }));
    const root = `../../../games/${family}/${id}`;
    const definition = jest.requireActual<{ default: Definition }>(
      `${root}/game.ts`,
    );
    result = {
      content: definition.default.content,
      exports: jest.requireActual<Record<string, unknown>>(`${root}/content`),
    };
  });
  return result;
}

function jsonDefinition(id: string): Definition {
  const definition = GENERATED_GAME_DEFINITIONS.find(
    (candidate) => (candidate as Definition).id === id,
  ) as Definition | undefined;
  if (!definition) throw new Error(`Unknown game ${id}`);
  return definition;
}

function recompileJson(id: string, source: unknown): Definition {
  const entry = GENERATED_GAME_PACKAGES.find(
    (candidate) => (candidate.manifest as { code?: string }).code === id,
  );
  if (!entry) throw new Error(`Unknown game package ${id}`);
  return compileJsonGame(
    entry.manifest as Parameters<typeof compileJsonGame>[0],
    source,
  );
}

afterEach(() => jest.dontMock(externalPath));

it('round-trips every canonical JSON payload through the authoring protocol', () => {
  const games = (GENERATED_GAME_DEFINITIONS as readonly Definition[]).filter(
    (game) =>
      (game.content.data as { schemaVersion?: number }).schemaVersion === 1,
  );
  expect(games).toHaveLength(39);
  for (const game of games) {
    const payload = JSON.parse(JSON.stringify(game.content.data)) as unknown;
    const compiled = recompileJson(game.id, payload);
    expect(compiled.content.data).toEqual(payload);
    expect(compiled.content.version).toBe(game.content.version);
  }
});

it('validates Dame Nature answer indices independently of labels', () => {
  const payload = structuredClone(
    jsonDefinition('dame-nature').content.data,
  ) as {
    natureFamilies: {
      cards: Array<{ type: string; choices?: string[]; answerIndex?: number }>;
    };
  };
  const quiz = payload.natureFamilies.cards.find(
    (card) => card.type === 'quiz',
  )!;
  quiz.choices = quiz.choices!.map(() => 'Même libellé');
  expect(recompileJson('dame-nature', payload).content.data).toEqual(payload);
  quiz.answerIndex = quiz.choices.length;
  expect(() => recompileJson('dame-nature', payload)).toThrow();
});

it('rejects invalid references and effects in canonical JSON catalogues', () => {
  const parade = structuredClone(
    jsonDefinition('la-parade-sucree').content.data,
  ) as { parade: { sequence: string[] } };
  parade.parade.sequence[0] = 'absente';
  expect(() => recompileJson('la-parade-sucree', parade)).toThrow();

  const foulees = structuredClone(
    jsonDefinition('foulees-fantastiques').content.data,
  ) as { fouleesRace: { safeTiles: number[]; trackLength: number } };
  foulees.fouleesRace.safeTiles.push(foulees.fouleesRace.trackLength);
  expect(() => recompileJson('foulees-fantastiques', foulees)).toThrow();

  const maman = structuredClone(
    jsonDefinition('tout-pres-de-maman').content.data,
  ) as { mamanRace: { cards: Array<{ effects: unknown[] }> } };
  maman.mamanRace.cards[0].effects = [
    { kind: 'custom', effectId: 'not-declared' },
  ];
  expect(() => recompileJson('tout-pres-de-maman', maman)).toThrow(
    'effet inconnu',
  );
});

it('accepts nullable mine scores and rejects duplicate card identifiers', () => {
  const payload = structuredClone(
    jsonDefinition('la-grande-mine-de-barbak').content.data,
  ) as { mineDomain: { cards: Array<{ id: string; points: number | null }> } };
  payload.mineDomain.cards[0].points = null;
  expect(
    recompileJson('la-grande-mine-de-barbak', payload).content.data,
  ).toEqual(payload);
  payload.mineDomain.cards[1].id = payload.mineDomain.cards[0].id;
  expect(() => recompileJson('la-grande-mine-de-barbak', payload)).toThrow();
});

it('uses the released LAMA order in a configured round', () => {
  const payload = structuredClone(jsonDefinition('lama').content.data) as {
    lama: { cards: unknown[] };
  };
  payload.lama.cards.reverse();
  expect(recompileJson('lama', payload).content.data).toEqual(payload);
  payload.lama.cards.push('LAMA');
  expect(() => recompileJson('lama', payload)).toThrow();
});

it('uses released Gerard names and effects in rule catalogues', () => {
  const payload = structuredClone(
    jsonDefinition('gerard-president').content.data,
  ) as {
    gerard: {
      names: Array<Record<string, unknown>>;
      specialCards: Array<Record<string, unknown>>;
    };
  };
  const names = payload.gerard.names;
  names[0].name = 'Prénom de la release';
  expect(recompileJson('gerard-president', payload).content.data).toEqual(
    payload,
  );
  payload.gerard.specialCards[1].id = payload.gerard.specialCards[0].id;
  expect(() => recompileJson('gerard-president', payload)).toThrow();
});

it('rejects Mnemosyne questions in an unknown category', () => {
  const payload = structuredClone(
    jsonDefinition('arche-de-mnemosyne').content.data,
  ) as {
    mnemosyne: {
      questions: Array<{ status: string; categoryId: string }>;
    };
  };
  const question = payload.mnemosyne.questions.find(
    (candidate) => candidate.status === 'validated',
  )!;
  question.categoryId = 'absente';
  expect(() => recompileJson('arche-de-mnemosyne', payload)).toThrow();
});

it('uses released Entre Rites cards from the JSON program', () => {
  const payload = structuredClone(
    jsonDefinition('entre-rites-et-lumieres').content.data,
  ) as {
    rites: { cards: Array<Record<string, unknown>> };
  };
  payload.rites.cards[0].name = 'Carte de la release';
  expect(
    recompileJson('entre-rites-et-lumieres', payload).content.data,
  ).toEqual(payload);
  payload.rites.cards[1].id = payload.rites.cards[0].id;
  expect(() => recompileJson('entre-rites-et-lumieres', payload)).toThrow();
});

it('uses released Cat Pattes cards from the JSON program', () => {
  const payload = structuredClone(
    jsonDefinition('cat-pattes').content.data,
  ) as {
    catPattes: { cards: Array<Record<string, unknown>> };
  };
  payload.catPattes.cards[0].name = 'Carte de la release';
  expect(recompileJson('cat-pattes', payload).content.data).toEqual(payload);
  payload.catPattes.cards[1].id = payload.catPattes.cards[0].id;
  expect(() => recompileJson('cat-pattes', payload)).toThrow();
});

it('reloads the released Voyage payload into its rules catalogue', () => {
  const initial = jsonDefinition('voyage-en-terre-de-brumes');
  const payload = structuredClone(initial.content.data) as {
    voyage: { tiles: Array<{ title: string }> };
  };
  payload.voyage.tiles[0].title = 'Titre de la release';
  const released = recompileJson('voyage-en-terre-de-brumes', payload);
  expect(released.content.data).toEqual(payload);
});

it('rejects the old section-based Panier release', () => {
  const manifest = jest.requireActual(
    '../../../games/les-quatre-vents/panier-express/manifest.json',
  );
  expect(() =>
    compileJsonGame(manifest, { courses: [], stands: [] }),
  ).toThrow();
});
