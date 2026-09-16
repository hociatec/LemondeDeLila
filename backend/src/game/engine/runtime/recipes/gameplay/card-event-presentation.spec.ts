import { resolvedCardEventData } from './card-event-presentation';

describe('resolved card event presentation', () => {
  it('keeps the narrative when the card has a separate title', () => {
    expect(
      resolvedCardEventData({
        id: 1,
        title: "Livre à l'envers",
        text: 'Votre prochain tour se fait en reculant.',
      }),
    ).toEqual({
      revealed: true,
      cardLabel: "Livre à l'envers",
      effectDescription: 'Votre prochain tour se fait en reculant.',
    });
  });

  it('describes an immediately resolved public card and all useful effects', () => {
    expect(
      resolvedCardEventData({
        id: 1,
        text: 'Rencontre animale : le singe vous aide',
        effects: [
          {
            kind: 'move',
            trackId: 'jungle',
            spaces: 2,
            target: { kind: 'self' },
          },
          { kind: 'custom', effectId: 'resolve-landing', data: {} },
        ],
      }),
    ).toEqual({
      revealed: true,
      cardLabel: 'Rencontre animale',
      effectDescription: 'le singe vous aide',
    });

    expect(
      resolvedCardEventData({
        id: 2,
        text: 'Coup de patte 2',
        effects: [
          {
            kind: 'move',
            trackId: 'jungle',
            spaces: -1,
            target: { kind: 'self' },
          },
          { kind: 'custom', effectId: 'resolve-landing', data: {} },
        ],
      }),
    ).toEqual({
      revealed: true,
      cardLabel: 'Coup de patte 2',
      effectDescription: 'Reculez de 1 case',
    });
  });

  it('does not reveal scalar cards that can belong to a private hand', () => {
    expect(resolvedCardEventData('LAMA')).toEqual({});
  });
});
