import type { GameActionShape } from '../contracts/author-rule-contracts';
import { defineAction } from './game-definition-builders';
import { gameInput } from '../actions/game-input-schema';
import { cardSelectionRules } from '../recipes/gameplay/card-selection.recipes';
import type { CompiledJsonPrograms } from './json-game-program-compiler';
import type { JsonGameDocument } from './json-game-schema';

type JsonFailure = (path: string, reason: string) => never;

export function compileJsonActions(
  document: JsonGameDocument,
  programs: CompiledJsonPrograms,
  fail: JsonFailure,
) {
  const actions: Record<
    string,
    GameActionShape<Record<string, never>>
  > = Object.fromEntries(
    Object.entries(document.actions).map(([id, action]) => {
      const compiled =
        'selectCards' in action
          ? cardSelectionRules(action.selectCards).action
          : 'recipe' in action
            ? ((programs.actions[action.recipe] as
                GameActionShape<Record<string, never>> | undefined) ??
              fail(`actions.${id}`, 'recipe program required'))
            : defineAction<Record<string, never>, Record<string, never>>({
                input: gameInput.object({}),
                execute: ({ ctx }) => ctx.effects.run(...action.effects),
              });
      return [
        id,
        action.documentation === undefined
          ? compiled
          : { ...compiled, documentation: action.documentation },
      ];
    }),
  );
  return actions;
}
