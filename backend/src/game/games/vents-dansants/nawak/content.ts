import manifest from './manifest.json';
import embeddedCatalogue from './catalogue.json';

import { defineGameContent, gameInput } from '../../../engine/sdk/public-api';

import type { NawakChallenge } from './state';

const challengesSchema = gameInput.object({
  targetScore: gameInput.number({ integer: true, min: 1, max: 1000 }),
  challenges: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      prompt: gameInput.string({ min: 1, max: 10000 }),
      answers: gameInput.array(gameInput.string({ min: 1, max: 10000 }), {
        min: 3,
        max: 3,
      }),
    }),
    { min: 1, max: 10000 },
  ),
});
export const NAWAK_GAME_CONTENT = defineGameContent(
  manifest.code,
  embeddedCatalogue,
  {
    schema: {
      parse(value: unknown) {
        const parsed = challengesSchema.parse(value);
        return {
          targetScore: parsed.targetScore,
          challenges: parsed.challenges.map((challenge): NawakChallenge => ({
            ...challenge,
            answers: [
              challenge.answers[0],
              challenge.answers[1],
              challenge.answers[2],
            ],
          })),
        };
      },
    },
  },
);
export const NAWAK_CHALLENGES = NAWAK_GAME_CONTENT.data.challenges;
export const NAWAK_TARGET_SCORE = NAWAK_GAME_CONTENT.data.targetScore;
