import type { GameContent } from '../../../engine/sdk/public-api';

const externalPath = '../../../engine/runtime/content/external-content-release';
type Loaded = { content: GameContent; exports: Record<string, unknown> };

function load(
  id: string,
  source: unknown,
  family = 'les-quatre-vents',
): Loaded {
  let result!: Loaded;
  jest.isolateModules(() => {
    jest.doMock(externalPath, () => ({
      loadExternalGameContent: (gameId: string) =>
        gameId === id && source !== null
          ? { source, version: 'test-release' }
          : null,
    }));
    const root = `../../../games/${family}/${id}`;
    const definition = jest.requireActual<{
      default: { content: GameContent };
    }>(`${root}/game`);
    result = {
      content: definition.default.content,
      exports: jest.requireActual<Record<string, unknown>>(`${root}/content`),
    };
  });
  return result;
}

afterEach(() => jest.dontMock(externalPath));

it('validates Dame Nature answer indices independently of displayed choices', () => {
  const id = 'dame-nature';
  const initial = load(id, null, 'vents-dansants');
  const payload = structuredClone(initial.content.data) as {
    cards: Array<{ type: string; choices?: string[]; answerIndex?: number }>;
  };
  const quiz = payload.cards.find((card) => card.type === 'quiz')!;
  quiz.choices = quiz.choices!.map(() => 'Même libellé');
  expect(load(id, payload, 'vents-dansants').content.data).toEqual(payload);
  quiz.answerIndex = quiz.choices.length;
  expect(() => load(id, payload, 'vents-dansants')).toThrow();
  quiz.answerIndex = -1;
  expect(() => load(id, payload, 'vents-dansants')).toThrow();
});

it('reloads every exported game payload through the authoring protocol', () => {
  type Registry = {
    GENERATED_GAME_DEFINITIONS: readonly { id: string; content: GameContent }[];
  };
  const payloads = new Map<string, unknown>();
  jest.isolateModules(() => {
    jest.doMock(externalPath, () => ({ loadExternalGameContent: () => null }));
    const registry = jest.requireActual<Registry>(
      '../../../composition/generated-game-registry',
    );
    for (const game of registry.GENERATED_GAME_DEFINITIONS)
      payloads.set(
        game.id,
        JSON.parse(JSON.stringify(game.content.data)) as unknown,
      );
  });
  expect(payloads.size).toBeGreaterThan(0);
  jest.isolateModules(() => {
    jest.doMock(externalPath, () => ({
      loadExternalGameContent: (id: string) => ({
        source: payloads.get(id),
        version: `release-${id}`,
      }),
    }));
    const registry = jest.requireActual<Registry>(
      '../../../composition/generated-game-registry',
    );
    for (const game of registry.GENERATED_GAME_DEFINITIONS) {
      expect(game.content.data).toEqual(payloads.get(game.id));
      const format = game.content.formatVersion ?? 1;
      expect(game.content.version).toBe(
        `release-${game.id}${format === 1 ? '' : `@format:${format}`}`,
      );
      expect(game.content.snapshotMigrations).toBeUndefined();
    }
  });
});

it.each([['olympia', 'vents-dansants', ['cards']]] as const)(
  'upgrades old exported sections for %s',
  (id, family, additions) => {
    const initial = load(id, null, family);
    const payload = { ...structuredClone(initial.content.data) };
    for (const section of additions) delete payload[section];
    expect(load(id, payload, family).content.data).toEqual(
      initial.content.data,
    );
  },
);

it('uses the released LAMA order when constructing a configured round', () => {
  const payload = structuredClone(
    load('lama', null, 'vents-sacres').content.data,
  );
  (payload.cards as unknown[]).reverse();
  const released = load('lama', payload, 'vents-sacres');
  const buildDeck = released.exports.buildLamaDeck as (
    copies: number,
  ) => unknown[];
  expect(buildDeck(1)).toEqual(['LAMA', 6, 5, 4, 3, 2, 1]);
  expect(() => buildDeck(21)).toThrow();
});

it('uses released Gerard names and effects in the rule catalogues', () => {
  const payload = structuredClone(
    load('gerard-president', null, 'vents-dansants').content.data,
  );
  const names = payload.names as Array<Record<string, unknown>>;
  names[0].name = 'Prénom de la release';
  const released = load('gerard-president', payload, 'vents-dansants');
  expect(released.exports.GERARD_PRESIDENT_NAME_CARDS).toEqual(names);
  expect(released.exports.GERARD_PRESIDENT_SPECIAL_CARDS).toEqual(
    payload.specialCards,
  );
});

it('rejects inconsistent category questions in a released Mnemosyne bank', () => {
  const payload = structuredClone(
    load('arche-de-mnemosyne', null, 'vents-infinis').content.data,
  );
  expect(
    load('arche-de-mnemosyne', payload, 'vents-infinis').content.data,
  ).toEqual(payload);
  const banks = payload.quizBanks as Array<{
    id: string;
    questions: Array<{ prompt: string }>;
  }>;
  banks.find((bank) => bank.id !== 'all')!.questions[0].prompt =
    'Question différente';
  expect(() => load('arche-de-mnemosyne', payload, 'vents-infinis')).toThrow();
});

it('uses the released Foulees board and rejects a safe tile outside the track', () => {
  const payload = structuredClone(
    load('foulees-fantastiques', null, 'vents-sacres').content.data,
  );
  const board = payload.board as {
    tiles: Array<{ label: string }>;
    safeTiles: number[];
    trackLength: number;
  };
  board.tiles[0].label = 'Départ de la release';
  const released = load('foulees-fantastiques', payload, 'vents-sacres');
  expect(released.exports.FOULEES_BOARD).toEqual(board);
  board.safeTiles.push(board.trackLength);
  expect(() => load('foulees-fantastiques', payload, 'vents-sacres')).toThrow();
});

it('loads market prices into the composed economy and rejects out-of-range prices', () => {
  const initial = load('le-marche-des-merveilles', null, 'vents-dansants');
  const payload = structuredClone(initial.content.data);
  const prices = payload.initialPrices as Record<string, number>;
  prices.gemmes = 9;
  const released = load('le-marche-des-merveilles', payload, 'vents-dansants');
  expect(released.exports.INITIAL_PRICES).toEqual(prices);
  expect(released.content.data).toEqual(payload);
  prices.gemmes = 11;
  expect(() =>
    load('le-marche-des-merveilles', payload, 'vents-dansants'),
  ).toThrow();
});

it('reloads parade cards and rejects a sequence that references a missing card', () => {
  const initial = load('la-parade-sucree', null, 'vents-dansants');
  const payload = structuredClone(initial.content.data);
  const cards = payload.cards as Array<Record<string, unknown>>;
  cards[0].name = 'Nouvelle carte';
  const released = load('la-parade-sucree', payload, 'vents-dansants');
  expect(released.exports.PARADE_CARDS).toEqual(cards);
  (payload.sequence as string[])[0] = 'absente';
  expect(() => load('la-parade-sucree', payload, 'vents-dansants')).toThrow();
});

it.each([
  ['cercles-sacres', 'CERCLES_SACRES'],
  ['la-bande-a-banane', 'BANDE_A_BANANE'],
  ['cat-pattes', 'CAT_PATTES'],
  ['les-mains-de-la-terre', 'LES_MAINS'],
  ['entre-rites-et-lumieres', 'ENTRE_RITES'],
  ['pimp-my-ride', 'PIMP_MY_RIDE'],
])('uses released cards in the deck and lookup for %s', (id, prefix) => {
  const initial = load(id, null, 'vents-dansants');
  const payload = JSON.parse(JSON.stringify(initial.content.data)) as {
    cards: Array<Record<string, unknown>>;
  };
  payload.cards[0].name = 'Carte de la release';
  const released = load(id, payload, 'vents-dansants');
  expect(released.content.data).toEqual(payload);
  expect(released.exports[`${prefix}_DECK`]).toEqual(payload.cards);
  const lookup = released.exports[`${prefix}_CARD_BY_ID`] as Record<
    string,
    unknown
  >;
  expect(lookup[payload.cards[0].id as string]).toEqual(payload.cards[0]);
  expect(Object.isFrozen(lookup)).toBe(true);
  payload.cards[1].id = payload.cards[0].id;
  expect(() => load(id, payload, 'vents-dansants')).toThrow();
});

it.each([
  ['mon-village-mon-histoire', 'VILLAGE_TILES'],
  ['tout-pres-de-maman', 'MAMAN_CONTENT'],
  ['pirates-en-vadrouille', 'PIRATES_CONTENT'],
  ['mission-galaxie', 'MISSION_GALAXIE_CONTENT'],
  ['voyage-en-terre-de-brumes', 'VOYAGE_CONTENT'],
])(
  'reloads the exported canonical payload for %s and uses it in the rules catalogue',
  (id, name) => {
    const initial = load(id, null);
    const exported = JSON.parse(JSON.stringify(initial.content.data)) as Record<
      string,
      unknown
    >;
    const tiles = exported.tiles as Array<Record<string, unknown>>;
    tiles[0].title = 'Titre de la release';
    const released = load(id, exported);
    expect(released.content.data).toEqual(exported);
    expect(released.content.version).toBe(
      `test-release${released.content.formatVersion === 1 ? '' : `@format:${released.content.formatVersion}`}`,
    );
    const catalogue = name.endsWith('_CONTENT')
      ? (released.exports[name] as Record<string, unknown>).tiles
      : released.exports[name];
    expect(catalogue).toEqual(tiles);
  },
);

it('loads the released mine catalogue including nullable scores', () => {
  const id = 'la-grande-mine-de-barbak';
  const payload = structuredClone(
    load(id, null, 'vents-dansants').content.data,
  );
  const cards = payload.cards as Array<Record<string, unknown>>;
  cards[0].points = null;
  const released = load(id, payload, 'vents-dansants');
  expect(released.exports.LA_GRANDE_MINE_CARDS).toEqual(cards);
  cards[0].effects = [{ kind: 'custom', effectId: 'unknown' }];
  expect(() => load(id, payload, 'vents-dansants')).toThrow();
});

it('rejects executable content with an unknown custom effect before game compilation succeeds', () => {
  const initial = load('tout-pres-de-maman', null);
  const payload = structuredClone(initial.content.data);
  const cards = payload.cards as Array<Record<string, unknown>>;
  cards[0].effects = [{ kind: 'custom', effectId: 'not-declared' }];
  expect(() => load('tout-pres-de-maman', payload)).toThrow('effet inconnu');
});

it('rejects the old section-based Panier release instead of synthesizing missing rules', () => {
  jest.isolateModules(() => {
    jest.doMock(externalPath, () => ({ loadExternalGameContent: () => null }));
    const { compileJsonGame } = jest.requireActual<
      typeof import('../../../engine/json/public-api')
    >('../../../engine/json/public-api');
    const manifest = jest.requireActual(
      '../../../games/les-quatre-vents/panier-express/manifest.json',
    );
    expect(() =>
      compileJsonGame(manifest, { courses: [], stands: [] }),
    ).toThrow();
  });
});
