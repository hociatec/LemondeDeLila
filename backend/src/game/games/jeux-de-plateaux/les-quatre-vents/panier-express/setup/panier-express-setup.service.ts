import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { DeckManagerService } from '../../../../../modules/cards/services/deck-manager.service';
import {
  DeckPoolService,
  DeckPoolState,
} from '../../../../../modules/cards/services/deck-pool.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { seededShuffle } from '../../../../../../common/utils/seeded-shuffle';
import {
  PanierExpressDeckPool,
  PanierExpressMetadata,
  PanierExpressTile,
} from '../model/panier-express-state.entity';
import {
  PanierExpressBoardJsonV1,
  PanierExpressCoursesJsonV1,
  PanierExpressEventsJsonV1,
  PanierExpressExchangesJsonV1,
  PanierExpressQuizzesJsonV1,
  PanierExpressShoppingListsJsonV1,
  PanierExpressStandsJsonV1,
} from '../model/panier-express-content.entity';
import { GameContentLoaderService } from '../../../../../engine/services/game-content-loader.service';

@Injectable()
export class PanierExpressSetupService {
  constructor(
    private readonly decks: DeckManagerService,
    private readonly deckPool: DeckPoolService,
    private readonly contentLoader: GameContentLoaderService,
  ) {}

  private loadBoard(): PanierExpressBoardJsonV1 {
    return this.contentLoader.loadContent<PanierExpressBoardJsonV1>({
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadCourses(): PanierExpressCoursesJsonV1 {
    return this.contentLoader.loadContent<PanierExpressCoursesJsonV1>({
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'courses.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('items', 1),
      ],
    });
  }

  private loadStands(): PanierExpressStandsJsonV1 {
    return this.contentLoader.loadContent<PanierExpressStandsJsonV1>({
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'stands.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('stands', 1),
      ],
    });
  }

  private loadEvents(): PanierExpressEventsJsonV1 {
    return this.contentLoader.loadContent<PanierExpressEventsJsonV1>({
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'events.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('events', 1),
      ],
    });
  }

  private loadExchanges(): PanierExpressExchangesJsonV1 {
    return this.contentLoader.loadContent<PanierExpressExchangesJsonV1>({
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'exchanges.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('exchanges', 1),
      ],
    });
  }

  private loadQuizzes(): PanierExpressQuizzesJsonV1 {
    return this.contentLoader.loadContent<PanierExpressQuizzesJsonV1>({
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'quizzes.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('quizzes'),
      ],
    });
  }

  private loadShoppingLists(): PanierExpressShoppingListsJsonV1 {
    return this.contentLoader.loadContent<PanierExpressShoppingListsJsonV1>({
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'shopping-lists.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('lists', 1),
      ],
    });
  }

  courseItems(): string[] {
    return this.loadCourses()
      .items.map((v) => String(v))
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  standCourseMap(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    this.loadStands().stands.forEach((s) => {
      if (!s || typeof s.id !== 'string') return;
      const id = s.id.trim();
      if (!id) return;
      const items = Array.isArray(s.items)
        ? s.items
            .map((v) => String(v))
            .map((v) => v.trim())
            .filter((v) => v.length > 0)
        : [];
      out[id] = items;
    });
    return out;
  }

  buildTiles(): PanierExpressTile[] {
    return this.loadBoard().tiles;
  }

  private extractSeed(baseState?: GameStateEntity): number | null {
    const seed = (baseState?.metadata as any)?.rng?.seed;
    return typeof seed === 'number' && Number.isFinite(seed) ? seed : null;
  }

  buildDeckPool(baseState?: GameStateEntity): PanierExpressMetadata['decks'] {
    const seed = this.extractSeed(baseState);
    const shuffle = <T>(items: readonly T[], salt: string): T[] => {
      if (seed != null) return seededShuffle(items, seed, salt);
      return this.deckPool.shuffle([...items]);
    };

    let pool: PanierExpressDeckPool = {};
    pool = this.setDeck(
      pool,
      'courses',
      shuffle(this.courseItems(), 'panier-express:courses'),
    );
    pool = this.setDeck(
      pool,
      'events',
      shuffle(
        this.loadEvents()
          .events.map((v) => String(v))
          .filter((v) => v.length > 0),
        'panier-express:events',
      ),
    );
    pool = this.setDeck(
      pool,
      'exchanges',
      shuffle(
        this.loadExchanges()
          .exchanges.map((v) => String(v))
          .filter((v) => v.length > 0),
        'panier-express:exchanges',
      ),
    );
    pool = this.setDeck(pool, 'quizzes', this.buildQuizDeck(seed));
    pool = this.setDeck(
      pool,
      'shoppingLists',
      this.buildShoppingListDeck(seed),
    );

    const standMap = this.standCourseMap();
    const standIds = new Set<string>();
    this.buildTiles()
      .filter((t) => t.type === 'stand')
      .forEach((t: any) => standIds.add(t.standId));
    standIds.add('bonus');
    standIds.forEach((standId) => {
      const items = standMap[standId] ?? this.courseItems();
      const deck = this.buildReplenishableDeck(items);
      pool = this.setDeck(
        pool,
        `courses-${standId}`,
        shuffle(deck, `panier-express:courses-${standId}`),
      );
    });

    return pool;
  }

  buildShoppingListDeck(seed?: number | null): string[][] {
    const lists = this.loadShoppingLists().lists ?? [];
    const normalized = lists
      .map((entry) =>
        Array.isArray(entry)
          ? entry
              .map((v) => String(v))
              .map((v) => v.trim())
              .filter((v) => v.length > 0)
          : [],
      )
      .filter((entry) => entry.length > 0);
    if (seed != null) {
      return seededShuffle(normalized, seed, 'panier-express:shoppingLists');
    }
    return this.decks.shuffle(normalized);
  }

  buildQuizDeck(seed?: number | null): Array<{
    id?: string;
    question: string;
    answer: string;
    choices: string[];
  }> {
    const quizzes = this.loadQuizzes().quizzes ?? [];
    const normalized = quizzes
      .map((q) => ({
        id:
          typeof (q as any)?.id === 'string'
            ? String((q as any).id)
            : undefined,
        question: String((q as any)?.question ?? '').trim(),
        answer: String((q as any)?.answer ?? '').trim(),
        choices: Array.isArray((q as any)?.choices)
          ? (q as any).choices
              .map((v: any) => String(v))
              .map((v: string) => v.trim())
              .filter((v: string) => v.length > 0)
          : [],
      }))
      .filter((q) => q.question.length > 0 && q.answer.length > 0);
    if (seed != null) {
      return seededShuffle(normalized, seed, 'panier-express:quizzes');
    }
    return this.decks.shuffle(normalized);
  }

  /**
   * Les stands doivent pouvoir être revisités plusieurs fois au cours d'une même partie.
   * On duplique volontairement les cartes disponibles pour simuler le réassort permanent.
   */
  buildReplenishableDeck(items?: string[]): string[] {
    const source = items && items.length ? [...items] : [...this.courseItems()];
    return [...source, ...source];
  }

  private setDeck<T>(
    pool: PanierExpressDeckPool,
    key: string,
    deck: T[],
  ): PanierExpressDeckPool {
    const updated = this.deckPool.set<T>(pool as DeckPoolState<T>, key, deck);
    return updated as PanierExpressDeckPool;
  }
}
