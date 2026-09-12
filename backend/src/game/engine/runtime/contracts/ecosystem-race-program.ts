export type EcosystemFace =
  'herbivore' | 'carnivore' | 'egg' | 'leaf' | 'danger';

export type EcosystemRaceProgram = {
  trackId: string;
  diceId: string;
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
  finishReason: string;
  resolvedEvent: string;
  eventNamespace: string;
};
