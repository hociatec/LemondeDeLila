import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeckManagerService } from '../../../../../modules/cards/services/deck-manager.service';
import {
  DeckPoolService,
  DeckPoolState,
} from '../../../../../modules/cards/services/deck-pool.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import {
  PanierExpressDeckPool,
  PanierExpressMetadata,
  PanierExpressTile,
} from '../entities/panier-express-state.entity';
import {
  PanierExpressBoardJsonV1,
  PanierExpressCoursesJsonV1,
  PanierExpressEventsJsonV1,
  PanierExpressExchangesJsonV1,
  PanierExpressQuizzesJsonV1,
  PanierExpressShoppingListsJsonV1,
  PanierExpressStandsJsonV1,
} from '../entities/panier-express-content.entity';

@Injectable()
export class PanierExpressSetupService {
  constructor(
    private readonly decks: DeckManagerService,
    private readonly deckPool: DeckPoolService,
  ) {}

  private cache: {
    board?: PanierExpressBoardJsonV1;
    courses?: PanierExpressCoursesJsonV1;
    stands?: PanierExpressStandsJsonV1;
    events?: PanierExpressEventsJsonV1;
    exchanges?: PanierExpressExchangesJsonV1;
    quizzes?: PanierExpressQuizzesJsonV1;
    shoppingLists?: PanierExpressShoppingListsJsonV1;
  } = {};

  private static readJsonFile<T>(absPath: string): T {
    const raw = fs
      .readFileSync(absPath, { encoding: 'utf8' })
      .replace(/^\uFEFF/, '');
    const parsed = JSON.parse(raw) as T;
    return PanierExpressSetupService.fixMojibakeDeep(parsed);
  }

  private static fixMojibakeString(value: string): string {
    const score = (s: string) => {
      const suspicious = (
        s.match(
          /[\u00C2\u00C3\u00E2\u0153\u0178\u0160\u0161\u017D\u017E\u2030]/g,
        ) ?? []
      ).length;
      const replacement = (s.match(/\uFFFD/g) ?? []).length;
      return suspicious * 2 + replacement * 10;
    };
    const currentScore = score(value);
    if (currentScore === 0) return value;

    const windows1252ToBytes = (input: string): Uint8Array => {
      const map: Record<number, number> = {
        0x20ac: 0x80,
        0x201a: 0x82,
        0x0192: 0x83,
        0x201e: 0x84,
        0x2026: 0x85,
        0x2020: 0x86,
        0x2021: 0x87,
        0x02c6: 0x88,
        0x2030: 0x89,
        0x0160: 0x8a,
        0x2039: 0x8b,
        0x0152: 0x8c,
        0x017d: 0x8e,
        0x2018: 0x91,
        0x2019: 0x92,
        0x201c: 0x93,
        0x201d: 0x94,
        0x2022: 0x95,
        0x2013: 0x96,
        0x2014: 0x97,
        0x02dc: 0x98,
        0x2122: 0x99,
        0x0161: 0x9a,
        0x203a: 0x9b,
        0x0153: 0x9c,
        0x017e: 0x9e,
        0x0178: 0x9f,
      };
      const bytes: number[] = [];
      for (const ch of input) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp <= 0xff) {
          bytes.push(cp);
        } else if (map[cp] != null) {
          bytes.push(map[cp]);
        } else {
          bytes.push(0x3f);
        }
      }
      return Uint8Array.from(bytes);
    };

    const candidates = [
      Buffer.from(value, 'latin1').toString('utf8'),
      Buffer.from(windows1252ToBytes(value)).toString('utf8'),
    ].filter((c) => typeof c === 'string' && c.length > 0);

    let best = value;
    let bestScore = currentScore;
    for (const c of candidates) {
      const s = score(c);
      if (s < bestScore) {
        best = c;
        bestScore = s;
      }
    }
    return best;
  }

  private static fixMojibakeDeep<T>(value: T): T {
    if (typeof value === 'string') {
      return PanierExpressSetupService.fixMojibakeString(value) as unknown as T;
    }
    if (Array.isArray(value)) {
      return value.map((v) =>
        PanierExpressSetupService.fixMojibakeDeep(v),
      ) as unknown as T;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      Object.keys(obj).forEach((k) => {
        out[k] = PanierExpressSetupService.fixMojibakeDeep(obj[k]);
      });
      return out as T;
    }
    return value;
  }

  private loadBoard(): PanierExpressBoardJsonV1 {
    if (this.cache.board) return this.cache.board;
    const abs = path.join(__dirname, '..', 'entities', 'content', 'board.json');
    const parsed =
      PanierExpressSetupService.readJsonFile<PanierExpressBoardJsonV1>(abs);
    if (
      !parsed ||
      (parsed as any).version !== 1 ||
      !Array.isArray(parsed.tiles) ||
      parsed.tiles.length === 0
    ) {
      throw new Error('Panier Express: board.json invalide');
    }
    this.cache.board = parsed;
    return parsed;
  }

  private loadCourses(): PanierExpressCoursesJsonV1 {
    if (this.cache.courses) return this.cache.courses;
    const abs = path.join(
      __dirname,
      '..',
      'entities',
      'content',
      'courses.json',
    );
    const parsed =
      PanierExpressSetupService.readJsonFile<PanierExpressCoursesJsonV1>(abs);
    if (
      !parsed ||
      (parsed as any).version !== 1 ||
      !Array.isArray(parsed.items) ||
      parsed.items.length === 0
    ) {
      throw new Error('Panier Express: courses.json invalide');
    }
    this.cache.courses = parsed;
    return parsed;
  }

  private loadStands(): PanierExpressStandsJsonV1 {
    if (this.cache.stands) return this.cache.stands;
    const abs = path.join(
      __dirname,
      '..',
      'entities',
      'content',
      'stands.json',
    );
    const parsed =
      PanierExpressSetupService.readJsonFile<PanierExpressStandsJsonV1>(abs);
    if (
      !parsed ||
      (parsed as any).version !== 1 ||
      !Array.isArray(parsed.stands) ||
      parsed.stands.length === 0
    ) {
      throw new Error('Panier Express: stands.json invalide');
    }
    this.cache.stands = parsed;
    return parsed;
  }

  private loadEvents(): PanierExpressEventsJsonV1 {
    if (this.cache.events) return this.cache.events;
    const abs = path.join(
      __dirname,
      '..',
      'entities',
      'content',
      'events.json',
    );
    const parsed =
      PanierExpressSetupService.readJsonFile<PanierExpressEventsJsonV1>(abs);
    if (
      !parsed ||
      (parsed as any).version !== 1 ||
      !Array.isArray(parsed.events) ||
      parsed.events.length === 0
    ) {
      throw new Error('Panier Express: events.json invalide');
    }
    this.cache.events = parsed;
    return parsed;
  }

  private loadExchanges(): PanierExpressExchangesJsonV1 {
    if (this.cache.exchanges) return this.cache.exchanges;
    const abs = path.join(
      __dirname,
      '..',
      'entities',
      'content',
      'exchanges.json',
    );
    const parsed =
      PanierExpressSetupService.readJsonFile<PanierExpressExchangesJsonV1>(abs);
    if (
      !parsed ||
      (parsed as any).version !== 1 ||
      !Array.isArray(parsed.exchanges) ||
      parsed.exchanges.length === 0
    ) {
      throw new Error('Panier Express: exchanges.json invalide');
    }
    this.cache.exchanges = parsed;
    return parsed;
  }

  private loadQuizzes(): PanierExpressQuizzesJsonV1 {
    if (this.cache.quizzes) return this.cache.quizzes;
    const abs = path.join(
      __dirname,
      '..',
      'entities',
      'content',
      'quizzes.json',
    );
    const parsed =
      PanierExpressSetupService.readJsonFile<PanierExpressQuizzesJsonV1>(abs);
    if (
      !parsed ||
      (parsed as any).version !== 1 ||
      !Array.isArray(parsed.quizzes)
    ) {
      throw new Error('Panier Express: quizzes.json invalide');
    }
    this.cache.quizzes = parsed;
    return parsed;
  }

  private loadShoppingLists(): PanierExpressShoppingListsJsonV1 {
    if (this.cache.shoppingLists) return this.cache.shoppingLists;
    const abs = path.join(
      __dirname,
      '..',
      'entities',
      'content',
      'shopping-lists.json',
    );
    const parsed =
      PanierExpressSetupService.readJsonFile<PanierExpressShoppingListsJsonV1>(
        abs,
      );
    if (
      !parsed ||
      (parsed as any).version !== 1 ||
      !Array.isArray(parsed.lists) ||
      parsed.lists.length === 0
    ) {
      throw new Error('Panier Express: shopping-lists.json invalide');
    }
    this.cache.shoppingLists = parsed;
    return parsed;
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

  buildDeckPool(_baseState?: GameStateEntity): PanierExpressMetadata['decks'] {
    let pool: PanierExpressDeckPool = {};
    pool = this.setDeck(
      pool,
      'courses',
      this.deckPool.shuffle(this.courseItems()),
    );
    pool = this.setDeck(
      pool,
      'events',
      this.deckPool.shuffle(
        this.loadEvents()
          .events.map((v) => String(v))
          .filter((v) => v.length > 0),
      ),
    );
    pool = this.setDeck(
      pool,
      'exchanges',
      this.deckPool.shuffle(
        this.loadExchanges()
          .exchanges.map((v) => String(v))
          .filter((v) => v.length > 0),
      ),
    );
    pool = this.setDeck(pool, 'quizzes', this.buildQuizDeck());
    pool = this.setDeck(pool, 'shoppingLists', this.buildShoppingListDeck());

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
        this.deckPool.shuffle(deck),
      );
    });

    return pool;
  }

  buildShoppingListDeck(): string[][] {
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
    return this.decks.shuffle(normalized);
  }

  buildQuizDeck(): Array<{
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
