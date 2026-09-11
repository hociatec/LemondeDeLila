import {
  defineGame,
  submissionJudgeGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { NAWAK_GAME_CONTENT, NAWAK_TARGET_SCORE } from './content';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import { ANSWERS_REVEALED, NAWAK_ACTIONS, ROUND_STARTED } from './rules';
import { setupGame } from './setup-rules';
import type { NawakState } from './state';

export default defineGame<NawakState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  events: [ANSWERS_REVEALED, ROUND_STARTED],
  content: NAWAK_GAME_CONTENT,
  patterns: [
    submissionJudgeGame({
      submissionId: 'nawak.answers',
      voteId: 'nawak.votes',
      secret: true,
      targetScore: NAWAK_TARGET_SCORE,
      winnerReason: 'target-score',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'choose_answer' },
    { key: 'V', type: 'action', actionType: 'vote_answer' },
  ],
  initialization: { firstPlayer: 'first', startRound: true },
  setup: setupGame,
  actions: NAWAK_ACTIONS,
  ...GAME_RULES,
  bot: GAME_BOT,
});
