import * as fs from 'fs';
import * as path from 'path';

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function repoRoot(): string {
  return path.resolve(__dirname, '../../../../..');
}

function tryReadJson(relativeToRepoRoot: string): JsonObject | null {
  const abs = path.resolve(repoRoot(), relativeToRepoRoot);
  if (!fs.existsSync(abs)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(abs, 'utf-8')) as unknown;
  if (!isJsonObject(raw)) {
    return null;
  }
  return raw;
}

function expectString(value: unknown): void {
  expect(typeof value).toBe('string');
}

function expectNumber(value: unknown): void {
  expect(typeof value).toBe('number');
}

function expectBoolean(value: unknown): void {
  expect(typeof value).toBe('boolean');
}

function expectArray(value: unknown): void {
  expect(Array.isArray(value)).toBe(true);
}

describe('Contract fixtures', () => {
  it('parses game.state fixtures and contains expected keys', () => {
    const setup = tryReadJson('contracts/fixtures/game.state.setup.json');
    const started = tryReadJson('contracts/fixtures/game.state.started.json');
    if (!setup || !started) {
      return;
    }

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

      const turn = (state as any).turn;
      expect(turn && typeof turn === 'object').toBe(true);
      expect(turn.direction === 1 || turn.direction === -1).toBe(true);
      expect(isJsonObject(turn)).toBe(true);
      if (isJsonObject(turn)) {
        expect(
          turn.currentPlayerId === null ||
            typeof turn.currentPlayerId === 'number',
        ).toBe(true);
        expectString(turn.label);
      }

      if (state.players != null) {
        expectArray(state.players);
      }

      const extras = state.extras;
      expect(isJsonObject(extras)).toBe(true);
      if (isJsonObject(extras)) {
        expectArray(extras.playerViews);
        expectArray(extras.players);
        expectArray(extras.shortcuts);
      }

      const metadata = state.metadata;
      expect(isJsonObject(metadata)).toBe(true);
      if (isJsonObject(metadata)) {
        const lifecycle = metadata.lifecycle;
        expect(isJsonObject(lifecycle)).toBe(true);
        if (isJsonObject(lifecycle)) {
          expectBoolean(lifecycle.startReady);
          expectBoolean(lifecycle.viewerTurnActionable);
          expectBoolean(lifecycle.viewerMustChoosePawn);
        }
      }
    }

    const setupStatus =
      typeof setup.status === 'string' ? setup.status.toLowerCase() : '';
    const startedStatus =
      typeof started.status === 'string' ? started.status.toLowerCase() : '';
    expect(setupStatus).toBe('setup');
    expect(startedStatus).toBe('started');

    const setupLifecycle = isJsonObject(setup.metadata)
      ? (setup.metadata.lifecycle as Record<string, unknown> | undefined)
      : undefined;
    const startedLifecycle = isJsonObject(started.metadata)
      ? (started.metadata.lifecycle as Record<string, unknown> | undefined)
      : undefined;
    expect(setupLifecycle?.startReady).toBe(false);
    expect(startedLifecycle?.startReady).toBe(true);
    expect(setupLifecycle?.viewerTurnActionable).toBe(false);
    expect(setupLifecycle?.viewerMustChoosePawn).toBe(false);
    expect(startedLifecycle?.viewerTurnActionable).toBe(true);
    expect(startedLifecycle?.viewerMustChoosePawn).toBe(false);
  });

  it('parses room.payload fixture and contains expected keys', () => {
    const payload = tryReadJson('contracts/fixtures/room.payload.json');
    if (!payload) {
      return;
    }
    const room = payload['room'];
    expect(isJsonObject(room)).toBe(true);
    if (!isJsonObject(room)) {
      return;
    }
    expectNumber(room.id);
    expectString(room.gameType);
    expectArray(room.players);
  });
});
