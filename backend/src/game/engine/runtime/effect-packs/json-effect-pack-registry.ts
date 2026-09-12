import { effectPack as boardMovementLandingsEffectPack } from './board-movement-landings/effect-pack';
import { effectPack as spatialGridPlacementEffectPack } from './spatial-grid-placement/effect-pack';
import { effectPack as cardsJudgedSubmissionEffectPack } from './cards-judged-submission/effect-pack';
import { effectPack as raceEventCardsEffectPack } from './race-event-cards/effect-pack';
import { effectPack as raceRouteDeliveryEffectPack } from './race-route-delivery/effect-pack';
import { effectPack as raceGooseTrackEffectPack } from './race-goose-track/effect-pack';
import { effectPack as collectionTrackZonesEffectPack } from './collection-track-zones/effect-pack';
import { effectPack as boardPathWallsEffectPack } from './board-path-walls/effect-pack';
import { effectPack as choiceStoryChallengeEffectPack } from './choice-story-challenge/effect-pack';
import { effectPack as cardsDiscardPenaltyEffectPack } from './cards-discard-penalty/effect-pack';
import { effectPack as raceResourceTrackEffectPack } from './race-resource-track/effect-pack';
import { effectPack as raceTreasureTrackEffectPack } from './race-treasure-track/effect-pack';
import { effectPack as cardsOrderedParadeEffectPack } from './cards-ordered-parade/effect-pack';
import { effectPack as collectionFamilyRequestEffectPack } from './collection-family-request/effect-pack';
import { effectPack as cardsOrderedAssemblyEffectPack } from './cards-ordered-assembly/effect-pack';
import { effectPack as choiceSimultaneousPawScoringEffectPack } from './choice-simultaneous-paw-scoring/effect-pack';
import { effectPack as collectionMarketExchangeEffectPack } from './collection-market-exchange/effect-pack';
import { effectPack as racePairedPawnsEffectPack } from './race-paired-pawns/effect-pack';
import { effectPack as collectionThemedCirclesEffectPack } from './collection-themed-circles/effect-pack';
import { effectPack as cardsPublicDomainEffectPack } from './cards-public-domain/effect-pack';
import { effectPack as choiceSimultaneousQuizEffectPack } from './choice-simultaneous-quiz/effect-pack';
import { effectPack as raceProtectedHauntedTrackEffectPack } from './race-protected-haunted-track/effect-pack';
import { effectPack as raceBidirectionalCollisionEffectPack } from './race-bidirectional-collision/effect-pack';
import { effectPack as collectionFamilyEffectsEffectPack } from './collection-family-effects/effect-pack';
import { effectPack as raceTeamPawnCaptureEffectPack } from './race-team-pawn-capture/effect-pack';
import { effectPack as raceQuizEventTrackEffectPack } from './race-quiz-event-track/effect-pack';
import { effectPack as cardsThemeNameEffectPack } from './cards-theme-name/effect-pack';
import { effectPack as cardsRitualPhasesEffectPack } from './cards-ritual-phases/effect-pack';
import { effectPack as boardPropertyEconomyEffectPack } from './board-property-economy/effect-pack';
import { effectPack as raceBounceQuizEffectPack } from './race-bounce-quiz/effect-pack';
import { effectPack as collectionSpeciesTroopsEffectPack } from './collection-species-troops/effect-pack';
import { effectPack as raceChainedTileCardsEffectPack } from './race-chained-tile-cards/effect-pack';
import { effectPack as choiceChapterEncounterEffectPack } from './choice-chapter-encounter/effect-pack';
import { effectPack as raceDirectionalHazardsEffectPack } from './race-directional-hazards/effect-pack';
import { effectPack as choiceAnonymousVoteEffectPack } from './choice-anonymous-vote/effect-pack';
import { effectPack as cardsSharedPrestigeEffectPack } from './cards-shared-prestige/effect-pack';
import { effectPack as cardsBattleTiesEffectPack } from './cards-battle-ties/effect-pack';
import { effectPack as raceMultiPawnEffectPack } from './race-multi-pawn/effect-pack';

/** Deterministic effect-pack composition root. No filesystem discovery occurs at runtime. */
export const jsonEffectPacks = Object.freeze([
  raceMultiPawnEffectPack,
  raceEventCardsEffectPack,
  raceRouteDeliveryEffectPack,
  raceGooseTrackEffectPack,
  collectionTrackZonesEffectPack,
  raceResourceTrackEffectPack,
  raceTreasureTrackEffectPack,
  cardsOrderedParadeEffectPack,
  collectionFamilyRequestEffectPack,
  cardsOrderedAssemblyEffectPack,
  collectionMarketExchangeEffectPack,
  racePairedPawnsEffectPack,
  collectionThemedCirclesEffectPack,
  cardsPublicDomainEffectPack,
  raceProtectedHauntedTrackEffectPack,
  raceBidirectionalCollisionEffectPack,
  collectionFamilyEffectsEffectPack,
  raceTeamPawnCaptureEffectPack,
  raceQuizEventTrackEffectPack,
  raceBounceQuizEffectPack,
  collectionSpeciesTroopsEffectPack,
  raceDirectionalHazardsEffectPack,
  raceChainedTileCardsEffectPack,
  choiceChapterEncounterEffectPack,
  choiceSimultaneousPawScoringEffectPack,
  cardsThemeNameEffectPack,
  cardsRitualPhasesEffectPack,
  boardPropertyEconomyEffectPack,
  choiceAnonymousVoteEffectPack,
  cardsSharedPrestigeEffectPack,
  cardsBattleTiesEffectPack,
  choiceSimultaneousQuizEffectPack,
  boardPathWallsEffectPack,
  choiceStoryChallengeEffectPack,
  cardsDiscardPenaltyEffectPack,
  cardsJudgedSubmissionEffectPack,
  spatialGridPlacementEffectPack,
  boardMovementLandingsEffectPack,
] as const);

/** Generic effect packs indexed by engine domain for authoring and audits. */
export const jsonEffectPacksByDomain = Object.freeze({
  board: Object.freeze(
    jsonEffectPacks.filter((pack) => pack.domain === 'board'),
  ),
  cards: Object.freeze(
    jsonEffectPacks.filter((pack) => pack.domain === 'cards'),
  ),
  choice: Object.freeze(
    jsonEffectPacks.filter((pack) => pack.domain === 'choice'),
  ),
  collection: Object.freeze(
    jsonEffectPacks.filter((pack) => pack.domain === 'collection'),
  ),
  race: Object.freeze(jsonEffectPacks.filter((pack) => pack.domain === 'race')),
  spatial: Object.freeze(
    jsonEffectPacks.filter((pack) => pack.domain === 'spatial'),
  ),
});

export type RegisteredJsonEffectPack = (typeof jsonEffectPacks)[number];
