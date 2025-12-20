import * as fs from 'fs';
import * as path from 'path';

type AnyRecord = Record<string, any>;

function repoRoot(): string {
  return path.resolve(__dirname, '../../../../..');
}

function readJson(relativeToRepoRoot: string): any {
  const abs = path.resolve(repoRoot(), relativeToRepoRoot);
  return JSON.parse(fs.readFileSync(abs, 'utf-8'));
}

function expectString(value: any): void {
  expect(typeof value).toBe('string');
}

function expectNumber(value: any): void {
  expect(typeof value).toBe('number');
}

function expectBoolean(value: any): void {
  expect(typeof value).toBe('boolean');
}

function expectArray(value: any): void {
  expect(Array.isArray(value)).toBe(true);
}

describe('Contract fixtures', () => {
  it('parses game.state fixtures and contains expected keys', () => {
    const setup = readJson(
      'contracts/fixtures/game.state.setup.json',
    ) as AnyRecord;
    const started = readJson(
      'contracts/fixtures/game.state.started.json',
    ) as AnyRecord;

    for (const state of [setup, started]) {
      expectString(state.status);
      expectString(state.phase);
      expectNumber(state.round);
      expectNumber(state.turnIndex);
      expectArray(state.log);
      expectBoolean(state.botThinking);
      expectArray(state.actions);
      expect(state.pending === null || typeof state.pending === 'object').toBe(
        true,
      );

      expect(state.turn && typeof state.turn === 'object').toBe(true);
      expect(state.turn.direction === 1 || state.turn.direction === -1).toBe(
        true,
      );
      expect(
        state.turn.currentPlayerId === null ||
          typeof state.turn.currentPlayerId === 'number',
      ).toBe(true);
      expectString(state.turn.label);

      if (state.players != null) {
        expectArray(state.players);
      }

      expect(state.extras && typeof state.extras === 'object').toBe(true);
      expectArray(state.extras.playerViews);
      expectArray(state.extras.players);
      expectArray(state.extras.shortcuts);
    }

    expect(setup.status.toLowerCase()).toBe('setup');
    expect(started.status.toLowerCase()).toBe('started');
  });

  it('parses room.payload fixture and contains expected keys', () => {
    const payload = readJson(
      'contracts/fixtures/room.payload.json',
    ) as AnyRecord;
    expect(payload.room && typeof payload.room === 'object').toBe(true);
    expectNumber(payload.room.id);
    expectString(payload.room.gameType);
    expectArray(payload.room.players);
  });
});
