import type { PublicController } from './public-controller';
import type { GameContext } from '../../sdk/public-api';

it('keeps runtime additions out of the stable author capability', () => {
  class Implementation {
    read(): number {
      return 3;
    }
    internalOptimization(): number {
      return 4;
    }
  }
  const capability: PublicController<Implementation, 'read'> =
    new Implementation();
  expect(capability.read()).toBe(3);
  const compileChecks = (ctx: GameContext<object>) => {
    // @ts-expect-error A new runtime method is not automatically an author API.
    capability.internalOptimization();
    // @ts-expect-error Validation of persisted storage belongs to runtime orchestration.
    ctx.cards.assertValid();
    // @ts-expect-error Mutable storage is not an author capability.
    ctx.movement.state.positions = {};
  };
  expect(typeof compileChecks).toBe('function');
});
