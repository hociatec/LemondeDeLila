import { normalizeGameLogMessage } from './log-style.helper';

describe('log-style.helper', () => {
  it('normalizes spaces and line breaks', () => {
    expect(normalizeGameLogMessage('  Lila\n\tjoue   une carte  .  ')).toBe(
      'Lila joue une carte.',
    );
  });

  it('repairs mojibake in log messages', () => {
    expect(normalizeGameLogMessage('Victoire de Lila : dÃ©fi gagnÃ©.')).toBe(
      'Victoire de Lila: défi gagné.',
    );
  });

  it('returns empty string for empty input', () => {
    expect(normalizeGameLogMessage('   \n\t')).toBe('');
  });
});
