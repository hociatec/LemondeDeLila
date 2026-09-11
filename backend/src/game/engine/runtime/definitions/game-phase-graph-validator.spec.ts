import { defineGame } from './game-definition';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import type { PhaseConfiguration } from '../kits/phase-kit';

function compile(phases: Record<string, PhaseConfiguration<object>>) {
  return defineGame<object>()({
    id: 'phase-graph-contract',
    displayName: 'Phases',
    category: 'test',
    players: { min: 1, max: 2 },
    initialPhase: 'start',
    phases,
    actions: {
      pass: defineAction({ input: gameInput.object({}), execute: () => {} }),
    },
  });
}

describe('phase graph compilation', () => {
  it('rejects an unreachable cycle even though every phase has an exit', () => {
    expect(() =>
      compile({
        start: { terminal: true },
        a: { transitions: ['b'] },
        b: { transitions: ['a'] },
      }),
    ).toThrow('inaccessible');
  });
  it('requires explicit terminal metadata on a phase with no exit', () => {
    expect(() => compile({ start: {} })).toThrow('explicitement terminale');
    expect(() => compile({ start: { terminal: true } })).not.toThrow();
  });
  it('does not count a self transition as an exit', () => {
    expect(() => compile({ start: { transitions: ['start'] } })).toThrow(
      'sortie requise',
    );
  });
  it('rejects terminal phases with outgoing transitions', () => {
    expect(() =>
      compile({
        start: { terminal: true, transitions: ['end'] },
        end: { terminal: true },
      }),
    ).toThrow('terminale ne peut');
  });
  it('rejects references to object prototype properties', () => {
    expect(() => compile({ start: { transitions: ['toString'] } })).toThrow(
      'phase inconnue',
    );
  });
  it('accepts reachable manual and automatic transitions', () => {
    const definition = compile({
      start: { transitions: ['round'] },
      round: { next: 'end' },
      end: { terminal: true },
    });
    expect(Object.isFrozen(definition.phases?.start.transitions)).toBe(true);
  });
  it('prevents modifying the compiled graph through a shallow-frozen author phase', () => {
    const transitions = ['end'];
    const definition = compile({
      start: Object.freeze({ transitions }),
      end: { terminal: true },
    });
    expect(() => transitions.push('start')).toThrow(TypeError);
    expect(definition.phases?.start.transitions).toEqual(['end']);
  });
});
