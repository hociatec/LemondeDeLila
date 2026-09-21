import { createHash } from 'node:crypto';
import type { GameRuntime } from '../../../core/application/ports/game-runtime.port';
import type { GameState } from '../../../core/application/models/game-state.model';

type ContentState = GameState & {
  contentSnapshot?: object;
  contentVersion?: string;
};

/** Pin editable content to each session so edits cannot change an ongoing quiz. */
export function contentBackedRuntime(
  fallback: GameRuntime,
  readSource: () => object,
  compile: (source: object) => GameRuntime,
  archive: { save(source: object): string; load(version: string): object },
): GameRuntime {
  const cache = new Map<string, GameRuntime>();
  const sourceKeys = new WeakMap<object, string>();
  const runtimeForSource = (source: object): GameRuntime => {
    const key =
      sourceKeys.get(source) ??
      createHash('sha256').update(JSON.stringify(source)).digest('hex');
    sourceKeys.set(source, key);
    const cached = cache.get(key);
    if (cached) return cached;
    const runtime = compile(source);
    cache.set(key, runtime);
    if (cache.size > 8) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return runtime;
  };
  const forState = (state: ContentState): GameRuntime =>
    state.contentVersion
      ? (cache.get(state.contentVersion) ??
        runtimeForSource(archive.load(state.contentVersion)))
      : state.contentSnapshot
        ? runtimeForSource(state.contentSnapshot)
        : fallback;
  return {
    gameType: fallback.gameType,
    category: fallback.category,
    subcategory: fallback.subcategory,
    displayName: fallback.displayName,
    description: fallback.description,
    minPlayers: fallback.minPlayers,
    maxPlayers: fallback.maxPlayers,
    hydrateInitialState: (state, context) => {
      const source = readSource();
      const runtime = runtimeForSource(source);
      const contentVersion = archive.save(source);
      const initial: ContentState = {
        ...runtime.hydrateInitialState(state, context),
        contentVersion,
      };
      return initial;
    },
    validateAction: (state, action, actor, context) =>
      forState(state).validateAction(state, action, actor, context),
    validateActor: (state, actions, actor, context) =>
      forState(state).validateActor(state, actions, actor, context),
    applyActions: (state, actions, context) => {
      const next: ContentState = forState(state).applyActions(
        state,
        actions,
        context,
      );
      if (next.contentSnapshot && !next.contentVersion) {
        next.contentVersion = archive.save(next.contentSnapshot);
        delete next.contentSnapshot;
      }
      return next;
    },
    getAvailableActions: (state, player, context) =>
      forState(state).getAvailableActions(state, player, context),
    getActionCandidates: (state, player, action, options, context) =>
      forState(state).getActionCandidates(
        state,
        player,
        action,
        options,
        context,
      ),
    exposeStateForUser: (state, player, context) =>
      forState(state).exposeStateForUser(state, player, context),
    getBotActions: (state, player, context) =>
      forState(state).getBotActions(state, player, context),
    getAutomaticActions: (state) => forState(state).getAutomaticActions(state),
    getShortcuts: (context) => fallback.getShortcuts(context),
    getDescriptor: () => {
      try {
        return runtimeForSource(readSource()).getDescriptor();
      } catch {
        return fallback.getDescriptor();
      }
    },
  };
}
