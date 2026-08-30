import type { GameExecutionContext } from '../../../core/application/contracts/game-execution-context.model';
import type { EventVisibility } from '../../../core/application/contracts/game-event.model';
import {
  createCardsKitState,
  GameCardsController,
  type CardSetsDefinition,
  type CardValue,
  type DeckDefinition,
  type HandsDefinition,
} from '../cards/cards-kit';
import type { GameEffectInstruction } from '../effects/effects-kit';
import type { DeclarativeState } from './game-definition';
import type {
  GameComponentDefinition,
  GameComponentScope,
} from './component-kit';
import {
  createInventoryKitState,
  GameInventoryController,
  type InventoryDefinition,
} from '../kits/inventory-kit';
import {
  createEconomyKitState,
  GameEconomyController,
  type MarketDefinition,
} from '../kits/economy-kit';
import {
  createOwnershipKitState,
  GameOwnershipController,
  type OwnershipDefinition,
} from '../kits/ownership-kit';
import {
  createMovementKitState,
  GameMovementController,
  type TrackDefinition,
} from '../kits/movement-kit';
import {
  createPawnKitState,
  GamePawnController,
  type PawnSetDefinition,
} from '../kits/pawn-kit';
import {
  createDiceKitState,
  GameDiceController,
  type DiceDefinition,
} from '../kits/dice-kit';
import {
  createGridKitState,
  GameGridController,
  type GridDefinition,
} from '../kits/grid-kit';
import {
  createQuizKitState,
  GameQuizController,
  type QuizDefinition,
} from '../kits/quiz-kit';
import type {
  GameResourcesController,
  GameScoreController,
} from '../kits/player-values-kit';

type EmitDomainEvent = (
  type: string,
  data: Record<string, unknown>,
  visibility?: EventVisibility,
) => void;

/** Lazily creates only the optional component controllers used by a game. */
export class GameContextComponents<TState extends object> {
  private cardsController?: GameCardsController;
  private inventoryController?: GameInventoryController;
  private economyController?: GameEconomyController;
  private ownershipController?: GameOwnershipController;
  private movementController?: GameMovementController;
  private pawnController?: GamePawnController;
  private diceController?: GameDiceController;
  private gridController?: GameGridController;
  private quizController?: GameQuizController;

  constructor(
    private readonly runtime: DeclarativeState<TState>,
    private readonly execution: GameExecutionContext,
    private readonly definitions: readonly GameComponentDefinition[],
    private readonly emit: EmitDomainEvent,
    private readonly resources: () => GameResourcesController,
    private readonly score: () => GameScoreController,
    private readonly scheduleEffects: (
      ...effects: GameEffectInstruction[]
    ) => void,
    private readonly currentActorId: () => number | null,
  ) {}

  get cards(): GameCardsController {
    return (this.cardsController ??= new GameCardsController(
      (this.runtime.engine.kits.cards ??= createCardsKitState()),
      this.execution.rng,
      this.emit,
      this.ofType<
        DeckDefinition<CardValue> | HandsDefinition | CardSetsDefinition
      >((component) => component.component.startsWith('cards.')),
    ));
  }

  get inventory(): GameInventoryController {
    return (this.inventoryController ??= new GameInventoryController(
      (this.runtime.engine.kits.inventory ??= createInventoryKitState()),
      this.execution.rng,
      this.emit,
      this.ofType<InventoryDefinition>(
        (component) => component.component === 'inventory.set',
      ),
    ));
  }

  get economy(): GameEconomyController {
    return (this.economyController ??= new GameEconomyController(
      (this.runtime.engine.kits.economy ??= createEconomyKitState()),
      this.resources(),
      this.inventory,
      this.emit,
      this.ofType<MarketDefinition>(
        (component) => component.component === 'economy.market',
      ),
    ));
  }

  get ownership(): GameOwnershipController {
    return (this.ownershipController ??= new GameOwnershipController(
      (this.runtime.engine.kits.ownership ??= createOwnershipKitState()),
      this.emit,
      this.ofType<OwnershipDefinition>(
        (component) => component.component === 'ownership.registry',
      ),
    ));
  }

  get movement(): GameMovementController {
    return (this.movementController ??= new GameMovementController(
      (this.runtime.engine.kits.movement ??= createMovementKitState()),
      this.emit,
      this.ofType<TrackDefinition>(
        (component) => component.component === 'movement.track',
      ),
      this.scheduleEffects,
    ));
  }

  get pawns(): GamePawnController {
    return (this.pawnController ??= new GamePawnController(
      (this.runtime.engine.kits.pawns ??= createPawnKitState()),
      this.runtime.players ?? [],
      this.emit,
      this.ofType<PawnSetDefinition>(
        (component) => component.component === 'pawn.set',
      ),
    ));
  }

  get dice(): GameDiceController {
    return (this.diceController ??= new GameDiceController(
      (this.runtime.engine.kits.dice ??= createDiceKitState()),
      this.execution.rng,
      this.emit,
      this.ofType<DiceDefinition>(
        (component) => component.component === 'dice.set',
      ),
      this.currentActorId,
    ));
  }

  get grid(): GameGridController {
    return (this.gridController ??= new GameGridController(
      (this.runtime.engine.kits.grid ??= createGridKitState()),
      this.ofType<GridDefinition>(
        (component) => component.component === 'grid.board',
      ),
    ));
  }

  get quiz(): GameQuizController {
    return (this.quizController ??= new GameQuizController(
      (this.runtime.engine.kits.quiz ??= createQuizKitState()),
      this.execution.rng,
      this.ofType<QuizDefinition>(
        (component) => component.component === 'quiz.bank',
      ),
      this.emit,
      (playerId, amount) => this.score().add(playerId, amount),
    ));
  }

  assertValid(): void {
    const kits = this.runtime.engine.kits;
    if (kits.cards) this.cards.assertValid();
    if (kits.inventory) this.inventory.assertValid();
    if (kits.economy) this.economy.assertValid();
    if (kits.ownership) this.ownership.assertValid();
    if (kits.movement) this.movement.assertValid();
    if (kits.pawns) this.pawns.assertValid();
    if (kits.dice) this.dice.assertValid();
    if (kits.grid) this.grid.assertValid();
    if (kits.quiz) this.quiz.assertValid();
  }

  private ofType<TDefinition extends GameComponentDefinition>(
    predicate: (component: GameComponentDefinition) => boolean,
  ): (TDefinition & { readonly scope?: GameComponentScope })[] {
    return this.definitions.filter(predicate) as (TDefinition & {
      readonly scope?: GameComponentScope;
    })[];
  }
}
