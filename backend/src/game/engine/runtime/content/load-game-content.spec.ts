import { defineGameContent } from './game-content';
import { loadExternalGameContent } from './external-content-release';
import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';
import { isRecord } from './content-guards';

jest.mock('./external-content-release', () => ({
  loadExternalGameContent: jest.fn(),
}));

const schema = {
  parse(value: unknown): { title: string } {
    if (!isRecord(value) || typeof value.title !== 'string')
      throw new Error('title required');
    return { title: value.title };
  },
};

describe('defineGameContent source selection', () => {
  beforeEach(() => jest.mocked(loadExternalGameContent).mockReturnValue(null));

  it('decodes a BOM in an embedded JSON source', () => {
    expect(
      defineGameContent('demo', '\uFEFF{"title":"embedded"}', {
        schema: schema,
      }).data,
    ).toEqual({ title: 'embedded' });
  });

  it('keeps a selected release instead of overwriting it with the fallback JSON', () => {
    jest
      .mocked(loadExternalGameContent)
      .mockReturnValue({ source: { title: 'release' }, version: 'release-1' });
    const content = defineGameContent('demo', '{invalid fallback', {
      schema: schema,
    });
    expect(content.data.title).toBe('release');
    expect(content.version).toBe('release-1');
  });

  it('normalizes schema errors', () => {
    expect(() => defineGameContent('demo', {}, { schema: schema })).toThrow(
      GameContentValidationError,
    );
  });
});
