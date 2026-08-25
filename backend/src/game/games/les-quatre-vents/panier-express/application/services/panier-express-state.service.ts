import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type {
  PanierExpressMetadata,
  PanierExpressPlayer,
  PanierExpressTile,
} from '../../model/panier-express-state.model';
import {
  getPanierExpressMetadata,
  getPanierExpressPlayers,
} from '../../panier-express-access.helpers';
import { ensureShoppingLists } from '../../panier-express.shopping';
import {
  ensurePanierExpressQuizOutcome,
  ensurePanierExpressPlayerLaps,
  ensurePanierExpressPlayerPositions,
  hydratePanierExpressMetadataCollections,
  mergePanierExpressDecks,
  mergePanierExpressMetadataWithDefaults,
  mergePanierExpressStatuses,
} from '../../panier-express-metadata.helpers';
import { PanierExpressSetupService } from './panier-express-setup.service';
import { PanierExpressUtils } from './panier-express-utils.service';

@Injectable()
export class PanierExpressStateService {
  private static readonly SHOPPING_LIST_SIZE = 3;

  constructor(
    private readonly setup: PanierExpressSetupService,
    private readonly utils: PanierExpressUtils,
  ) {}

  buildMetadata(baseState: GameStateEntity): PanierExpressMetadata {
    return {
      stands: this.standIds(),
      tiles: this.setup.buildTiles(),
      decks: this.setup.buildDeckPool(baseState),
      shoppingLists: {},
      positions: {},
      laps: {},
      winnerId: null,
      quiz: { pending: {} },
      quizOutcome: {},
      actionLog: [],
      botProfile: 'greedy',
      movementDirection: 1,
      movementDirectionOwnerId: null,
      lastObtainedCourse: {},
      discards: { courses: [] },
      statuses: {
        skipTurn: {},
        keepTurn: {},
        revealInventory: {},
        revealShoppingList: {},
        noDrawCourses: {},
      },
    };
  }

  standIds(): string[] {
    const ids = new Set<string>();
    this.setup
      .buildTiles()
      .filter((tile) => tile.type === 'stand')
      .forEach((tile) => ids.add(tile.standId));
    return Array.from(ids.values());
  }

  buildTiles(): PanierExpressTile[] {
    return this.setup.buildTiles();
  }

  ensureMetadata(state: GameStateEntity): GameStateEntity {
    const normalizedPlayers = this.utils.normalizePlayers(state.players);
    const merged = mergePanierExpressMetadataWithDefaults(
      state,
      this.buildMetadata(state),
    );
    const metadataBeforeRepair = hydratePanierExpressMetadataCollections({
      state,
      metadata: {
        ...merged,
        laps: ensurePanierExpressPlayerLaps(merged.laps, normalizedPlayers),
        positions: ensurePanierExpressPlayerPositions(
          merged.positions,
          normalizedPlayers,
        ),
        quizOutcome: ensurePanierExpressQuizOutcome(
          merged.quizOutcome,
          normalizedPlayers,
        ),
        decks: mergePanierExpressDecks(
          this.buildMetadata(state).decks,
          merged.decks,
        ),
        statuses: mergePanierExpressStatuses(
          this.buildMetadata(state).statuses,
          merged.statuses,
        ),
      },
      players: normalizedPlayers as PanierExpressPlayer[],
      buildDeckPool: (value) => this.setup.buildDeckPool(value),
    });
    const repaired = ensureShoppingLists({
      metadata: metadataBeforeRepair,
      players: normalizedPlayers,
      courseItems: this.setup.courseItems(),
      shoppingListSize: PanierExpressStateService.SHOPPING_LIST_SIZE,
      toStringArray: (value) => this.utils.toStringArray(value),
    });
    return { ...state, metadata: repaired.metadata, players: repaired.players };
  }

  getMetadata(state: GameStateEntity): PanierExpressMetadata {
    return getPanierExpressMetadata(state, (nextState) =>
      this.buildMetadata(nextState),
    );
  }

  getPlayers(state: GameStateEntity): PanierExpressPlayer[] {
    return getPanierExpressPlayers(state);
  }
}



