export type GameSelector<TState extends object, TResult> = (
  state: TState,
) => TResult;

/**
 * Declares a derived value without adding it to the persisted session state.
 * Keeping selectors as plain functions makes them usable from views, bots and
 * rules without coupling them to the runtime.
 */
export function defineSelector<TState extends object, TResult>(
  select: GameSelector<TState, TResult>,
): GameSelector<TState, TResult> {
  return select;
}

/**
 * Memoizes a selector against explicit dependencies. Dependencies should be
 * primitive values or immutable references; this keeps caching correct even
 * though game rules use controlled in-place mutation.
 */
export function memoizeSelector<
  TState extends object,
  TDependencies extends readonly unknown[],
  TResult,
>(
  dependencies: (state: TState) => TDependencies,
  project: (state: TState) => TResult,
): GameSelector<TState, TResult> {
  let initialized = false;
  let previousDependencies: TDependencies | null = null;
  let previousResult: TResult;

  return (state) => {
    const nextDependencies = dependencies(state);
    if (
      initialized &&
      previousDependencies?.length === nextDependencies.length &&
      nextDependencies.every((value, index) =>
        Object.is(value, previousDependencies?.[index]),
      )
    ) {
      return previousResult;
    }
    previousDependencies = nextDependencies;
    previousResult = project(state);
    initialized = true;
    return previousResult;
  };
}

/** Combines named selectors while retaining each result type. */
export function selectAll<
  TState extends object,
  TSelectors extends Readonly<Record<string, GameSelector<TState, unknown>>>,
>(
  selectors: TSelectors,
  state: TState,
): { [TKey in keyof TSelectors]: ReturnType<TSelectors[TKey]> } {
  return Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [key, selector(state)]),
  ) as { [TKey in keyof TSelectors]: ReturnType<TSelectors[TKey]> };
}
