import type {
  MissionGalaxieChoiceCard,
  MissionGalaxieEventCard,
  MissionGalaxieTile,
} from './mission-galaxie-state.model';

export type MissionGalaxieBoardJsonV1 = {
  version: 1;
  tiles: MissionGalaxieTile[];
};

export type MissionGalaxieQuestionsJsonV1 = {
  version: 1;
  questions: MissionGalaxieChoiceCard[];
};

export type MissionGalaxieChallengesJsonV1 = {
  version: 1;
  challenges: MissionGalaxieChoiceCard[];
};

export type MissionGalaxieEventsJsonV1 = {
  version: 1;
  events: MissionGalaxieEventCard[];
};

