import type { PlayerStateEntity } from '../models/game-state.model';
import type { GameRuleContext } from './game-rule-context';
import type { DeckDefinition, HandsDefinition } from './cards-kit';
import type { DiceDefinition } from './dice-kit';
import type { GridDefinition } from './grid-kit';
import type { TrackDefinition } from './movement-kit';
import type { QuizDefinition } from './quiz-kit';

export type GameComponentDefinition =
  | DeckDefinition<unknown>
  | HandsDefinition
  | DiceDefinition
  | GridDefinition
  | TrackDefinition
  | QuizDefinition;

export function installGameComponents<TState extends object>(
  components: readonly GameComponentDefinition[],
  players: readonly PlayerStateEntity[],
  context: GameRuleContext<TState>,
): void {
  for (const component of components) {
    if (component.component === 'cards.deck')
      context.cards.createDeck(component);
    else if (component.component === 'cards.hands') {
      context.cards.createHands(
        component,
        players.map((player) => player.id),
      );
    } else if (component.component === 'movement.track') {
      context.movement.createTrack(component);
    } else if (component.component === 'dice.set')
      context.dice.create(component);
    else if (component.component === 'grid.board')
      context.grid.create(component);
    else if (component.component === 'quiz.bank')
      context.quiz.create(component);
  }
}
