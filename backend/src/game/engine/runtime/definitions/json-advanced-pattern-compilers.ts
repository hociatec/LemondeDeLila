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
