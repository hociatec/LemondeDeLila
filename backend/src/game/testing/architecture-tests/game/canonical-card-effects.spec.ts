import { GENERATED_GAME_PACKAGES } from '../../../composition/generated-game-registry';
import { compileJsonGame } from '../../../engine/json/public-api';

const catalogues = [
  ['contes-et-cacahuetes', ['storyChallenge', 'decks', 'bonus']],
  ['la-grande-mine-de-barbak', ['publicDomainCards', 'cards']],
  ['frousse-party', ['protectedHauntedRace', 'cards']],
  ['les-mains-de-la-terre', ['familyEffects', 'cards']],
  ['en-attendant-minuit', ['bounceQuizRace', 'cards']],
  ['a-fond-les-ballons', ['chainedTileRace', 'cards']],
  ['galopons-ensemble', ['bidirectionalCollisionRace', 'cards']],
  ['ca-derape', ['directionalHazardRace', 'cards']],
] as const;

describe.each(catalogues)(
  '%s canonical JSON card instructions',
  (gameId, path) => {
    it.each(['missing', 'unknown-reference'])(
      'rejects %s effects instead of supplying a fallback',
      (mutation) => {
        const entry = GENERATED_GAME_PACKAGES.find(
          (candidate) =>
            (candidate.manifest as { code?: string }).code === gameId,
        );
        if (!entry) throw new Error('Missing game package ' + gameId);
        const definition = compileJsonGame(
          entry.manifest as Parameters<typeof compileJsonGame>[0],
          (
            entry.definition as {
              content: { data: object };
            }
          ).content.data,
        );
        const source = structuredClone(definition.content.data) as Record<
          string,
          unknown
        >;
        const cards = path.reduce<unknown>((value, key) => {
          if (!value || typeof value !== 'object')
            throw new Error('Invalid canonical card path');
          return (value as Record<string, unknown>)[key];
        }, source);
        if (!Array.isArray(cards) || !cards[0])
          throw new Error('Missing canonical card');
        const card = cards[0] as { effects?: unknown };
        if (mutation === 'missing') delete card.effects;
        else
          card.effects = [
            { kind: 'custom', effectId: 'undeclared-effect', data: {} },
          ];
        expect(() =>
          compileJsonGame(
            entry.manifest as Parameters<typeof compileJsonGame>[0],
            source,
          ),
        ).toThrow();
      },
    );
  },
);
