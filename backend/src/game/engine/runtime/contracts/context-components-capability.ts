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
  readonly cards: PublicController<
    GameCardsController,
    | 'zone'
    | 'moveCard'
    | 'putInZone'
    | 'takeFromZone'
    | 'give'
    | 'play'
    | 'hand'
    | 'take'
    | 'discardFromHand'
    | 'exchange'
    | 'shuffleHands'
    | 'transfer'
    | 'exchangeRandom'
    | 'stealRandom'
    | 'swapHands'
    | 'discardRandom'
    | 'handCounts'
    | 'setIds'
    | 'missingFromSet'
    | 'completableSets'
    | 'completeSet'
    | 'playerCompletedSets'
    | 'completedSetCounts'
    | 'deal'
    | 'deckCards'
    | 'takeFromDeck'
    | 'discard'
    | 'deckCount'
    | 'discardCount'
    | 'discardPile'
    | 'takeDiscard'
    | 'draw'
    | 'drawOrRecycle'
    | 'drawToHand'
    | 'drawManyToHand'
    | 'drawThenResolve'
    | 'recycle'
    | 'putOnTop'
    | 'createDeck'
    | 'createHands'
    | 'createSets'
    | 'createZone'
    | 'removeDeck'
    | 'resetHands'
    | 'resetSets'
    | 'resetZone'
    | 'shuffle'
    | 'resetDeck'
    | 'clearHands'
  >;
  readonly inventory: PublicController<
    GameInventoryController,
    | 'exchange'
    | 'transfer'
    | 'exchangeRandom'
    | 'stealRandom'
    | 'create'
    | 'reset'
    | 'items'
    | 'add'
    | 'assertCanAdd'
    | 'remove'
    | 'has'
    | 'quantity'
    | 'count'
    | 'counts'
    | 'quantities'
    | 'swap'
    | 'removeRandom'
  >;
  readonly economy: PublicController<
    GameEconomyController,
    | 'create'
    | 'reset'
    | 'price'
    | 'prices'
    | 'setPrice'
    | 'adjustPrice'
    | 'canAfford'
    | 'canSell'
    | 'buy'
    | 'sell'
    | 'pay'
    | 'transferPayment'
    | 'inventoryValue'
    | 'netWorth'
  >;
  readonly ownership: PublicController<
    GameOwnershipController,
    | 'transfer'
    | 'create'
    | 'reset'
    | 'ownersOf'
    | 'ownerOf'
    | 'isOwned'
    | 'isOwner'
    | 'claim'
    | 'release'
    | 'assetsOf'
    | 'releaseAll'
  >;
  readonly movement: PublicController<
    GameMovementController,
    | 'swap'
    | 'createTrack'
    | 'resetTrack'
    | 'position'
    | 'positions'
    | 'finishPosition'
    | 'atFinish'
    | 'distanceToFinish'
    | 'inHomeStretch'
    | 'preview'
    | 'move'
    | 'resolveLanding'
    | 'moveAndResolve'
    | 'moveTo'
  >;
  readonly pawns: PublicController<
    GamePawnController,
    | 'create'
    | 'reset'
    | 'position'
    | 'inHomeStretch'
    | 'move'
    | 'moveTo'
    | 'definitions'
    | 'perPlayer'
    | 'available'
    | 'assigned'
    | 'owner'
    | 'assign'
    | 'selectionComplete'
    | 'legalMoves'
    | 'applyMove'
    | 'applyRaceMove'
  >;
  readonly dice: PublicController<
    GameDiceController,
    'create' | 'reset' | 'roll' | 'rollWith' | 'bestOf' | 'worstOf' | 'last'
  >;
  readonly grid: PublicController<
    GameGridController,
    | 'create'
    | 'reset'
    | 'inside'
    | 'get'
    | 'set'
    | 'clear'
    | 'entries'
    | 'overlays'
    | 'setOverlays'
    | 'appendOverlay'
    | 'full'
    | 'emptyCells'
    | 'lineWinner'
    | 'neighbors'
  >;
  readonly quiz: PublicController<
    GameQuizController,
    | 'create'
    | 'reset'
    | 'next'
    | 'check'
    | 'ask'
    | 'answer'
    | 'reveal'
    | 'advance'
    | 'close'
    | 'session'
  >;
}
