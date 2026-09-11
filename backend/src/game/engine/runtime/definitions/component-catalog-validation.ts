import type { ValidationFailure } from '../contracts/definition-validation';
import { cards } from '../cards/cards-contracts';
import { diceKit } from '../kits/dice-kit';
import { economy } from '../kits/economy-kit';
import { grid } from '../kits/grid-kit';
import { inventory } from '../kits/inventory-kit';
import { movement } from '../kits/movement-kit';
import { ownership } from '../kits/ownership-kit';
import { pawns } from '../kits/pawn-kit';
import { quiz } from '../kits/quiz-kit';
import type { GameComponentDefinition } from './component-kit';

/** Direct component literals must satisfy the same contracts as author factories. */
export function assertComponentCatalog(
  component: GameComponentDefinition,
  fail: ValidationFailure,
): void {
  try {
    switch (component.component) {
      case 'cards.deck':
        cards.deck(component);
        break;
      case 'dice.set':
        diceKit(component);
        break;
      case 'economy.market':
        economy.market(component);
        break;
      case 'grid.board':
        grid.board(component);
        break;
      case 'inventory.set':
        inventory.set(component);
        break;
      case 'movement.track':
        movement.track(component);
        break;
      case 'ownership.registry':
        ownership.registry(component);
        break;
      case 'pawn.set':
        pawns.set(component);
        break;
      case 'quiz.bank':
        quiz.bank(component);
        break;
    }
  } catch (error) {
    fail(
      `components.${component.id}`,
      error instanceof Error ? error.message : 'Invalid component catalog',
    );
  }
}
