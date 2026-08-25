import { normalizeGameLogMessage } from './game-log-normalizer';

describe('game-log-normalizer', () => {
  it('normalizes spaces and line breaks', () => {
    expect(normalizeGameLogMessage('  Lila\n\tjoue   une carte  .  ')).toBe(
      'Lila joue une carte.',
    );
  });

  it('repairs mojibake in log messages', () => {
    expect(normalizeGameLogMessage('Victoire de Lila : défi gagné.')).toBe(
      'Victoire de Lila: défi gagné.',
    );
  });

  it('removes duplicated final dot in composed labels', () => {
    expect(
      normalizeGameLogMessage(
        'Lilas choisit le pion : Le Lion: Majestueux et fier..',
      ),
    ).toBe('Lilas a choisi le pion: Le Lion: Majestueux et fier.');
  });

  it('normalizes pawn-choice prompts and confirmations', () => {
    expect(normalizeGameLogMessage("C'est à Lilas de choisir un pion.")).toBe(
      "C'est à Lilas de choisir son pion.",
    );
    expect(normalizeGameLogMessage('Lilas choisit le pion Coq rockeur.')).toBe(
      'Lilas a choisi le pion: Coq rockeur.',
    );
  });

  it('normalizes common french accent typos in logs', () => {
    expect(normalizeGameLogMessage('Debut de partie : Lila commence.')).toBe(
      'Début de partie: Lila commence.',
    );
    expect(normalizeGameLogMessage('Lila lance le de : "4".')).toBe(
      'Lila lance le dé: "4".',
    );
    expect(normalizeGameLogMessage('Lancez le de : "5".')).toBe(
      'Lancez le dé: "5".',
    );
  });

  it('returns empty string for empty input', () => {
    expect(normalizeGameLogMessage('   \n\t')).toBe('');
  });
});
