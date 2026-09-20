import { GameWsStateMessagesPresenter } from './game-ws-state-messages.presenter';

describe('GameWsStateMessagesPresenter', () => {
  it('explains each Mnémosyne quiz answer and reveals the correct answer', () => {
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
        players: { all: [{ id: 1, username: 'Lila' }, { id: -2, username: 'Milou' }] },
        events: { recent: [event], latestByType: { 'game.message': event } },
      },
      1,
      {} as never,
    );

    expect((state.events as any).recent[0].data.message).toBe(
      'Vous avez donné la bonne réponse « Paris ». Vous gagnez 2 points.\n' +
        'Milou a donné une mauvaise réponse (« Lyon »). La bonne réponse était « Paris ». Milou perd 1 point.',
    );
  });
});
