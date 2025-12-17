import { Injectable } from '@nestjs/common';
import { DeckPoolService, DeckPoolState } from '../../../../../modules/cards/services/deck-pool.service';
import { GameStateEntity, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';
import { DameNatureMetadata } from './dame-nature.service';
import { dameNatureLog } from '../../../../../../common/utils/damenature-logger';

export type FamilyCard = {
  kind?: 'family' | 'quiz' | 'danger';
  familyId: string;
  familyName: string;
  memberId: string;
  memberName: string;
  role: string;
  question?: string;
  answer?: string;
  choices?: string[];
  pollutionDelta?: number;
};

@Injectable()
export class DameNatureSetupService {
  constructor(private readonly deckPool: DeckPoolService) {}

  families() {
    return [
      {
        id: 'arbres',
        name: 'Famille des Arbres',
        members: [
          { id: 'chene', name: 'Chêne', role: 'Parent' },
          { id: 'sapin', name: 'Sapin', role: 'Parent' },
          { id: 'bouleau', name: 'Bouleau', role: 'Enfant' },
          { id: 'erable', name: 'Érable', role: 'Enfant' },
        ],
      },
      {
        id: 'oiseaux',
        name: 'Famille des Oiseaux',
        members: [
          { id: 'aigle', name: 'Aigle', role: 'Parent' },
          { id: 'perroquet', name: 'Perroquet', role: 'Parent' },
          { id: 'colibri', name: 'Colibri', role: 'Enfant' },
          { id: 'moineau', name: 'Moineau', role: 'Enfant' },
        ],
      },
      {
        id: 'felins',
        name: 'Famille des Félins',
        members: [
          { id: 'lion', name: 'Lion', role: 'Parent' },
          { id: 'tigre', name: 'Tigre', role: 'Parent' },
          { id: 'lynx', name: 'Lynx', role: 'Enfant' },
          { id: 'chat', name: 'Chat', role: 'Enfant' },
        ],
      },
      {
        id: 'poissons',
        name: 'Famille des Poissons',
        members: [
          { id: 'requin', name: 'Requin', role: 'Parent' },
          { id: 'baleine', name: 'Baleine', role: 'Parent' },
          { id: 'saumon', name: 'Saumon', role: 'Enfant' },
          { id: 'clown', name: 'Poisson-clown', role: 'Enfant' },
        ],
      },
      {
        id: 'insectes',
        name: 'Famille des Insectes',
        members: [
          { id: 'cigale', name: 'Cigale', role: 'Parent' },
          { id: 'scarabee', name: 'Scarabée', role: 'Parent' },
          { id: 'fourmi', name: 'Fourmi', role: 'Enfant' },
          { id: 'papillon', name: 'Papillon', role: 'Enfant' },
        ],
      },
    ];
  }

  buildMetadata(): DameNatureMetadata {
    const families = this.families();
    const deck: FamilyCard[] = [];
    families.forEach((fam) => {
      fam.members.forEach((m) => {
        deck.push({
          kind: 'family',
          familyId: fam.id,
          familyName: fam.name,
          memberId: m.id,
          memberName: m.name,
          role: m.role,
        });
      });
    });
    // Cartes spéciales : Nature en danger / Quiz
    const dangerCards: FamilyCard[] = [
      { kind: 'danger', familyId: 'danger', familyName: 'Nature en danger', memberId: 'incendie', memberName: 'Incendie de forêt', role: 'Evenement', pollutionDelta: 2 },
      { kind: 'danger', familyId: 'danger', familyName: 'Nature en danger', memberId: 'maree-noire', memberName: 'Marée noire', role: 'Evenement', pollutionDelta: 3 },
      { kind: 'danger', familyId: 'danger', familyName: 'Nature en danger', memberId: 'canicule', memberName: 'Canicule', role: 'Evenement', pollutionDelta: 1 },
      { kind: 'danger', familyId: 'danger', familyName: 'Nature en danger', memberId: 'deforestation', memberName: 'Déforestation', role: 'Evenement', pollutionDelta: 2 },
      { kind: 'danger', familyId: 'danger', familyName: 'Nature en danger', memberId: 'usine', memberName: 'Usine polluante', role: 'Evenement', pollutionDelta: 2 },
      { kind: 'danger', familyId: 'danger', familyName: 'Nature en danger', memberId: 'reforestation', memberName: 'Reforestation', role: 'Evenement', pollutionDelta: -2 },
    ];
    const quizCards: FamilyCard[] = [
      {
        kind: 'quiz',
        familyId: 'quiz',
        familyName: 'Quiz Nature',
        memberId: 'quiz1',
        memberName: 'Quelle plante produit de l’oxygène grâce au soleil ?',
        role: 'Quiz',
        question: 'Quelle plante produit de l’oxygène grâce au soleil ?',
        answer: 'Algue',
        choices: ['Cactus', 'Algue', 'Champignon'],
      },
      {
        kind: 'quiz',
        familyId: 'quiz',
        familyName: 'Quiz Nature',
        memberId: 'quiz2',
        memberName: 'Quel animal est en danger à cause du plastique dans les océans ?',
        role: 'Quiz',
        question: 'Quel animal est en danger à cause du plastique dans les océans ?',
        answer: 'Dauphin',
        choices: ['Lion', 'Dauphin', 'Pigeon'],
      },
      {
        kind: 'quiz',
        familyId: 'quiz',
        familyName: 'Quiz Nature',
        memberId: 'quiz3',
        memberName: 'Quelle action aide la planète ?',
        role: 'Quiz',
        question: 'Quelle action aide la planète ?',
        answer: 'Planter un arbre',
        choices: ['Laisser couler l’eau', 'Planter un arbre', 'Prendre l’avion tous les jours'],
      },
      {
        kind: 'quiz',
        familyId: 'quiz',
        familyName: 'Quiz Nature',
        memberId: 'quiz4',
        memberName: 'Quelle source d’énergie est renouvelable ?',
        role: 'Quiz',
        question: 'Quelle source d’énergie est renouvelable ?',
        answer: 'Le vent',
        choices: ['Charbon', 'Le vent', 'Pétrole'],
      },
      {
        kind: 'quiz',
        familyId: 'quiz',
        familyName: 'Quiz Nature',
        memberId: 'quiz5',
        memberName: 'Quel insecte joue un rôle essentiel dans la pollinisation ?',
        role: 'Quiz',
        question: 'Quel insecte joue un rôle essentiel dans la pollinisation ?',
        answer: 'Abeille',
        choices: ['Moustique', 'Abeille', 'Scarabée'],
      },
      {
        kind: 'quiz',
        familyId: 'quiz',
        familyName: 'Quiz Nature',
        memberId: 'quiz6',
        memberName: 'Quel animal construit des barrages en bois ?',
        role: 'Quiz',
        question: 'Quel animal construit des barrages en bois ?',
        answer: 'Castor',
        choices: ['Castor', 'Rat', 'Renard'],
      },
    ];
    deck.push(...dangerCards, ...quizCards);
    return {
      decks: this.deckPool.set<FamilyCard>({}, 'family', this.deckPool.shuffle(deck)),
      familyGoal: 4,
      pollution: 0,
      maxPollution: 12,
      catalog: { families: families.map((f) => ({ id: f.id, name: f.name })) },
      actionLog: [],
      phaseId: 'turn',
      victoryId: null,
      winnerId: null,
    };
  }

  drawCard(meta: DameNatureMetadata): { card: FamilyCard | null; metadata: DameNatureMetadata } {
    const { card, pool } = this.deckPool.draw<FamilyCard>(meta.decks as DeckPoolState<FamilyCard>, 'family');
    const metadata: DameNatureMetadata = { ...meta, decks: pool };
    return { card: card ?? null, metadata };
  }

  discardCard(meta: DameNatureMetadata, card: FamilyCard): DameNatureMetadata {
    const decks = this.deckPool.discard(meta.decks as DeckPoolState<FamilyCard>, 'family', card);
    return { ...meta, decks };
  }

  /**
   * Pioche une carte de famille uniquement (ignore les quiz/danger) pour l'initialisation.
   * Les cartes non-famille sont retirées du paquet et ignorées pour ne pas polluer les mains.
   */
  drawFamilyCard(meta: DameNatureMetadata): { card: FamilyCard | null; metadata: DameNatureMetadata; skipped: FamilyCard[] } {
    let currentMeta = meta;
    const skipped: FamilyCard[] = [];
    for (let i = 0; i < 50; i += 1) {
      const draw = this.drawCard(currentMeta);
      currentMeta = draw.metadata;
      if (!draw.card) return { card: null, metadata: currentMeta, skipped };
      if (draw.card.kind === 'family' || !draw.card.kind) {
        return { card: draw.card, metadata: currentMeta, skipped };
      }
      skipped.push(draw.card);
    }
    return { card: null, metadata: currentMeta, skipped };
  }

  initializePlayers(baseState: GameStateEntity, metadata: DameNatureMetadata): Array<PlayerStateEntity & { hand: FamilyCard[]; handCount: number; books: string[] }> {
    const allPlayers: Array<PlayerStateEntity & { hand: FamilyCard[]; handCount: number; books: string[] }> = [];
    (baseState.players ?? []).forEach((p) => {
      allPlayers.push({
        id: p.id,
        username: p.username,
        isBot: (p as any).isBot ?? false,
        basket: (p as any).basket ?? [],
        inventory: (p as any).inventory ?? [],
        shoppingList: (p as any).shoppingList ?? [],
        hand: [],
        handCount: 0,
        books: [],
      });
    });
    // distribution initiale (4 cartes)
    for (let i = 0; i < 4; i += 1) {
      for (const player of allPlayers) {
        const draw = this.drawFamilyCard(metadata);
        metadata.decks = draw.metadata.decks;
        if (!draw.card) break;
        if (draw.skipped.length) {
          dameNatureLog('init.skip_special', {
            playerId: player.id,
            skipped: draw.skipped.map((c) => c.kind ?? 'special'),
          });
        }
        player.hand.push(draw.card);
        player.handCount = player.hand.length;
      }
    }
    return allPlayers;
  }

  ensurePlayers(state: GameStateEntity) {
    const players = state.players ?? [];
    return players.map((p) => {
      const anyPlayer = p as any;
      const hand: FamilyCard[] = Array.isArray(anyPlayer.hand) ? anyPlayer.hand : [];
      const books: string[] = Array.isArray(anyPlayer.books) ? anyPlayer.books : [];
      return {
        id: p.id,
        username: p.username,
        isBot: anyPlayer.isBot ?? false,
        basket: anyPlayer.basket ?? [],
        inventory: anyPlayer.inventory ?? [],
        shoppingList: anyPlayer.shoppingList ?? [],
        hand,
        handCount: anyPlayer.handCount ?? hand.length,
        books,
      };
    });
  }
}
