import {
  countOnly,
  hidden,
  hiddenUntil,
  privateByPlayer,
  projectVisibility,
  publicField,
  publicFields,
} from './visibility-kit';

describe('visibility kit', () => {
  it('projects only explicitly declared fields', () => {
    const state = {
      publicValue: 'visible',
      secret: 'hidden',
      delayed: 'later',
      cards: ['a', 'b'],
      hands: { '1': ['mine'], '2': ['theirs'] },
      undeclared: 'must not leak',
    };

    expect(
      projectVisibility(
        state,
        {
          publicValue: publicField(),
          secret: hidden(),
          delayed: hiddenUntil(false),
          cards: countOnly(),
          hands: privateByPlayer(),
        },
        1,
      ),
    ).toEqual({
      publicValue: 'visible',
      cards: 2,
      hands: { '1': ['mine'] },
    });
  });

  it('clones an explicit public field whitelist', () => {
    const source = { safe: { value: 1 }, secret: { token: 'private' } };
    const projected = publicFields(source, ['safe']);
    projected.safe.value = 2;

    expect(projected).toEqual({ safe: { value: 2 } });
    expect(source.safe.value).toBe(1);
    expect(projected).not.toHaveProperty('secret');
  });
});
