import type { GameCardsController } from '../cards/cards-kit';
import type { GameInventoryController } from '../kits/inventory-kit';
import type { GameEconomyController } from '../kits/economy-kit';
import type { GameOwnershipController } from '../kits/ownership-kit';
import type { GameMovementController } from '../kits/movement-kit';
import type { GamePawnController } from '../kits/pawn-kit';
import type { GameDiceController } from '../kits/dice-kit';
import type { GameGridController } from '../kits/grid-kit';
import type { GameQuizController } from '../kits/quiz-kit';
import type { PublicController } from './public-controller';

export interface ContextComponentsCapability {
  readonly cards: PublicController<GameCardsController>;
  readonly inventory: PublicController<GameInventoryController>;
  readonly economy: PublicController<GameEconomyController>;
  readonly ownership: PublicController<GameOwnershipController>;
  readonly movement: PublicController<GameMovementController>;
  readonly pawns: PublicController<GamePawnController>;
  readonly dice: PublicController<GameDiceController>;
  readonly grid: PublicController<GameGridController>;
  readonly quiz: PublicController<GameQuizController>;
}
