import type { GameContext } from './game-author-context';
import type { GameContext as RuntimeContext } from '../game-rule-context';
import type { ContextSchedulingCapability } from '../contracts/context-scheduling-capability';
import type { ContextEffectCapability } from '../contracts/context-effect-capability';

type Hidden =
  | 'enterCurrentPhase'
  | 'consumeEvents'
  | 'assertValidKits'
  | 'runBeforeCurrentTurnHook'
  | 'effects';
type Controllers =
  | 'ranking'
  | 'choice'
  | 'match'
  | 'round'
  | 'score'
  | 'resources'
  | 'counters'
  | 'status'
  | 'config'
  | 'submissions'
  | 'submissionFlow'
  | 'judge'
  | 'voting'
  | 'scheduler'
  | 'cards'
  | 'inventory'
  | 'economy'
  | 'ownership'
  | 'movement'
  | 'pawns'
  | 'dice'
  | 'grid'
  | 'quiz';
/** The old mapped author surface, retained only as a compatibility assertion. */
type PreviousAuthorContract<TState extends object> = {
  readonly [
    K in Exclude<keyof RuntimeContext<TState>, Hidden>
  ]: K extends Controllers
    ? Pick<RuntimeContext<TState>[K], keyof RuntimeContext<TState>[K]>
    : RuntimeContext<TState>[K];
} & {
  readonly effects: Pick<
    RuntimeContext<TState>['effects'],
    keyof ContextEffectCapability
  >;
};
type Equivalent<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;
const contractMatches: Equivalent<
  GameContext<{ score: number }>,
  PreviousAuthorContract<{ score: number }>
> = true;

function implementsAuthorContract(
  context: RuntimeContext<{ score: number }>,
): GameContext<{ score: number }> {
  return context;
}
function authorCannotOrchestrateRuntime(
  context: GameContext<{ score: number }>,
) {
  context.turn.end();
  context.effects.run({ kind: 'gain-score', amount: 1 });
  // @ts-expect-error lifecycle orchestration belongs to runtime
  context.enterCurrentPhase();
  // @ts-expect-error internal continuation control is not an author effect command
  context.effects.continue();
  // @ts-expect-error debug snapshots are not an author effect command
  context.effects.debugSnapshot();
  // @ts-expect-error author capability slots remain readonly
  context.transitionTo = () => {};
}
function acceptsIndependentScheduling(capability: ContextSchedulingCapability) {
  return capability.scheduler;
}
function acceptsIndependentEffects(capability: ContextEffectCapability) {
  return capability.source();
}
void implementsAuthorContract;
void authorCannotOrchestrateRuntime;
void acceptsIndependentScheduling;
void acceptsIndependentEffects;

it('keeps author commands structurally separate from runtime orchestration', () => {
  // Negative author API assertions above are checked by the repository typecheck.
  expect(contractMatches).toBe(true);
});
