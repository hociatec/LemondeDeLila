import { resolveJsonContent } from './json-content-bundle';

it('resolves nested references and pointers without sharing mutable values', () => {
  const assets = {
    'content/cards.json': [
      { id: 'a', effects: [{ $content: 'content/effects.json#/gain' }] },
    ],
    'content/effects.json': { gain: { kind: 'gain-score', amount: 1 } },
  };
  const result = resolveJsonContent(
    { cards: { $content: 'content/cards.json' } },
    assets,
  );
  expect(result).toEqual({
    cards: [{ id: 'a', effects: [{ kind: 'gain-score', amount: 1 }] }],
  });
  expect(
    resolveJsonContent({ $content: 'content/cards.json' }, assets),
  ).not.toBe(assets['content/cards.json']);
  assets['content/effects.json'].gain.amount = 9;
  expect(result).toHaveProperty('cards.0.effects.0.amount', 1);
});

it.each([
  '../secret.json',
  '/secret.json',
  'https://example.org/data.json',
  'content/../secret.json',
  'content\\cards.json',
  'content/cards.json#bad',
  'content/cards.json#/missing',
  'content/cards.json#/constructor',
  'content/cards.json#/invalid~2escape',
  'content/cards.json#/a#b',
])('rejects an invalid or unresolved reference %s', (reference) => {
  expect(() =>
    resolveJsonContent({ $content: reference }, { 'content/cards.json': {} }),
  ).toThrow();
});

it('rejects cycles and reference siblings', () => {
  const assets = {
    'content/a.json': { $content: 'content/b.json' },
    'content/b.json': { $content: 'content/a.json' },
  };
  expect(() =>
    resolveJsonContent({ $content: 'content/a.json' }, assets),
  ).toThrow(/Cyclic/);
  expect(() =>
    resolveJsonContent({ $content: 'content/a.json', extra: 1 }, assets),
  ).toThrow(/only/);
});

it('bounds expansion even when the source uses a tiny shared reference tree', () => {
  const assets: Record<string, unknown> = { 'content/leaf.json': 1 };
  let reference = 'content/leaf.json';
  for (let index = 0; index < 20; index++) {
    const file = `content/layer-${index}.json`;
    assets[file] = [{ $content: reference }, { $content: reference }];
    reference = file;
  }
  expect(() => resolveJsonContent({ $content: reference }, assets)).toThrow(
    /bounds/,
  );
});

it('preserves escaped pointer keys and meaningful array order', () => {
  expect(
    resolveJsonContent(
      { $content: 'content/cards.json#/a~1b/~0key' },
      {
        'content/cards.json': { 'a/b': { '~key': ['second', 'first'] } },
      },
    ),
  ).toEqual(['second', 'first']);
});

it.each(['length', '-1', '01', '-', '2'])(
  'rejects invalid array pointer %s',
  (index) => {
    expect(() =>
      resolveJsonContent(
        { $content: `content/cards.json#/${index}` },
        {
          'content/cards.json': ['a', 'b'],
        },
      ),
    ).toThrow();
  },
);
