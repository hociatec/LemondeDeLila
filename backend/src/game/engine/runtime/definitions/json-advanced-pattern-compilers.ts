import {
  anonymousVote,
  type AnonymousVoteOptions,
} from '../patterns/anonymous-vote-pattern';
import {
  familyEffects,
  type FamilyEffectsOptions,
} from '../patterns/family-effects-pattern';
import {
  speciesTroops,
  type SpeciesTroopsOptions,
} from '../patterns/species-troops-pattern';
import {
  treasureTrackRace,
  type TreasureTrackRaceOptions,
} from '../patterns/treasure-track-race-pattern';
import {
  pairedPawnRace,
  type PairedPawnRaceOptions,
} from '../patterns/paired-pawn-race-pattern';
import {
  judgedSubmission,
  type JudgedSubmissionOptions,
} from '../patterns/judged-submission-pattern';
import {
  bounceQuizRace,
  type BounceQuizRaceOptions,
} from '../patterns/bounce-quiz-race-pattern';
import {
  orderedAssembly,
  type OrderedAssemblyOptions,
} from '../patterns/ordered-assembly-pattern';
import {
  bidirectionalCollisionRace,
  type BidirectionalCollisionRaceOptions,
} from '../patterns/bidirectional-collision-race-pattern';
import {
  gridPlacement,
  type GridPlacementOptions,
} from '../patterns/grid-placement-pattern';
import {
  familyRequest,
  type FamilyRequestOptions,
} from '../patterns/family-request-pattern';
import {
  publicDomainCards,
  type PublicDomainCardsOptions,
} from '../patterns/public-domain-cards-pattern';
import {
  themedSetCollection,
  type ThemedSetCollectionOptions,
} from '../patterns/themed-set-collection-pattern';
import {
  teamPawnRace,
  type TeamPawnRaceOptions,
} from '../patterns/team-pawn-race-pattern';
import {
  quizEventRace,
  type QuizEventRaceOptions,
} from '../patterns/quiz-event-race-pattern';
import {
  trackZoneCollection,
  type TrackZoneCollectionOptions,
} from '../patterns/track-zone-collection-pattern';
import {
  protectedHauntedRace,
  type ProtectedHauntedRaceProgram,
} from '../patterns/protected-haunted-race-pattern';
import {
  sharedPrestigeCards,
  type SharedPrestigeCardsProgram,
} from '../patterns/shared-prestige-cards-pattern';
import {
  eventCardRace,
  type EventCardRaceOptions,
} from '../patterns/event-card-race-pattern';
import {
  gooseRace,
  type GooseRaceOptions,
} from '../patterns/goose-race-pattern';
import {
  cardBattle,
  type CardBattleOptions,
} from '../patterns/card-battle-pattern';
import {
  resourceTrackRace,
  type ResourceTrackRaceProgram,
} from '../patterns/resource-track-race-pattern';
import {
  orderedCardCollection,
  type OrderedCardCollectionOptions,
} from '../patterns/ordered-card-collection-pattern';
import {
  chainedTileRace,
  type ChainedTileRaceProgram,
} from '../patterns/chained-tile-race-pattern';
import { triggerPattern } from '../automation/trigger-pattern';
import type { DeclarativeTrigger } from '../contracts/declarative-trigger';
import { pawnRace, raceGame } from '../patterns/gameplay-pattern-track-card';
import { marketGame } from '../patterns/gameplay-pattern-round-economy';
import {
  marketExchange,
  type MarketExchangeOptions,
} from '../patterns/market-exchange-pattern';

export function compileTreasureTrackRace(
  pattern: { kind: 'treasure-track-race' } & TreasureTrackRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return treasureTrackRace(options);
}
export function compileAnonymousVote(
  pattern: { kind: 'anonymous-vote' } & AnonymousVoteOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return anonymousVote(options);
}
export function compileFamilyEffects(
  pattern: { kind: 'family-effects' } & FamilyEffectsOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return familyEffects(options);
}
export function compileSpeciesTroops(
  pattern: { kind: 'species-troops' } & SpeciesTroopsOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return speciesTroops(options);
}
export function compilePairedPawnRace(
  pattern: { kind: 'paired-pawn-race' } & PairedPawnRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return pairedPawnRace(options);
}
export function compileJudgedSubmission(
  pattern: { kind: 'judged-submission' } & JudgedSubmissionOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return judgedSubmission(options);
}
export function compileBounceQuizRace(
  pattern: { kind: 'bounce-quiz-race' } & BounceQuizRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return bounceQuizRace(options);
}
export function compileOrderedAssembly(
  pattern: { kind: 'ordered-assembly' } & OrderedAssemblyOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return orderedAssembly(options);
}
export function compileBidirectionalCollisionRace(
  pattern: {
    kind: 'bidirectional-collision-race';
  } & BidirectionalCollisionRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return bidirectionalCollisionRace(options);
}
export function compileGridPlacement(
  pattern: { kind: 'grid-placement' } & GridPlacementOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return gridPlacement(options);
}
export function compileFamilyRequest(
  pattern: { kind: 'family-request' } & FamilyRequestOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return familyRequest(options);
}
export function compilePublicDomainCards(
  pattern: { kind: 'public-domain-cards' } & PublicDomainCardsOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return publicDomainCards(options);
}
export function compileThemedSetCollection(
  pattern: { kind: 'themed-set-collection' } & ThemedSetCollectionOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return themedSetCollection(options);
}
export function compileTeamPawnRace(
  pattern: { kind: 'team-pawn-race' } & TeamPawnRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return teamPawnRace(options);
}
export function compileQuizEventRace(
  pattern: { kind: 'quiz-event-race' } & QuizEventRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return quizEventRace(options);
}
export function compileTrackZoneCollection(
  pattern: { kind: 'track-zone-collection' } & TrackZoneCollectionOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return trackZoneCollection(options);
}
export function compileProtectedHauntedRace(
  pattern: { kind: 'protected-haunted-race' } & ProtectedHauntedRaceProgram,
) {
  const { kind: _kind, ...options } = pattern;
  return protectedHauntedRace(options);
}
export function compileSharedPrestigeCards(
  pattern: { kind: 'shared-prestige-cards' } & SharedPrestigeCardsProgram,
) {
  const { kind: _kind, ...options } = pattern;
  return sharedPrestigeCards(options);
}
export function compileEventCardRace(
  pattern: { kind: 'event-card-race' } & EventCardRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return eventCardRace(options);
}
export function compileGooseRace(
  pattern: { kind: 'goose-race' } & GooseRaceOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return gooseRace(options);
}
export function compileCardBattle(
  pattern: { kind: 'card-battle' } & CardBattleOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return cardBattle(options);
}
export function compileResourceTrackRace(pattern: {
  kind: 'resource-track-race';
  config: ResourceTrackRaceProgram;
}) {
  return resourceTrackRace(pattern.config);
}
export function compileOrderedCardCollection(
  pattern: { kind: 'ordered-card-collection' } & OrderedCardCollectionOptions,
) {
  const { kind: _kind, ...options } = pattern;
  return orderedCardCollection(options);
}
export function compileChainedTileRace(pattern: {
  kind: 'chained-tile-race';
  config: ChainedTileRaceProgram;
}) {
  return chainedTileRace(pattern.config);
}
export function compileTriggerPattern(
  pattern: { kind: 'trigger' } & DeclarativeTrigger,
) {
  const { kind: _kind, ...rule } = pattern;
  return triggerPattern(rule);
}
export function compilePawnRace(
  pattern: { kind: 'pawn-race' } & Parameters<typeof pawnRace>[0],
) {
  const { kind: _kind, ...options } = pattern;
  return pawnRace(options);
}
export function compileRace(
  pattern: { kind: 'race' } & Parameters<typeof raceGame>[0],
) {
  const { kind: _kind, ...options } = pattern;
  return raceGame(options);
}
export function compileMarket(
  pattern: { kind: 'market' } & Omit<MarketExchangeOptions, 'exchange'> & {
      exchange?: MarketExchangeOptions['exchange'];
    },
) {
  const { kind: _kind, ...options } = pattern;
  return options.exchange
    ? marketExchange({ ...options, exchange: options.exchange })
    : marketGame(options);
}
