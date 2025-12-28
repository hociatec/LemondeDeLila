import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { DeckPoolService } from '../../../../modules/cards/services/deck-pool.service';
import {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../core/entities/game-state.entity';
import type { DameNatureMetadata } from '../model/dame-nature.model';
import type { FamilyCard } from '../model/dame-nature.model';
import { dameNatureLog } from '../../../../../common/utils/damenature-logger';
import { seededShuffle } from '../../../../../common/utils/seeded-shuffle';
import {
  DameNatureDangerCardDef,
  DameNatureFamiliesJsonV1,
  DameNaturePollutionJsonV1,
  DameNatureQuizCardDef,
  DameNatureQuizJsonV1,
} from '../model/dame-nature-catalog.model';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { GameStateError } from '../../../../../common/errors/game-errors';

type FamilyDef = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; role: string }>;
};

@Injectable()
export class DameNatureSetupService {
  constructor(
    private readonly deckPool: DeckPoolService,
    private readonly contentLoader: GameContentLoaderService,
  ) {}

  private familiesCache: FamilyDef[] | null = null;
  private quizCache: DameNatureQuizCardDef[] | null = null;
  private dangerCache: DameNatureDangerCardDef[] | null = null;

  families(): FamilyDef[] {
    if (this.familiesCache) return this.familiesCache;

    const familiesJson = this.familiesJson();
    this.familiesCache = familiesJson.families.map((f) => ({
      id: f.id,
      name: f.name,
      members: (f.members ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        role: 'Membre',
      })),
    }));
    return this.familiesCache;
  }

  quizCards(): DameNatureQuizCardDef[] {
    if (this.quizCache) return this.quizCache;
    const quizJson = this.quizJson();
    this.quizCache = quizJson.quiz ?? [];
    return this.quizCache;
  }

  dangerCards(): DameNatureDangerCardDef[] {
    if (this.dangerCache) return this.dangerCache;
    const pollutionJson = this.pollutionJson();
    this.dangerCache = pollutionJson.cards ?? [];
    return this.dangerCache;
  }

  maxPollution(): number {
    const pollutionJson = this.pollutionJson();
    return typeof pollutionJson.maxPollution === 'number'
      ? pollutionJson.maxPollution
      : 12;
  }

  private familiesJson(): DameNatureFamiliesJsonV1 {
    return this.contentLoader.loadContent<DameNatureFamiliesJsonV1>({
      gameType: 'dame-nature',
      baseDir: __dirname,
      filename: 'families.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('families', 1),
      ],
      logger: (event, data) => {
        dameNatureLog('setup.families_json.loaded', {
          gameType: 'dame-nature',
          type: 'setup_families_json_loaded',
          source: data.path,
          families: data.families?.length ?? 0,
        });
      },
    });
  }

  private quizJson(): DameNatureQuizJsonV1 {
    return this.contentLoader.loadContent<DameNatureQuizJsonV1>({
      gameType: 'dame-nature',
      baseDir: __dirname,
      filename: 'quiz.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('quiz'),
      ],
      logger: (event, data) => {
        dameNatureLog('setup.quiz_json.loaded', {
          gameType: 'dame-nature',
          type: 'setup_quiz_json_loaded',
          source: data.path,
          quiz: data.quiz?.length ?? 0,
        });
      },
    });
  }

  private pollutionJson(): DameNaturePollutionJsonV1 {
    return this.contentLoader.loadContent<DameNaturePollutionJsonV1>({
      gameType: 'dame-nature',
      baseDir: __dirname,
      filename: 'pollution.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('cards'),
        this.contentLoader.validators.typeCheck('maxPollution', 'number'),
      ],
      logger: (event, data) => {
        dameNatureLog('setup.pollution_json.loaded', {
          gameType: 'dame-nature',
          type: 'setup_pollution_json_loaded',
          source: data.path,
          max: data.maxPollution ?? 0,
          cards: data.cards?.length ?? 0,
        });
      },
    });
  }

  buildMetadata(seed?: number | null): DameNatureMetadata {
    const families = this.families();
    if (!families.length) {
      throw new GameStateError(
        'Impossible de démarrer Dame Nature: aucune famille définie (catalogue vide).',
        {
          gameType: 'dame-nature',
        },
      );
    }
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

    // Cartes spéciales : Nature en danger / Quiz (définies via JSON/texte)
    const dangerCards: FamilyCard[] = this.dangerCards().map((d) => ({
      kind: 'danger',
      familyId: 'danger',
      familyName: 'Nature en danger',
      memberId: d.id,
      memberName: d.label,
      role: 'Événement',
      pollutionDelta: d.pollutionDelta,
    }));

    const quizCards: FamilyCard[] = this.quizCards().map((q) => ({
      kind: 'quiz',
      familyId: 'quiz',
      familyName: 'Quiz Nature',
      memberId: q.id,
      memberName: q.question,
      role: 'Quiz',
      question: q.question,
      answer: q.answer,
      choices: q.choices,
    }));

    deck.push(...dangerCards, ...quizCards);
    return {
      decks: this.deckPool.set<FamilyCard>(
        {},
        'family',
        seed != null
          ? seededShuffle(deck, seed, 'dame-nature:deck')
          : this.deckPool.shuffle(deck),
      ),
      familyGoal: 4,
      maxPollution: this.maxPollution(),
      pollutionByPlayer: {},
      catalog: { families: families.map((f) => ({ id: f.id, name: f.name })) },
      actionLog: [],
      phaseId: 'turn',
      victoryId: null,
      winnerId: null,
    };
  }

  drawCard(meta: DameNatureMetadata): {
    card: FamilyCard | null;
    metadata: DameNatureMetadata;
  } {
    const { card, pool } = this.deckPool.draw<FamilyCard>(meta.decks, 'family');
    const metadata: DameNatureMetadata = { ...meta, decks: pool };
    return { card: card ?? null, metadata };
  }

  discardCard(meta: DameNatureMetadata, card: FamilyCard): DameNatureMetadata {
    const decks = this.deckPool.discard(meta.decks, 'family', card);
    return { ...meta, decks };
  }

  /**
   * Pioche une carte de famille uniquement (ignore les quiz/danger) pour l'initialisation.
   * Les cartes non-famille sont retirées du paquet et ignorées pour ne pas polluer les mains.
   */
  drawFamilyCard(meta: DameNatureMetadata): {
    card: FamilyCard | null;
    metadata: DameNatureMetadata;
    skipped: FamilyCard[];
  } {
    let currentMeta = meta;
    const skipped: FamilyCard[] = [];
    for (let i = 0; i < 50; i += 1) {
      const draw = this.drawCard(currentMeta);
      currentMeta = draw.metadata;
      if (!draw.card) return { card: null, metadata: currentMeta, skipped };
      if (draw.card.kind === 'family' || !draw.card.kind) {
        return { card: draw.card, metadata: currentMeta, skipped };
      }
      // On retire les cartes spéciales des mains initiales, mais on les conserve en défausse pour qu'elles puissent être piochées plus tard.
      skipped.push(draw.card);
      currentMeta = this.discardCard(currentMeta, draw.card);
    }
    return { card: null, metadata: currentMeta, skipped };
  }

  initializePlayers(
    baseState: GameStateEntity,
    metadata: DameNatureMetadata,
  ): Array<
    PlayerStateEntity & {
      hand: FamilyCard[];
      handCount: number;
      books: string[];
    }
  > {
    const allPlayers: Array<
      PlayerStateEntity & {
        hand: FamilyCard[];
        handCount: number;
        books: string[];
      }
    > = [];
    (baseState.players ?? []).forEach((p) => {
      allPlayers.push({
        id: p.id,
        username: p.username,
        isBot: (p as any).isBot ?? false,
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
            roomId: (baseState.metadata as any)?.roomId ?? null,
            gameType: (baseState.metadata as any)?.gameType ?? 'dame-nature',
            type: 'init_skip_special',
            userId: player.id,
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
      const hand: FamilyCard[] = Array.isArray(anyPlayer.hand)
        ? anyPlayer.hand
        : [];
      const books: string[] = Array.isArray(anyPlayer.books)
        ? anyPlayer.books
        : [];
      return {
        id: p.id,
        username: p.username,
        isBot: anyPlayer.isBot ?? false,
        hand,
        handCount: anyPlayer.handCount ?? hand.length,
        books,
      };
    });
  }
}
