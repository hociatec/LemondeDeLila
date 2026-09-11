import type { NoGameState as OdysseeState } from '../../../engine/sdk/public-api';
import { defineGame, pawnRace } from '../../../engine/sdk/public-api';
import { ODYSSEE_CONTENT, ODYSSEE_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import { GAME_CHOICES } from './rules';

import { ODYSSEE_ACTIONS } from './rules';

const ODYSSEE_PAWNS = Array.from({ length: 4 }, (_seat, seatIndex) =>
  ODYSSEE_CONTENT.pawnNames.map((label, pawnIndex) => ({
    id: `${seatIndex}:${pawnIndex}`,
    label,
  })),
).flat();

export default defineGame<OdysseeState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: ODYSSEE_GAME_CONTENT,
  patterns: [
    pawnRace({
      pawnSetId: 'odyssee',
      pawns: ODYSSEE_PAWNS,
      perPlayer: ODYSSEE_CONTENT.pawnsPerPlayer,
      spaces: ODYSSEE_CONTENT.trackLength + ODYSSEE_CONTENT.homeLength,
      initialPosition: -1,
      entryRoll: 6,
      entryPosition: 0,
      exactFinish: true,
      homeStretchFrom: ODYSSEE_CONTENT.trackLength,
    }),
  ],
  initialization: {
    pawns: [{ setId: 'odyssee', assignment: 'grouped' }],
    startRound: false,
  },
  shortcuts: [
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'E', type: 'interface', id: 'stable' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  actions: ODYSSEE_ACTIONS,
  choices: GAME_CHOICES,
  bot: {
    choose: () => ({ type: 'roll', payload: {} }),
  },
});
