import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';
import {
  boardContent,
  cardContent,
  defineGameContent,
  freezeGameContent,
  quizContent,
  trackContent,
} from './game-content';

describe('game content boundaries', () => {
  it('freezes explicit snapshot migration pairs without changing the content fingerprint', () => {
    const migrations = [{ fromVersion: 'old', toVersion: 'new' }];
    const plain = defineGameContent('migration', { value: 1 });
    const content = defineGameContent(
      'migration',
      { value: 1 },
      { snapshotMigrations: migrations },
    );
    expect(content.version).toBe(plain.version);
    migrations[0].fromVersion = 'mutated';
    expect(content.snapshotMigrations).toEqual([
      { fromVersion: 'old', toVersion: 'new' },
    ]);
    expect(Object.isFrozen(content.snapshotMigrations?.[0])).toBe(true);
    expect(() =>
      defineGameContent(
        'migration',
        {},
        { snapshotMigrations: [{ fromVersion: 'same', toVersion: 'same' }] },
      ),
    ).toThrow(GameContentValidationError);
  });
  it('versions the data format independently while preserving format-one content identities', () => {
    const original = defineGameContent('format', {});
    expect(defineGameContent('format', {}, { formatVersion: 1 }).version).toBe(
      original.version,
    );
    expect(
      defineGameContent('format', {}, { formatVersion: 2 }).version,
    ).not.toBe(original.version);
    expect(
      defineGameContent('format', {}, { formatVersion: 2 }).formatVersion,
    ).toBe(2);
    for (const formatVersion of [0, -1, 1.5, Infinity, NaN]) {
      expect(() => defineGameContent('format', {}, { formatVersion })).toThrow(
        GameContentValidationError,
      );
    }
  });
  it('rejects cycles and runtime callbacks with normalized content errors', () => {
    const cyclic: { self?: object } = {};
    cyclic.self = cyclic;
    expect(() => defineGameContent('cyclic', cyclic)).toThrow(
      GameContentValidationError,
    );
    expect(() => defineGameContent('callback', { apply: () => {} })).toThrow(
      GameContentValidationError,
    );
    expect(() => cardContent([{ id: 'bad', apply: () => {} }])).toThrow(
      GameContentValidationError,
    );
  });

  it('hashes the entries of Map and Set content and accepts shared noncyclic objects', () => {
    const version = (value: object) =>
      defineGameContent('collections', { value }).version;
    expect(version(new Map([['key', 1]]))).not.toBe(
      version(new Map([['key', 2]])),
    );
    expect(version(new Set([1]))).not.toBe(version(new Set([2])));
    const shared = { label: 'same' };
    expect(() =>
      defineGameContent('shared', { first: shared, second: shared }),
    ).not.toThrow();
  });
  it('validates duplicate ids through the specialized catalogue boundaries', () => {
    expect(() =>
      cardContent([
        { id: 'same', label: 'first' },
        { id: 'same', label: 'second' },
      ]),
    ).toThrow(GameContentValidationError);

    expect(
      defineGameContent('card-copies', {
        cards: [{ id: 'same' }, { id: 'same' }],
      }).data.cards,
    ).toHaveLength(2);
  });

  it('freezes and validates specialized catalogues', () => {
    const cards = cardContent([{ id: 'card-1', label: 'Card' }]);
    const quiz = quizContent([
      {
        id: 'quiz-1',
        prompt: 'Question?',
        choices: ['A', 'B'],
        answerIndex: 0,
      },
    ]);
    const board = boardContent([
      { id: 'start', links: ['finish'] },
      { id: 'finish', links: [] },
    ]);
    const track = trackContent([{ id: 0 }, { id: 1 }]);

    expect(Object.isFrozen(cards[0])).toBe(true);
    expect(Object.isFrozen(quiz[0])).toBe(true);
    expect(Object.isFrozen(board[0])).toBe(true);
    expect(Object.isFrozen(track[0])).toBe(true);
  });

  it('blocks Map and Set prototype mutators after content freezing', () => {
    const map = new Map([['key', { value: 1 }]]);
    const set = new Set([{ value: 2 }]);
    const frozen = freezeGameContent({ map, set });

    expect(() => frozen.map.set('other', { value: 3 })).toThrow(TypeError);
    expect(() => frozen.map.delete('key')).toThrow(TypeError);
    expect(() => frozen.map.clear()).toThrow(TypeError);
    expect(() => frozen.set.add({ value: 4 })).toThrow(TypeError);
    expect(() => frozen.set.delete([...frozen.set][0])).toThrow(TypeError);
    expect(() => frozen.set.clear()).toThrow(TypeError);
    expect(frozen.map.size).toBe(1);
    expect(frozen.set.size).toBe(1);
    expect(() => Map.prototype.set.call(frozen.map, 'key', 9)).toThrow(
      TypeError,
    );
    expect(() => Map.prototype.delete.call(frozen.map, 'key')).toThrow(
      TypeError,
    );
    expect(() => Map.prototype.clear.call(frozen.map)).toThrow(TypeError);
    expect(() => Set.prototype.add.call(frozen.set, 9)).toThrow(TypeError);
    expect(() => Set.prototype.delete.call(frozen.set, 9)).toThrow(TypeError);
    expect(() => Set.prototype.clear.call(frozen.set)).toThrow(TypeError);
    map.set('outside', { value: 9 });
    set.add({ value: 9 });
    expect(frozen.map.size).toBe(1);
    expect(frozen.set.size).toBe(1);
    frozen.map.forEach((entry, key, collection) => {
      expect(collection).toBe(frozen.map);
      expect(key).toBe('key');
      expect(Object.isFrozen(entry)).toBe(true);
    });
    frozen.set.forEach((entry, key, collection) => {
      expect(collection).toBe(frozen.set);
      expect(entry).toBe(key);
      expect(Object.isFrozen(entry)).toBe(true);
    });
  });

  it('preserves versions and shared references when frozen collections are compiled again', () => {
    const shared = { value: 1 };
    const source = Object.freeze({
      first: shared,
      second: shared,
      map: Object.freeze(new Map([['key', shared]])),
      set: Object.freeze(new Set([shared])),
    });
    const original = defineGameContent('collections', source);
    const frozen = freezeGameContent(source);
    const compiled = defineGameContent('collections', frozen);
    expect(compiled.version).toBe(original.version);
    expect(compiled.data.first).toBe(compiled.data.second);
    expect(compiled.data.map.get('key')).toBe(compiled.data.first);
    expect([...compiled.data.set][0]).toBe(compiled.data.first);
    expect(() => Map.prototype.clear.call(compiled.data.map)).toThrow(
      TypeError,
    );
    expect(() => Set.prototype.clear.call(compiled.data.set)).toThrow(
      TypeError,
    );
    expect([...compiled.data.map.keys()]).toEqual(['key']);
    expect([...compiled.data.map.values()]).toEqual([{ value: 1 }]);
    expect(() => structuredClone(compiled.data.map)).toThrow();
  });

  it('preserves frozen object keys and isolates collections under readonly properties', () => {
    const key = Object.freeze({ name: 'key' });
    const map = new Map([[key, 1]]);
    const source = Object.defineProperty({ map }, 'map', { writable: false });
    const frozen = freezeGameContent(source);
    expect(frozen.map.get(key)).toBe(1);
    map.set(key, 2);
    expect(frozen.map.get(key)).toBe(1);
    expect(Object.isFrozen(frozen)).toBe(true);
  });
});
