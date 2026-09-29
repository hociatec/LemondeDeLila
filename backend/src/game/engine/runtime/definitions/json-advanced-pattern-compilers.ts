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
