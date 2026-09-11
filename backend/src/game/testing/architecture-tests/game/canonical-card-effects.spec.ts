const catalogues = [
  {
    game: 'les-quatre-vents/contes-et-cacahuetes',
    asset: 'content-data.json',
    path: ['decks', 'bonus'],
  },
  {
    game: 'vents-dansants/la-grande-mine-de-barbak',
    asset: 'content-data.json',
    path: ['cards'],
  },
  {
    game: 'les-quatre-vents/frousse-party',
    asset: 'catalogue.json',
    path: ['cards'],
  },
  {
    game: 'vents-dansants/les-mains-de-la-terre',
    asset: 'catalogue.json',
    path: ['cards'],
  },
  {
    game: 'les-quatre-vents/en-attendant-minuit',
    asset: 'catalogue.json',
    path: ['cards'],
  },
  {
    game: 'les-quatre-vents/a-fond-les-ballons',
    asset: 'catalogue.json',
    path: ['cards'],
  },
  {
    game: 'les-quatre-vents/galopons-ensemble',
    asset: 'catalogue.json',
    path: ['cards'],
  },
  {
    game: 'les-quatre-vents/ca-derape',
    asset: 'catalogue.json',
    path: ['cards'],
  },
];

describe.each(catalogues)(
  '$game canonical card instructions',
  ({ game, asset, path }) => {
    const assetPath = `../../../games/${game}/${asset}`;
    const contentPath = `../../../games/${game}/content`;

    it.each(['missing', 'unknown-reference'])(
      'rejects %s effects in authored JSON instead of supplying a TypeScript fallback',
      (mutation) => {
        const source = structuredClone(
          jest.requireActual<Record<string, unknown>>(assetPath),
        );
        const cards = path.reduce<unknown>((value, key) => {
          if (!value || typeof value !== 'object')
            throw new Error('Invalid test catalogue');
          return (value as Record<string, unknown>)[key];
        }, source);
        if (!Array.isArray(cards) || !cards[0])
          throw new Error('Missing test card');
        const card = cards[0] as { effects?: unknown };
        if (mutation === 'missing') delete card.effects;
        else
          card.effects = [
            { kind: 'custom', effectId: 'undeclared-effect', data: {} },
          ];
        try {
          jest.isolateModules(() => {
            jest.doMock(assetPath, () => source);
            expect(() => jest.requireActual(contentPath)).toThrow();
          });
        } finally {
          jest.dontMock(assetPath);
        }
      },
    );
  },
);
