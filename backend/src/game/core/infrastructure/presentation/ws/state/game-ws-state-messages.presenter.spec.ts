import { GameWsStateMessagesPresenter } from './game-ws-state-messages.presenter';
import { presentedEvents } from '../../../../../testing/helpers/presented-state-assertions';

describe('GameWsStateMessagesPresenter', () => {
  it('announces a die result without an article before the value', () => {
    const event = {
      id: 'dice-roll:0',
      type: 'game.message',
      data: {
        key: 'game.dice.rolled',
        params: { playerId: 2, total: 1 },
      },
    };
    const state = new GameWsStateMessagesPresenter().withServerMessages(
      {
        match: { status: 'playing' },
        players: {
          all: [
            { id: 1, username: 'Lila' },
            { id: 2, username: 'Noé' },
          ],
        },
        events: {
          recent: [event],
          latestByType: { 'game.message': event },
        },
      },
      1,
      {} as never,
    );

    expect(presentedEvents(state.events).recent[0].data.message).toBe(
      'Noé lance le dé et fait 1.',
    );
  });

  it('names played battle cards and announces a battle', () => {
    const presenter = new GameWsStateMessagesPresenter();
    const placed = {
      id: 'placed',
      type: 'game.message',
      data: {
        key: 'game.card.battle.card-placed',
        params: { playerId: 1 },
        narration: {
          default: 'Lila pose une carte sur la table.',
          byPlayerId: { 1: 'Vous posez une carte sur la table.' },
        },
      },
    };
    const battle = {
      id: 'battle',
      type: 'game.message',
      data: {
        key: 'game.card.battle.started',
        params: {},
        narration: { default: 'Égalité : une bataille commence.' },
      },
    };
    const state = presenter.withServerMessages(
      {
        match: { status: 'playing' },
        players: {
          all: [
            { id: 1, username: 'Lila' },
            { id: 2, username: 'Noé' },
          ],
        },
        events: {
          recent: [placed, battle],
          latestByType: { 'game.message': battle },
        },
      },
      1,
      {} as never,
    );
    expect(
      presentedEvents(state.events).recent.map((event) => event.data.message),
    ).toEqual([
      'Vous posez une carte sur la table.',
      'Égalité : une bataille commence.',
    ]);
  });
  it('leaves quiz activity to the question workflow', () => {
    const messages = [
      {
        id: 'quiz:0',
        type: 'game.message',
        data: { key: 'game.quiz.started', params: { playerId: 1 } },
      },
      {
        id: 'quiz:1',
        type: 'game.message',
        data: { key: 'game.quiz.answer-recorded', params: { playerId: -2 } },
      },
    ];
    const state = new GameWsStateMessagesPresenter().withServerMessages(
      {
        match: { status: 'playing' },
        players: {
          all: [
            { id: 1, username: 'Lila' },
            { id: -2, username: 'Milou' },
          ],
        },
        events: {
          recent: messages,
          latestByType: { 'game.message': messages[1] },
        },
      },
      1,
      {} as never,
    );

    expect(
      presentedEvents(state.events).recent.map((event) => event.data.message),
    ).toEqual([undefined, undefined]);
  });

  it('does not repeat the correct answer to a player who answered correctly', () => {
    const event = {
      id: 'quiz-result:0',
      type: 'game.message',
      data: {
        key: 'game.quiz.resolved',
        params: {
          correctAnswer: 'Paris',
          results: [
            { playerId: 1, outcome: 'correct', answer: 'Paris', points: 2 },
            { playerId: -2, outcome: 'wrong', answer: 'Lyon', points: -1 },
          ],
        },
      },
    };
    const state = new GameWsStateMessagesPresenter().withServerMessages(
      {
        match: { status: 'playing' },
        players: {
          all: [
            { id: 1, username: 'Lila' },
            { id: -2, username: 'Milou' },
          ],
        },
        events: { recent: [event], latestByType: { 'game.message': event } },
      },
      1,
      {} as never,
    );

    expect(
      presentedEvents(state.events).recent[0].data.message,
    ).toBeUndefined();

    const wrongViewer = new GameWsStateMessagesPresenter().withServerMessages(
      state,
      -2,
      {} as never,
    );
    expect(presentedEvents(wrongViewer.events).recent[0].data.message).toBe(
      'La bonne réponse était « Paris ».',
    );
  });

  it('publishes viewer-specific sound semantics without client-side inference', () => {
    const reveal = {
      id: 'quiz-reveal:0',
      type: 'quiz.revealed',
      data: {
        sessionId: 'quiz-1',
        correctAnswerIndex: 1,
        answers: { '1': 1, '2': 0 },
      },
    };
    const duplicate = {
      id: 'quiz-message:0',
      type: 'game.message',
      data: {
        key: 'game.quiz.answered',
        params: { sessionId: 'quiz-1', playerId: 1, correct: true },
      },
    };
    const wall = {
      id: 'wall:0',
      type: 'game.message',
      data: { key: 'game.grid.wall.placed', params: { playerId: 1 } },
    };
    const state = new GameWsStateMessagesPresenter().withServerMessages(
      {
        match: { status: 'playing' },
        players: { all: [{ id: 1, username: 'Lila' }] },
        events: {
          recent: [reveal, duplicate, wall],
          latestByType: { 'quiz.revealed': reveal, 'game.message': wall },
        },
      },
      1,
      {} as never,
    );
    expect(
      presentedEvents(state.events).recent.map((event) => event.soundSemantic),
    ).toEqual(['quiz.correct', undefined, 'wall.placed']);
  });
});
