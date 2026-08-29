import { discoverGameDefinitions } from '../../game/composition/game-module-discovery';
import { auditGameDefinition } from './game-contract-auditor';

describe('contract tests for every declarative game', () => {
  const definitions = discoverGameDefinitions();

  it('discovers at least one game through the official entry point', () => {
    expect(definitions.length).toBeGreaterThan(0);
  });

  it.each(
    definitions.map((definition) => [definition.id, definition] as const),
  )('%s satisfies deterministic engine properties', async (_id, definition) => {
    expect(await auditGameDefinition(definition)).toEqual([]);
  });
});
