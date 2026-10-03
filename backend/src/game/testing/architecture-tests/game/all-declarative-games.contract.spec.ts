import { Logger } from '@nestjs/common';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { auditGameDefinition } from './game-contract-auditor';

describe('contract tests for every declarative game', () => {
  const selectedIds = new Set(
    (process.env.GAME_TEST_GAME_IDS ?? '').split(',').filter(Boolean),
  );
  const [shardIndex, shardCount] = (process.env.GAME_TEST_SHARD ?? '1/1')
    .split('/')
    .map(Number);
  const definitions = discoverGameDefinitions()
    .filter(
      (definition) => selectedIds.size === 0 || selectedIds.has(definition.id),
    )
    .filter((_definition, index) => index % shardCount === shardIndex - 1);

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('discovers at least one selected game through the official entry point', () => {
    expect(definitions.length).toBeGreaterThan(0);
  });

  it.each(
    definitions.map((definition) => [definition.id, definition] as const),
  )('%s satisfies deterministic engine properties', async (_id, definition) => {
    expect(
      await auditGameDefinition(definition, {
        fast: process.env.GAME_TEST_PROFILE === 'fast',
      }),
    ).toEqual([]);
  });
});
