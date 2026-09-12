import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type { GamePresentation } from '../contracts/author-rule-contracts';
import type { JsonProgramExtensions } from '../extensions/json-program-extension-contract';
import type { ContentSnapshotMigration } from '../content/game-content';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { JsonGameAction, JsonGameVictory } from './json-game-action-types';
import type { JsonGamePattern } from './json-game-patterns';

export type JsonGameDocument = JsonProgramExtensions & {
  schemaVersion: 1;
  contentVersion: string;
  definitionVersion: string;
  snapshotMigrations?: readonly ContentSnapshotMigration[];
  category: string;
  world: string;
  presentation?: GamePresentation;
  patterns?: readonly JsonGamePattern[];
  shortcuts?: readonly GameShortcutHint[];
  components: readonly Extract<
    GameComponentDefinition,
    {
      component:
        | 'cards.deck'
        | 'cards.hands'
        | 'cards.sets'
        | 'movement.track'
        | 'dice.set'
        | 'inventory.set'
        | 'ownership.registry'
        | 'pawn.set'
        | 'quiz.bank'
        | 'collection.view';
    }
  >[];
  setup: Pick<
    GameInitialization,
    | 'firstPlayer'
    | 'startRound'
    | 'scores'
    | 'resources'
    | 'counters'
    | 'tracks'
    | 'pawns'
    | 'deals'
    | 'gridPlacements'
  >;
  resourceIds: readonly string[];
  initialPhase: string;
  phases: Readonly<
    Record<
      string,
      {
        actions: readonly string[];
        terminal?: boolean;
        transitions?: readonly string[];
      }
    >
  >;
  actions: Readonly<Record<string, JsonGameAction>>;
  victory: JsonGameVictory;
};
