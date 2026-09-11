import { compareCanonicalText } from './canonical-order';

describe('canonical ordering', () => {
  it('orders independently of locale and returns equality for normalized text', () => {
    const values = ['zèbre', 'Éclair', 'abricot'];
    expect([...values].sort(compareCanonicalText)).toEqual([
      'abricot',
      'zèbre',
      'Éclair',
    ]);
    expect(compareCanonicalText('é', '\u00e9')).toBe(0);
  });
});
