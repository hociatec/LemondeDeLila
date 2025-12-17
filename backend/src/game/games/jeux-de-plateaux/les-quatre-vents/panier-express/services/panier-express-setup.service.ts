import { Injectable } from '@nestjs/common';
import { DeckManagerService } from '../../../../../modules/cards/services/deck-manager.service';
import { DeckPoolService } from '../../../../../modules/cards/services/deck-pool.service';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { PanierExpressMetadata, PanierExpressTile } from '../entities/panier-express-state.entity';

@Injectable()
export class PanierExpressSetupService {
  constructor(private readonly decks: DeckManagerService, private readonly deckPool: DeckPoolService) {}

  courseItems(): string[] {
    return [
      'pomme',
      'poire',
      'carotte',
      'courgette',
      'fraise',
      'avocat',
      'banane',
      'tomate',
      'kiwi',
      'melon',
      'citron',
      'ananas',
      'peche',
      'mangue',
      'raisin',
    ];
  }

  standCourseMap(): Record<string, string[]> {
    return {
      fruitier: ['pomme', 'poire', 'banane', 'melon'],
      maraicher: ['carotte', 'courgette', 'tomate'],
      bio: this.courseItems(),
      primeur: ['pomme', 'poire', 'banane', 'tomate'],
      'fruits-exotiques': ['ananas', 'mangue', 'kiwi'],
      'legumes-racines': ['carotte', 'poire'],
      'legumes-feuilles': ['avocat', 'courgette'],
      'fruits-rouges': ['fraise', 'raisin'],
      'legumes-secs': ['carotte', 'courgette'],
      agrumes: ['citron'],
      'legumes-ete': ['tomate', 'courgette'],
      'fruits-secs': ['raisin'],
      'fruits-hiver': ['poire', 'pomme'],
      'legumes-exotiques': ['avocat', 'mangue'],
      champignons: ['tomate'],
      bonus: this.courseItems(),
    };
  }

  buildTiles(): PanierExpressTile[] {
    return [
      { id: 'start', type: 'start' },
      { id: 'stand-fruitier', type: 'stand', standId: 'fruitier' },
      { id: 'event-1', type: 'event' },
      { id: 'stand-maraicher', type: 'stand', standId: 'maraicher' },
      { id: 'exchange-1', type: 'exchange' },
      { id: 'stand-bio-1', type: 'stand', standId: 'bio' },
      { id: 'move-plus-1', type: 'move', delta: 1 },
      { id: 'stand-primeur-1', type: 'stand', standId: 'primeur' },
      { id: 'skip-1', type: 'skip', turns: 1 },
      { id: 'stand-fruits-exotiques', type: 'stand', standId: 'fruits-exotiques' },
      { id: 'exchange-2', type: 'exchange' },
      { id: 'stand-legumes-racines', type: 'stand', standId: 'legumes-racines' },
      { id: 'move-minus-2', type: 'move', delta: -2 },
      { id: 'stand-legumes-feuilles', type: 'stand', standId: 'legumes-feuilles' },
      { id: 'quiz-1', type: 'quiz' },
      { id: 'stand-fruits-rouges', type: 'stand', standId: 'fruits-rouges' },
      { id: 'event-2', type: 'event' },
      { id: 'stand-legumes-secs', type: 'stand', standId: 'legumes-secs' },
      { id: 'exchange-3', type: 'exchange' },
      { id: 'stand-bio-2', type: 'stand', standId: 'bio' },
      { id: 'move-to-stand', type: 'move_to_stand' },
      { id: 'stand-primeur-2', type: 'stand', standId: 'primeur' },
      { id: 'bonus-course-1', type: 'bonus_course' },
      { id: 'stand-agrumes', type: 'stand', standId: 'agrumes' },
      { id: 'skip-2', type: 'skip', turns: 1 },
      { id: 'stand-fruits-secs', type: 'stand', standId: 'fruits-secs' },
      { id: 'exchange-4', type: 'exchange' },
      { id: 'stand-legumes-ete', type: 'stand', standId: 'legumes-ete' },
      { id: 'move-minus-3', type: 'move', delta: -3 },
      { id: 'stand-fruits-hiver', type: 'stand', standId: 'fruits-hiver' },
      { id: 'exchange-5', type: 'exchange' },
      { id: 'stand-legumes-exotiques', type: 'stand', standId: 'legumes-exotiques' },
      { id: 'quiz-2', type: 'quiz' },
      { id: 'stand-champignons', type: 'stand', standId: 'champignons' },
      { id: 'move-plus-2', type: 'move', delta: 2 },
      { id: 'stand-primeur-3', type: 'stand', standId: 'primeur' },
      { id: 'event-3', type: 'event' },
      { id: 'stand-maraicher-2', type: 'stand', standId: 'maraicher' },
      { id: 'exchange-6', type: 'exchange' },
      { id: 'arrival', type: 'start' },
    ];
  }

  buildDeckPool(baseState?: GameStateEntity): PanierExpressMetadata['decks'] {
    let pool = this.deckPool.set<any>({}, 'courses', this.deckPool.shuffle(this.courseItems()));
    pool = this.deckPool.set<any>(pool, 'events', ['rupture-de-stock', 'stand-ferme', 'promo-surprise', 'orage-au-marche']);
    pool = this.deckPool.set<any>(pool, 'exchanges', ['echange-fruit-legume', 'donne-une-carte', 'prend-au-hasard']);
    pool = this.deckPool.set<any>(pool, 'quizzes', this.buildQuizDeck());
    pool = this.deckPool.set<any>(pool, 'shoppingLists', this.buildShoppingListDeck());

    const standMap = this.standCourseMap();
    const standIds = new Set<string>();
    this.buildTiles()
      .filter((t) => t.type === 'stand')
      .forEach((t: any) => standIds.add(t.standId));
    standIds.add('bonus');
    standIds.forEach((standId) => {
      const items = standMap[standId] ?? this.courseItems();
      const deck = this.buildReplenishableDeck(items);
      pool = this.deckPool.set<any>(pool, `courses-${standId}`, this.deckPool.shuffle(deck));
    });

    return pool as PanierExpressMetadata['decks'];
  }

  buildShoppingListDeck(): string[][] {
    const lists: string[][] = [];
    for (let i = 0; i < 10; i += 1) {
      lists.push(this.decks.shuffle([...this.courseItems()]).slice(0, 5));
    }
    return this.decks.shuffle(lists);
  }

  buildQuizDeck(): Array<{ question: string; answer: string; choices: string[] }> {
    const pool = this.courseItems();
    const base = [
      { question: 'Quel fruit contient le plus de vitamine C ?', answer: 'kiwi' },
      { question: 'Quel légume est en réalité un fruit ?', answer: 'tomate' },
      { question: 'Quel fruit a ses graines à l’extérieur ?', answer: 'fraise' },
    ];
    return base.map((q) => {
      const distractors = this.decks.shuffle(pool.filter((item) => item !== q.answer)).slice(0, 3);
      const choices = this.decks.shuffle([q.answer, ...distractors]);
      return { ...q, choices };
    });
  }

  /**
   * Les stands doivent pouvoir être revisités plusieurs fois au cours d'une même partie.
   * On duplique volontairement les cartes disponibles pour simuler le réassort permanent.
   */
  buildReplenishableDeck(items?: string[]): string[] {
    const source = items && items.length ? [...items] : [...this.courseItems()];
    return [...source, ...source];
  }
}
