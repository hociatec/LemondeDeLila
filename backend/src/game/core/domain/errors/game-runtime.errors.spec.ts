import {
  GameActionRejectedError,
  GameConfigurationError,
  GameDomainError,
} from '../../../engine/runtime/contracts/game-domain.errors';
import {
  GameCorruptedStateError,
  GameInvariantViolationError,
} from './game-runtime.errors';

it('distinguishes configuration, invalid actions, corrupted state and violated invariants', () => {
  const errors = [
    new GameConfigurationError('bad config'),
    new GameActionRejectedError('bad action'),
    new GameCorruptedStateError('bad state', { field: 'battle' }),
    new GameInvariantViolationError('missing attribute', {
      attribute: 'destination',
    }),
  ];
  expect(new Set(errors.map((error) => error.code)).size).toBe(4);
  for (const error of errors) {
    expect(error).toBeInstanceOf(GameDomainError);
    expect(error.presentToClient).toBe('code');
    expect(error.name).toBe(error.constructor.name);
  }
  expect(errors[2].details).toEqual({ field: 'battle' });
  expect(errors[3].details).toEqual({ attribute: 'destination' });
});
