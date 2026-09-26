import { GameWsStateMessagesPresenter } from './game-ws-state-messages.presenter';
import { presentedEvents } from '../../../../../testing/helpers/presented-state-assertions';

describe('GameWsStateMessagesPresenter', () => {
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

    expect(presentedEvents(state.events).recent[0].data.message).toBeUndefined();

    const wrongViewer = new GameWsStateMessagesPresenter().withServerMessages(
      state,
      -2,
      {} as never,
    );
    expect(presentedEvents(wrongViewer.events).recent[0].data.message).toBe(
      'La bonne réponse était « Paris ».',
    );
  });
});
