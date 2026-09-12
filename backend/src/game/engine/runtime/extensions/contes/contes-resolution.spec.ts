import { contesLaughterWinners } from './contes-laughter';

it('keeps declared participant order when laughter answers are tied', () => {
  expect(
    contesLaughterWinners([-1, -2, -3], {
      [-2]: 3,
      [-1]: 3,
      [-3]: 1,
    }),
  ).toEqual([-1, -2]);
});
