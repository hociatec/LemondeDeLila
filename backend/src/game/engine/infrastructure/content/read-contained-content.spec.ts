import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readContainedContent } from './read-contained-content';

describe('contained content filesystem boundary', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'lila-contained-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reads nested assets and rejects traversal and alternate path syntax', () => {
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'assets/card.json'), '{"id":1}');
    expect(readContainedContent(root, 'assets/card.json')).toBe('{"id":1}');
    for (const asset of [
      '../card.json',
      '/card.json',
      'C:/card.json',
      'assets\\card.json',
      'assets//card.json',
      './card.json',
      'assets/card.json:stream',
    ]) {
      expect(() => readContainedContent(root, asset)).toThrow(
        'hors release ou jeu',
      );
    }
  });

  it('rejects a junction escaping the selected root', () => {
    mkdirSync(join(root, 'inside'));
    mkdirSync(join(root, 'outside'));
    writeFileSync(join(root, 'outside/card.json'), '{}');
    symlinkSync(join(root, 'outside'), join(root, 'inside/link'), 'junction');
    expect(() =>
      readContainedContent(join(root, 'inside'), 'link/card.json'),
    ).toThrow('hors release ou jeu');
  });
});
