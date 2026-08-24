import { LamaLogService } from '../../application/services/lama-log.service';

describe('LamaLogService', () => {
  it('normalizes mojibake/accent text before appending', () => {
    const service = new LamaLogService();
    const next = service.append([], 'BloquÃ© : lancez le de : "5".');
    const message = String(next[0]?.message ?? '');

    expect(message).toBe('BloquÃ©: lancez le dÃ©: "5".');
  });

  it('deduplicates consecutive identical messages', () => {
    const service = new LamaLogService();
    const first = service.append([], "C'est au tour de Lilas.");
    const second = service.append(first, "C'est au tour de Lilas.");

    expect(second.length).toBe(1);
  });
});


