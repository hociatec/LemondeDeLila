import { SetupFlowService } from './setup-flow.service';

describe('SetupFlowService', () => {
  let service: SetupFlowService;

  beforeEach(() => {
    service = new SetupFlowService();
  });

  it('creates pending for the first unassigned player from start player', () => {
    const players = [
      { id: 10, username: 'A' },
      { id: 20, username: 'B' },
      { id: 30, username: 'C' },
    ];
    const assigned = new Set<number>([10]);
    const pending = service.createSequentialChoicePending({
      players,
      startPlayerId: 10,
      isAssigned: (playerId) => assigned.has(playerId),
      pendingType: 'choose_pawn',
      choices: [{ id: 'coq', label: 'Coq' }],
      labelForPlayer: (name) => `C'est à ${name} de choisir.`,
    });

    expect(pending).not.toBeNull();
    expect(pending?.playerId).toBe(20);
    expect(pending?.turnIndex).toBe(1);
    expect(pending?.pending.type).toBe('choose_pawn');
  });

  it('resolves a choice by id or label (accent/spacing insensitive)', () => {
    const options = [
      { id: 'chevre-acrobate', label: 'Chèvre acrobate', feminine: true },
      { id: 'coq-rockeur', label: 'Coq rockeur', feminine: false },
    ];

    const byId = service.resolveChoice('chevre acrobate', options);
    const byLabel = service.resolveChoice('Chèvre  acrobate', options);

    expect(byId?.id).toBe('chevre-acrobate');
    expect(byLabel?.id).toBe('chevre-acrobate');
  });
});


