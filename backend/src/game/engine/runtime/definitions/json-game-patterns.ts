import { raceGame, pawnRace } from '../patterns/gameplay-pattern-track-card';
import {
  pushYourLuck,
  simultaneousAnswers,
  submissionJudgeGame,
} from '../patterns/gameplay-pattern-round-economy';
import type { GamePattern } from '../contracts/pattern-definition';
import type { DeclarativeTrigger } from '../contracts/declarative-trigger';
import { declarativeTriggerFields } from '../contracts/declarative-trigger-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type { OrderedCardCollectionOptions } from '../patterns/ordered-card-collection-pattern';
import type { EventCardRaceOptions } from '../patterns/event-card-race-pattern';
import type { GooseRaceOptions } from '../patterns/goose-race-pattern';
import type { CardBattleOptions } from '../patterns/card-battle-pattern';
import type { TrackZoneCollectionOptions } from '../patterns/track-zone-collection-pattern';
import type { ThemedSetCollectionOptions } from '../patterns/themed-set-collection-pattern';
import type { FamilyRequestOptions } from '../patterns/family-request-pattern';
import type { GridPlacementOptions } from '../patterns/grid-placement-pattern';
import type { OrderedAssemblyOptions } from '../patterns/ordered-assembly-pattern';
import type { JudgedSubmissionOptions } from '../patterns/judged-submission-pattern';
import type { AnonymousVoteOptions } from '../patterns/anonymous-vote-pattern';
import type { TreasureTrackRaceOptions } from '../patterns/treasure-track-race-pattern';
import type { FamilyEffectsOptions } from '../patterns/family-effects-pattern';
import type { SpeciesTroopsOptions } from '../patterns/species-troops-pattern';
import type { PairedPawnRaceOptions } from '../patterns/paired-pawn-race-pattern';
import type { BounceQuizRaceOptions } from '../patterns/bounce-quiz-race-pattern';
import type { BidirectionalCollisionRaceOptions as BidirectionalOptions } from '../patterns/bidirectional-collision-race-pattern';
import type { PublicDomainCardsOptions } from '../patterns/public-domain-cards-pattern';
import type { TeamPawnRaceOptions } from '../patterns/team-pawn-race-pattern';
import type { QuizEventRaceOptions } from '../patterns/quiz-event-race-pattern';
import type { ProtectedHauntedRaceProgram } from '../patterns/protected-haunted-race-pattern';
import type { SharedPrestigeCardsProgram } from '../patterns/shared-prestige-cards-pattern';
import type { ResourceTrackRaceProgram } from '../patterns/resource-track-race-pattern';
import type { ChainedTileRaceProgram } from '../patterns/chained-tile-race-pattern';
import {
  compileAnonymousVote,
  compileFamilyEffects,
  compileSpeciesTroops,
  compileTreasureTrackRace,
  compilePairedPawnRace,
  compileJudgedSubmission,
  compileBounceQuizRace,
  compileOrderedAssembly,
  compileBidirectionalCollisionRace,
  compileGridPlacement,
  compileFamilyRequest,
  compilePublicDomainCards,
  compileThemedSetCollection,
  compileTeamPawnRace,
  compileQuizEventRace,
  compileTrackZoneCollection,
  compileProtectedHauntedRace,
  compileSharedPrestigeCards,
  compileMarket,
  compileEventCardRace,
  compileGooseRace,
  compileCardBattle,
  compileResourceTrackRace,
  compileOrderedCardCollection,
  compileChainedTileRace,
  compileTriggerPattern,
  compilePawnRace,
  compileRace,
  type JsonMarketPattern,
  type JsonSubmissionJudgePattern,
} from './json-advanced-pattern-compilers';
import {
  type AuthorSchema,
  authorId as id,
  authorBoolean as boolean,
  authorObject as object,
  authorRecord as record,
  authorArray as array,
  authorRef as ref,
} from '../contracts/json-author-schema';
import {
  cardBattlePatternSchema,
  gooseRacePatternSchema,
  trackZoneCollectionPatternSchema,
  themedSetCollectionPatternSchema,
  familyRequestPatternSchema,
  gridPlacementPatternSchema,
  orderedAssemblyPatternSchema,
  judgedSubmissionPatternSchema,
  anonymousVotePatternSchema,
  marketPatternSchema,
} from './json-advanced-pattern-schemas';
import { treasureTrackRacePatternSchema } from './json-treasure-track-pattern-schema';
import { familyEffectsPatternSchema } from './json-family-effects-pattern-schema';
import { speciesTroopsPatternSchema } from './json-species-troops-pattern-schema';
import { pairedPawnRacePatternSchema } from './json-paired-pawn-race-pattern-schema';
import { bounceQuizRacePatternSchema } from './json-bounce-quiz-race-pattern-schema';
import { bidirectionalCollisionRacePatternSchema } from './json-bidirectional-collision-race-pattern-schema';
import { publicDomainCardsPatternSchema } from './json-public-domain-cards-pattern-schema';
import { teamPawnRacePatternSchema } from './json-team-pawn-race-pattern-schema';
import { quizEventRacePatternSchema } from './json-quiz-event-race-pattern-schema';
import { protectedHauntedRacePatternSchema } from './json-protected-haunted-race-pattern-schema';
import { sharedPrestigeCardsPatternSchema } from './json-shared-prestige-cards-pattern-schema';
import { resourceTrackRacePatternSchema } from './json-resource-track-race-pattern-schema';
import { chainedTileRacePatternSchema } from './json-chained-tile-race-pattern-schema';
import {
  compilePromotedJsonPattern,
  isPromotedJsonPattern,
  promotedJsonPatternSchemas,
  type PromotedJsonGamePattern,
} from './json-promoted-patterns';

export type JsonGamePattern =
  | ({ kind: 'trigger' } & DeclarativeTrigger)
  | ({ kind: 'pawn-race' } & Parameters<typeof pawnRace>[0])
  | {
      kind: 'race';
      trackId: string;
      spaces: number;
      positionDisplayOffset?: number;
      overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
      finish?: number;
      homeStretch?: { from: number; to?: number };
      landingEffects?: Readonly<
        Record<number, readonly GameEffectInstruction[]>
      >;
      diceId?: string;
      diceCount?: number;
      diceSides?: number;
      winOnFinish?: boolean | string;
      delivery?: NonNullable<Parameters<typeof raceGame>[0]['delivery']>;
    }
  | { kind: 'push-your-luck' }
  | ({ kind: 'ordered-card-collection' } & OrderedCardCollectionOptions)
  | ({ kind: 'event-card-race' } & EventCardRaceOptions)
  | ({ kind: 'goose-race' } & GooseRaceOptions)
  | ({ kind: 'card-battle' } & CardBattleOptions)
  | ({ kind: 'track-zone-collection' } & TrackZoneCollectionOptions)
  | ({ kind: 'themed-set-collection' } & ThemedSetCollectionOptions)
  | ({ kind: 'family-request' } & FamilyRequestOptions)
  | ({ kind: 'grid-placement' } & GridPlacementOptions)
  | ({ kind: 'ordered-assembly' } & OrderedAssemblyOptions)
  | ({ kind: 'judged-submission' } & JudgedSubmissionOptions)
  | ({ kind: 'anonymous-vote' } & AnonymousVoteOptions)
  | ({ kind: 'treasure-track-race' } & TreasureTrackRaceOptions)
  | ({ kind: 'family-effects' } & FamilyEffectsOptions)
  | ({ kind: 'species-troops' } & SpeciesTroopsOptions)
  | ({ kind: 'paired-pawn-race' } & PairedPawnRaceOptions)
  | ({ kind: 'bounce-quiz-race' } & BounceQuizRaceOptions)
  | ({ kind: 'bidirectional-collision-race' } & BidirectionalOptions)
  | ({ kind: 'public-domain-cards' } & PublicDomainCardsOptions)
  | ({ kind: 'team-pawn-race' } & TeamPawnRaceOptions)
  | ({ kind: 'quiz-event-race' } & QuizEventRaceOptions)
  | ({ kind: 'protected-haunted-race' } & ProtectedHauntedRaceProgram)
  | ({ kind: 'shared-prestige-cards' } & SharedPrestigeCardsProgram)
  | { kind: 'resource-track-race'; config: ResourceTrackRaceProgram }
  | { kind: 'chained-tile-race'; config: ChainedTileRaceProgram }
  | PromotedJsonGamePattern
  | JsonMarketPattern
  | { kind: 'simultaneous-answers' }
  | JsonSubmissionJudgePattern;

const position: AuthorSchema = { type: 'integer', minimum: 0 };
export const jsonGamePatternSchema: AuthorSchema = {
  oneOf: [
    object({ kind: { const: 'trigger' }, ...declarativeTriggerFields }, [
      'kind',
      'id',
      'on',
      'effects',
    ]),
    object(
      {
        kind: { const: 'pawn-race' },
        pawnSetId: id,
        pawns: array(
          object({ id, label: { type: 'string' }, name: { type: 'string' } }, [
            'id',
          ]),
          1,
        ),
        perPlayer: { type: 'integer', minimum: 1, maximum: 1000 },
        spaces: { type: 'integer', minimum: 1, maximum: 10000 },
        overshoot: { enum: ['clamp', 'wrap', 'bounce', 'exact'] },
        initialPosition: { type: 'integer', minimum: -1, maximum: 10000 },
        entryRoll: { type: 'integer', minimum: 1, maximum: 100000000 },
        entryPosition: position,
        exactFinish: boolean,
        homeStretchFrom: position,
        diceId: id,
        diceCount: { type: 'integer', minimum: 1, maximum: 100 },
        diceSides: { type: 'integer', minimum: 2, maximum: 1000000 },
        play: object(
          {
            recipe: id,
            choiceId: id,
            finishAt: position,
            finishReason: id,
            extraTurnRolls: array({
              type: 'integer',
              minimum: 1,
              maximum: 100000000,
            }),
          },
          ['recipe', 'choiceId', 'finishAt', 'finishReason'],
        ),
      },
      ['kind', 'pawnSetId', 'pawns', 'spaces'],
    ),
    object(
      {
        kind: { const: 'race' },
        trackId: id,
        spaces: { type: 'integer', minimum: 1, maximum: 10000 },
        positionDisplayOffset: {
          type: 'integer',
          minimum: -1000000,
          maximum: 1000000,
        },
        overshoot: { enum: ['clamp', 'wrap', 'bounce', 'exact'] },
        finish: position,
        homeStretch: object({ from: position, to: position }, ['from']),
        landingEffects: record(array(ref('effect'))),
        diceId: id,
        diceCount: { type: 'integer', minimum: 1, maximum: 100 },
        diceSides: { type: 'integer', minimum: 2, maximum: 1000000 },
        winOnFinish: { oneOf: [boolean, id] },
        delivery: object(
          {
            recipe: id,
            clientDeckId: id,
            clientHandId: id,
            eventDeckId: id,
            destinationAttribute: id,
            blockedPositionAttribute: id,
            positionOffset: {
              type: 'integer',
              minimum: -10000,
              maximum: 10000,
            },
            targetScore: {
              type: 'integer',
              minimum: 1,
              maximum: 1000000,
            },
            finishReason: id,
            eventNamespace: id,
          },
          [
            'recipe',
            'clientDeckId',
            'clientHandId',
            'eventDeckId',
            'destinationAttribute',
            'blockedPositionAttribute',
            'positionOffset',
            'targetScore',
            'finishReason',
            'eventNamespace',
          ],
        ),
      },
      ['kind', 'trackId', 'spaces'],
    ),
    object({ kind: { const: 'push-your-luck' } }),
    object(
      {
        kind: { const: 'ordered-card-collection' },
        playRecipe: id,
        passRecipe: id,
        deckId: id,
        handId: id,
        cards: array(
          object(
            {
              id,
              name: { type: 'string', minLength: 1, maxLength: 2000 },
              value: id,
              special: boolean,
            },
            ['id', 'name', 'value', 'special'],
          ),
          1,
        ),
        sequence: array(id, 1),
        rewards: record(record({ type: 'number' })),
        resourceValues: record({ type: 'number' }),
        finishReason: id,
        eventNamespace: id,
      },
      [
        'kind',
        'playRecipe',
        'passRecipe',
        'deckId',
        'handId',
        'cards',
        'sequence',
        'rewards',
        'resourceValues',
        'finishReason',
        'eventNamespace',
      ],
    ),
    object(
      {
        kind: { const: 'event-card-race' },
        rollRecipe: id,
        drawRecipe: id,
        trackId: id,
        diceId: id,
        playingPhase: id,
        landingEffectId: id,
        pendingDrawFlag: id,
        tiles: array(
          object(
            {
              label: { type: 'string' },
              description: { type: 'string', minLength: 1, maxLength: 10000 },
              deckId: id,
            },
            ['label'],
          ),
          2,
        ),
        pawnSelection: object({ setId: id, choiceId: id }, [
          'setId',
          'choiceId',
        ]),
      },
      [
        'kind',
        'rollRecipe',
        'drawRecipe',
        'trackId',
        'diceId',
        'playingPhase',
        'landingEffectId',
        'pendingDrawFlag',
        'tiles',
        'pawnSelection',
      ],
    ),
    gooseRacePatternSchema,
    cardBattlePatternSchema,
    trackZoneCollectionPatternSchema,
    themedSetCollectionPatternSchema,
    familyRequestPatternSchema,
    gridPlacementPatternSchema,
    orderedAssemblyPatternSchema,
    judgedSubmissionPatternSchema,
    anonymousVotePatternSchema,
    treasureTrackRacePatternSchema,
    familyEffectsPatternSchema,
    speciesTroopsPatternSchema,
    pairedPawnRacePatternSchema,
    bounceQuizRacePatternSchema,
    bidirectionalCollisionRacePatternSchema,
    publicDomainCardsPatternSchema,
    teamPawnRacePatternSchema,
    quizEventRacePatternSchema,
    protectedHauntedRacePatternSchema,
    sharedPrestigeCardsPatternSchema,
    resourceTrackRacePatternSchema,
    chainedTileRacePatternSchema,
    ...promotedJsonPatternSchemas,
    marketPatternSchema,
    object({ kind: { const: 'simultaneous-answers' } }),
    object(
      {
        kind: { const: 'submission-judge' },
        submissionId: id,
        voteId: id,
        secret: boolean,
        targetScore: { type: 'integer', minimum: 1, maximum: 1000000 },
        winnerReason: id,
      },
      ['kind'],
    ),
  ],
};

export function compileJsonPattern(
  pattern: JsonGamePattern,
): GamePattern<Record<string, never>> {
  if (isPromotedJsonPattern(pattern))
    return compilePromotedJsonPattern(pattern);
  switch (pattern.kind) {
    case 'trigger':
      return compileTriggerPattern(pattern);
    case 'pawn-race':
      return compilePawnRace(pattern);
    case 'race':
      return compileRace(pattern);
    case 'push-your-luck':
      return pushYourLuck();
    case 'ordered-card-collection':
      return compileOrderedCardCollection(pattern);
    case 'event-card-race':
      return compileEventCardRace(pattern);
    case 'goose-race':
      return compileGooseRace(pattern);
    case 'card-battle':
      return compileCardBattle(pattern);
    case 'track-zone-collection':
      return compileTrackZoneCollection(pattern);
    case 'themed-set-collection':
      return compileThemedSetCollection(pattern);
    case 'family-request':
      return compileFamilyRequest(pattern);
    case 'grid-placement':
      return compileGridPlacement(pattern);
    case 'ordered-assembly':
      return compileOrderedAssembly(pattern);
    case 'judged-submission':
      return compileJudgedSubmission(pattern);
    case 'anonymous-vote':
      return compileAnonymousVote(pattern);
    case 'treasure-track-race':
      return compileTreasureTrackRace(pattern);
    case 'family-effects':
      return compileFamilyEffects(pattern);
    case 'species-troops':
      return compileSpeciesTroops(pattern);
    case 'paired-pawn-race':
      return compilePairedPawnRace(pattern);
    case 'bounce-quiz-race':
      return compileBounceQuizRace(pattern);
    case 'bidirectional-collision-race':
      return compileBidirectionalCollisionRace(pattern);
    case 'public-domain-cards':
      return compilePublicDomainCards(pattern);
    case 'team-pawn-race':
      return compileTeamPawnRace(pattern);
    case 'quiz-event-race':
      return compileQuizEventRace(pattern);
    case 'protected-haunted-race':
      return compileProtectedHauntedRace(pattern);
    case 'shared-prestige-cards':
      return compileSharedPrestigeCards(pattern);
    case 'resource-track-race':
      return compileResourceTrackRace(pattern);
    case 'chained-tile-race':
      return compileChainedTileRace(pattern);
    case 'market':
      return compileMarket(pattern);
    case 'simultaneous-answers':
      return simultaneousAnswers();
    case 'submission-judge': {
      const { kind: _kind, ...options } = pattern;
      return submissionJudgeGame(options);
    }
  }
}
