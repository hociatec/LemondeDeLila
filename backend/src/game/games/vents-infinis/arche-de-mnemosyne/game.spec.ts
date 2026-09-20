import { compileJsonGame } from '../../../engine/json/public-api';
import { DeclarativeGameRuntime } from '../../../engine/runtime/declarative-game.runtime';
import { describeGameDefinition } from '../../../engine/runtime/definitions/runtime-descriptor';
import { testGame } from '../../../engine/testing/public-api';
import document from './game.json';
import manifest from './manifest.json';
import quiz from './quiz.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/quiz.json': quiz,
});
const MNEMO_SESSION = 'choice-simultaneous-quiz.current';

describe('Arche de Mnémosyne declarative game', () => {
  it('presents every playable category alphabetically with its human name', () => {
    const descriptor = describeGameDefinition(gameDefinition).actions.find(
      (action) => action.type === 'game.configure',
    );
    const input = descriptor?.input as
      | { properties?: Record<string, unknown> }
      | undefined;
    const category = input?.properties?.categoryId as {
      label?: string;
      values?: string[];
      choiceLabels?: Record<string, string>;
    };

    expect(category).toMatchObject({
      label: 'Catégorie de questions',
      values: [
        'all',
        'a-la-croisee-des-mondes',
        'accelere',
        'globe-trotter-gourmand',
        'harmonie-quiz',
        'l-esprit-nomade',
        'la-tete-de-sanglier',
        'le-tournoi-des-plumes',
        'seve-et-savoir',
      ],
      choiceLabels: {
        all: 'Toutes les catégories',
        accelere: 'Accélère',
        'la-tete-de-sanglier': 'La Tête de sanglier',
      },
    });
    expect(input?.properties).toMatchObject({
      questionsPerRound: { label: 'Questions par manche', initialText: '5' },
      targetPoints: { label: 'Score à atteindre', initialText: '20' },
      useTimer: { label: 'Utiliser un chronomètre', initialText: 'true' },
      timerSeconds: { label: 'Durée d’une question (secondes)' },
      interQuestionSeconds: {
        label: 'Pause entre deux questions (secondes)',
      },
    });
  });

  it('keeps correctness private and resolves simultaneous answers deterministically', async () => {
    const game = testGame(gameDefinition).players(['Lila', 'Mina']).seed(127);
    await game.start();
    await game.as(1).do('game.configure', {
      categoryId: 'all',
      questionsPerRound: 5,
      targetPoints: 20,
      useTimer: false,
      timerSeconds: 30,
      interQuestionSeconds: 0,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    });
    await game.as(1).do('draw', {});
    await game.as(1).do('answer', { answerIndex: 0 });
    await game.as(2).do('answer', { answerIndex: 1 });
    expect('correctnessByPlayerId' in game.view(1)).toBe(false);
    expect('deadlineMs' in game.view(1)).toBe(false);
    const view = game.view(1) as unknown as {
      kits: { quiz: { sessions: Record<string, { phase: string }> } };
    };
    expect('currentQuestion' in game.view(1)).toBe(false);
    expect(view.kits.quiz.sessions[MNEMO_SESSION]?.phase).toBe('closed');
    expect(await game.replay()).toEqual(game.state());
  });

  it('offers an answer to a bot during a simultaneous question', async () => {
    const game = testGame(gameDefinition)
      .players(['Lila', { username: 'Bot', isBot: true }])
      .seed(127);
    await game.start();
    await game.as(1).do('game.configure', {
      categoryId: 'all',
      questionsPerRound: 5,
      targetPoints: 20,
      useTimer: false,
      timerSeconds: 30,
      interQuestionSeconds: 0,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    });
    await game.as(1).do('draw', {});

    expect(
      new DeclarativeGameRuntime(gameDefinition).getBotActions(
        game.state(),
        -2,
      ),
    ).toEqual([expect.objectContaining({ type: 'answer' })]);
  });

  it('rotates the question drawer only after the configured questions per round', async () => {
    const game = testGame(gameDefinition)
      .players(['Lila', { username: 'Bot', isBot: true }])
      .seed(127);
    await game.start();
    await game.as(1).do('game.configure', {
      categoryId: 'all',
      questionsPerRound: 5,
      targetPoints: 50,
      useTimer: false,
      timerSeconds: 30,
      interQuestionSeconds: 0,
      correctSoloPoints: 2,
      correctMultiPoints: 1,
      wrongPoints: 0,
      timeoutPoints: -1,
    });
    for (let question = 0; question < 5; question += 1) {
      await game.as(1).do('draw', {});
      await game.as(1).do('answer', { answerIndex: 0 });
      await game.as(-2).do('answer', { answerIndex: 1 });
      game.advanceTime(1_000);
      if (question < 4) expect(game.availableActions(1)).toContain('draw');
    }

    const state = game.state() as unknown as {
      engine: { round: { number: number; starterPlayerId: number } };
    };
    expect(state.engine.round).toMatchObject({ number: 2, starterPlayerId: -2 });
    expect(
      new DeclarativeGameRuntime(gameDefinition).getBotActions(
        game.state(),
        -2,
      ),
    ).toEqual([expect.objectContaining({ type: 'draw' })]);
  });
});
