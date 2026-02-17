import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { InteractiveExchangeAdapter } from '../model/interactive-exchange.model';
import { InteractiveExchangeService } from './interactive-exchange.service';
import { RandomService } from '../../random/services/random.service';

function makeState(): GameStateEntity {
  return {
    status: 'started',
    phase: 'main',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'A', inventory: ['pomme'] },
      { id: 2, username: 'B', inventory: ['poire'] },
    ],
    pending: null,
    metadata: { roomId: 'room-1', roomStartedAt: '2026-02-17T00:00:00.000Z' },
  };
}

function adapter(): InteractiveExchangeAdapter {
  return {
    listTargets: (state, playerId) =>
      (state.players ?? [])
        .filter((p) => p.id !== playerId)
        .map((p) => ({
          targetPlayerId: p.id,
          targetUsername: p.username,
        })),
    getInventory: (state, playerId) => {
      const player = (state.players ?? []).find((p) => p.id === playerId) as any;
      const inventory = Array.isArray(player?.inventory) ? player.inventory : [];
      return inventory.map((v: unknown) => String(v));
    },
    removeFromInventory: (state, playerId, card) => {
      const players = (state.players ?? []).map((p: any) => {
        if (p.id !== playerId) return p;
        const inventory = Array.isArray(p.inventory) ? [...p.inventory] : [];
        const idx = inventory.findIndex((v: unknown) => String(v) === card);
        if (idx >= 0) inventory.splice(idx, 1);
        return { ...p, inventory };
      });
      return { ...state, players };
    },
    addCardToPlayer: (state, playerId, card) => {
      const players = (state.players ?? []).map((p: any) => {
        if (p.id !== playerId) return p;
        const inventory = Array.isArray(p.inventory) ? [...p.inventory] : [];
        inventory.push(card);
        return { ...p, inventory };
      });
      return { ...state, players };
    },
  };
}

describe('InteractiveExchangeService', () => {
  let service: InteractiveExchangeService;

  beforeEach(() => {
    service = new InteractiveExchangeService(new RandomService());
  });

  it('marks exchange pending as blocking at start', () => {
    const result = service.start(makeState(), 1, 'echange-amiable', adapter());
    expect(result.kind).toBe('started');
    if (result.kind !== 'started') return;
    expect((result.pending as any).blocking).toBe(true);
    expect((result.state.pending as any)?.blocking).toBe(true);
  });

  it('keeps blocking flag when choosing target', () => {
    const started = service.start(makeState(), 1, 'echange-amiable', adapter());
    expect(started.kind).toBe('started');
    if (started.kind !== 'started') return;

    const updated = service.chooseTarget(started.state, 1, 2, adapter());
    expect(updated.kind).toBe('updated');
    if (updated.kind !== 'updated') return;
    expect((updated.pending as any).blocking).toBe(true);
    expect((updated.state.pending as any)?.blocking).toBe(true);
  });

  it('keeps blocking flag on confirm step', () => {
    const started = service.start(makeState(), 1, 'echange-amiable', adapter());
    expect(started.kind).toBe('started');
    if (started.kind !== 'started') return;

    const updated = service.chooseTarget(started.state, 1, 2, adapter());
    expect(updated.kind).toBe('updated');
    if (updated.kind !== 'updated') return;

    const offered = service.chooseGive(updated.state, 1, 'pomme', adapter());
    expect(offered.kind).toBe('offered');
    if (offered.kind !== 'offered') return;
    expect((offered.offer as any).blocking).toBe(true);
    expect((offered.state.pending as any)?.blocking).toBe(true);
    expect((offered.state.pending as any)?.playerId).toBe(2);
  });
});
