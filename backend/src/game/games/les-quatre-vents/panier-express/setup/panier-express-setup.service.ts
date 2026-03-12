import { Injectable } from '@nestjs/common';
import { DeckManagerService } from '../../../../modules/cards/services/deck-manager.service';
import {
  DeckPoolService,
  DeckPoolState,
} from '../../../../modules/cards/services/deck-pool.service';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { seededShuffle } from '../../../../../common/utils/seeded-shuffle';
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
  PanierExpressPawn,
  PanierExpressPawnsJsonV1,
  PanierExpressQuizzesJsonV1,
  PanierExpressStandsJsonV1,
} from '../model/panier-express-content.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { loadV1Content } from '../../../../setup/content-loader.helper';
import { loadCanonicalPawns } from '../../../../core/helpers/pawn-catalog.helper';

@Injectable()
export class PanierExpressSetupService {
  private static readonly MAX_STAND_ITEMS = 3;

  constructor(
    private readonly decks: DeckManagerService,
    private readonly deckPool: DeckPoolService,
    private readonly contentLoader: GameContentLoaderService,
  ) {}

  private loadBoard(): PanierExpressBoardJsonV1 {
    return loadV1Content<PanierExpressBoardJsonV1>(this.contentLoader, {
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'board.json',
      arrayField: 'tiles',
      minItems: 1,
    });
  }

  private loadCourses(): PanierExpressCoursesJsonV1 {
    return loadV1Content<PanierExpressCoursesJsonV1>(this.contentLoader, {
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'courses.json',
      arrayField: 'items',
      minItems: 1,
    });
  }

  private loadStands(): PanierExpressStandsJsonV1 {
    return loadV1Content<PanierExpressStandsJsonV1>(this.contentLoader, {
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'stands.json',
      arrayField: 'stands',
      minItems: 1,
    });
  }

  private loadEvents(): PanierExpressEventsJsonV1 {
    return loadV1Content<PanierExpressEventsJsonV1>(this.contentLoader, {
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'events.json',
      arrayField: 'events',
      minItems: 1,
    });
  }

  private loadExchanges(): PanierExpressExchangesJsonV1 {
    return loadV1Content<PanierExpressExchangesJsonV1>(this.contentLoader, {
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'exchanges.json',
      arrayField: 'exchanges',
      minItems: 1,
    });
  }

  private loadQuizzes(): PanierExpressQuizzesJsonV1 {
    return loadV1Content<PanierExpressQuizzesJsonV1>(this.contentLoader, {
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'quizzes.json',
      arrayField: 'quizzes',
    });
  }

  private loadPawns(): PanierExpressPawnsJsonV1 {
    return loadV1Content<PanierExpressPawnsJsonV1>(this.contentLoader, {
      gameType: 'panier-express',
      baseDir: __dirname,
      filename: 'pawns.json',
      arrayField: 'pawns',
      minItems: 1,
    });
  }

  courseItems(): string[] {
    return this.loadCourses()
      .items.map((v) => String(v))
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  eventCards(): string[] {
    return this.loadEvents()
      .events.map((v) => String(v))
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  exchangeCards(): string[] {
    return this.loadExchanges()
      .exchanges.map((v) => String(v))
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  standCourseCatalog(): Record<string, string[]> {
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

  standCourseMap(): Record<string, string[]> {
    return Object.fromEntries(
      Object.entries(this.standCourseCatalog()).map(([id, items]) => [
        id,
        items.slice(0, PanierExpressSetupService.MAX_STAND_ITEMS),
      ]),
    );
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
    const standMap = this.standCourseMap();
    const standIds = new Set<string>();
    this.buildTiles()
      .filter((t) => t.type === 'stand')
      .forEach((t: any) => standIds.add(t.standId));
    standIds.add('bonus');
    standIds.forEach((standId) => {
      const items = standMap[standId] ?? this.courseItems();
      const deck =
        standId === 'bonus'
          ? [...this.courseItems()]
          : this.buildReplenishableDeck(items);
      pool = this.setDeck(
        pool,
        `courses-${standId}`,
        shuffle(deck, `panier-express:courses-${standId}`),
      );
    });

    return pool;
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

  pawns(): string[] {
    return this.pawnChoices().map((p) => p.name);
  }

  pawnChoices(): PanierExpressPawn[] {
    return loadCanonicalPawns(this.loadPawns().pawns)
      .map((pawn) => ({
        id: pawn.id,
        name: pawn.name,
        description: pawn.description,
      }))
      .filter((p) => p.id.length > 0 && p.name.length > 0);
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
