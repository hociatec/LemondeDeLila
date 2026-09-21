import { GameWsStateMessagesPresenter } from './game-ws-state-messages.presenter';

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
      (state.events as any).recent.map((event: any) => event.data.message),
    ).toEqual([undefined, undefined]);
  });

  it('announces the revealed correct answer once in the history', () => {
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

    expect((state.events as any).recent[0].data.message).toBe(
      'La bonne réponse était « Paris ».',
    );
  });
});
