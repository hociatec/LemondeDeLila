import {
  defineGame,
  type NoGameState,
  quiz,
  simultaneousAnswers,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { GAME_CONFIGURATION, QUIZ_STARTED } from './configuration';
import { MNEMO_BANKS, MNEMO_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import { MNEMO_ACTIONS, MNEMO_PHASES } from './rules';

export default defineGame<NoGameState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'Quiz',
  subcategory: 'VentsInfinis',
  description: manifest.summary,
  content: MNEMO_GAME_CONTENT,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  events: [QUIZ_STARTED],
  patterns: [simultaneousAnswers()],
  config: GAME_CONFIGURATION,
  components: MNEMO_BANKS.map((bank) =>
    quiz.bank({ id: bank.id, questions: bank.questions, shuffle: true }),
  ),
  shortcuts: [{ key: 'Space', type: 'action', actionType: 'draw' }],
  initialPhase: MNEMO_PHASES.initialPhase,
  phases: MNEMO_PHASES.phases,
  actions: MNEMO_ACTIONS,
  bot: GAME_BOT,
});
