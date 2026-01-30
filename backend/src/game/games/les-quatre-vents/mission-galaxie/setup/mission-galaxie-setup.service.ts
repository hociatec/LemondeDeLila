import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  MissionGalaxieBoardJsonV1,
  MissionGalaxieChallengesJsonV1,
  MissionGalaxieEventsJsonV1,
  MissionGalaxieQuestionsJsonV1,
} from '../model/mission-galaxie-content.entity';
import type { MissionGalaxieMetadata } from '../model/mission-galaxie-state.entity';

@Injectable()
export class MissionGalaxieSetupService {
  constructor(
    private readonly contentLoader: GameContentLoaderService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const board = this.loadBoard();
    const questions = this.loadQuestions();
    const challenges = this.loadChallenges();
    const events = this.loadEvents();

    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const statuses = { skipTurn: {} as Record<number, number> };
    for (const player of players) {
      if (player?.id != null) {
        positions[player.id] = 0;
        statuses.skipTurn[player.id] = 0;
      }
    }

    const seedMeta = (base.metadata ?? {}) as any;
    const shuffledQuestions = this.random.shuffle(
      seedMeta,
      questions.questions ?? [],
    );
    const shuffledChallenges = this.random.shuffle(
      shuffledQuestions.meta ?? seedMeta,
      challenges.challenges ?? [],
    );
    const shuffledEvents = this.random.shuffle(
      shuffledChallenges.meta ?? seedMeta,
      events.events ?? [],
    );

    const meta: MissionGalaxieMetadata = {
      tiles: board.tiles ?? [],
      positions,
      statuses,
      decks: {
        questions: shuffledQuestions.values as any,
        challenges: shuffledChallenges.values as any,
        events: shuffledEvents.values as any,
      },
      discards: { questions: [], challenges: [], events: [] },
      pendingContext: null,
      winnerId: null,
    };

    return {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: {
        ...(base.metadata ?? {}),
        ...(shuffledQuestions.meta ?? {}),
        ...(shuffledChallenges.meta ?? {}),
        ...(shuffledEvents.meta ?? {}),
        ...meta,
      },
    };
  }

  private loadBoard(): MissionGalaxieBoardJsonV1 {
    return this.contentLoader.loadContent<MissionGalaxieBoardJsonV1>({
      gameType: 'mission-galaxie',
      baseDir: __dirname,
      filename: 'board.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('tiles', 1),
      ],
    });
  }

  private loadQuestions(): MissionGalaxieQuestionsJsonV1 {
    return this.contentLoader.loadContent<MissionGalaxieQuestionsJsonV1>({
      gameType: 'mission-galaxie',
      baseDir: __dirname,
      filename: 'questions.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('questions', 1),
      ],
    });
  }

  private loadChallenges(): MissionGalaxieChallengesJsonV1 {
    return this.contentLoader.loadContent<MissionGalaxieChallengesJsonV1>({
      gameType: 'mission-galaxie',
      baseDir: __dirname,
      filename: 'challenges.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('challenges', 1),
      ],
    });
  }

  private loadEvents(): MissionGalaxieEventsJsonV1 {
    return this.contentLoader.loadContent<MissionGalaxieEventsJsonV1>({
      gameType: 'mission-galaxie',
      baseDir: __dirname,
      filename: 'events.json',
      validators: [
        this.contentLoader.validators.version(1),
        this.contentLoader.validators.arrayField('events', 1),
      ],
    });
  }
}
