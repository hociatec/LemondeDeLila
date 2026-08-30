import { GameContentValidationError } from '../../../core/domain/errors/game-domain.errors';
import {
  boardContent,
  cardContent,
  defineGameContent,
  quizContent,
  trackContent,
} from './game-content';

describe('game content boundaries', () => {
  it('validates duplicate ids through the specialized catalogue boundaries', () => {
    expect(() =>
      cardContent([
        { id: 'same', label: 'first' },
        { id: 'same', label: 'second' },
      ]),
    ).toThrow(GameContentValidationError);

    expect(
      defineGameContent('card-copies', {
        cards: [{ id: 'same' }, { id: 'same' }],
      }).data.cards,
    ).toHaveLength(2);
  });

  it('freezes and validates specialized catalogues', () => {
    const cards = cardContent([{ id: 'card-1', label: 'Card' }]);
    const quiz = quizContent([
      {
        id: 'quiz-1',
        prompt: 'Question?',
        choices: ['A', 'B'],
        answerIndex: 0,
      },
    ]);
    const board = boardContent([
      { id: 'start', links: ['finish'] },
      { id: 'finish', links: [] },
    ]);
    const track = trackContent([{ id: 0 }, { id: 1 }]);

    expect(Object.isFrozen(cards[0])).toBe(true);
    expect(Object.isFrozen(quiz[0])).toBe(true);
    expect(Object.isFrozen(board[0])).toBe(true);
    expect(Object.isFrozen(track[0])).toBe(true);
  });
});
