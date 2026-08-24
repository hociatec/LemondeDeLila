import { formatPawnChoiceLabel, resolvePawnId } from './pawns.utils';

describe('frousse pawns utils', () => {
  it('resolves pawn ids from different primitive values', () => {
    expect(resolvePawnId(null)).toBeNull();
    expect(resolvePawnId(undefined)).toBeNull();
    expect(resolvePawnId('  wolf  ')).toBe('wolf');
    expect(resolvePawnId(42)).toBe('42');
    expect(resolvePawnId(false)).toBe('false');
    expect(resolvePawnId(true)).toBe('true');
    expect(resolvePawnId({})).toBeNull();
    expect(resolvePawnId(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('formats pawn choice labels for all branches', () => {
    expect(
      formatPawnChoiceLabel({
        id: 'wolf',
        name: 'Loup',
        description: 'Rapide',
      } as any),
    ).toBe('Loup: Rapide');

    expect(
      formatPawnChoiceLabel({
        id: 'fox',
        name: 'Renard',
      } as any),
    ).toBe('Renard');

    expect(
      formatPawnChoiceLabel({
        id: 'ghost',
        name: '',
        description: 'Invisible',
      } as any),
    ).toBe('Invisible');

    expect(
      formatPawnChoiceLabel({
        id: 'fallback-id',
        name: '',
        description: '',
      } as any),
    ).toBe('fallback-id');

    expect(formatPawnChoiceLabel({} as any)).toBe('Pion');
  });
});
