/** Single-consumer JSON authoring extension; prefer shared effects and patterns for new rules. */
import type { TrackRaceProgram } from '../../contracts/track-race-contract';

export type EcosystemFace =
  'herbivore' | 'carnivore' | 'egg' | 'leaf' | 'danger';

export type EcosystemRaceProgram = TrackRaceProgram & {
  tiles: readonly {
    n: number;
    title: string;
    description: string;
    type: 'comet';
  }[];
  faces: readonly EcosystemFace[];
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
