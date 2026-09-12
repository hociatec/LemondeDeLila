import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type ResourceTrackFace =
  'herbivore' | 'carnivore' | 'egg' | 'leaf' | 'danger';

export type ResourceTrackRaceProgram = TrackRaceProgram & {
  tiles: readonly {
    n: number;
    title: string;
    description: string;
    type: 'comet';
  }[];
  faces: readonly ResourceTrackFace[];
  resources: {
    herbivores: string;
    carnivores: string;
    eggs: string;
    leaves: string;
  };
  dangerCounter: string;
  resolvedEvent: string;
  eventNamespace: string;
};
