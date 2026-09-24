import type { TrackRaceProgram } from '../../../engine/sdk/extension-contracts';

export type ResourceTrackFace = string;

export type ResourceTrackRaceProgram = TrackRaceProgram & {
  tiles: readonly {
    n: number;
    title: string;
    description: string;
    type: string;
  }[];
  faces: readonly ResourceTrackFace[];
  resources: Readonly<Record<string, string>>;
  mechanics: {
    rerollValues: readonly number[];
    rerollLimit: number;
    advance: number;
    faceGains: Readonly<
      Record<
        string,
        readonly {
          resources: readonly string[];
          amount: number;
          select: 'first' | 'largest';
        }[]
      >
    >;
    tileRules: readonly {
      position: number;
      faces?: readonly string[];
      greaterResource?: { left: string; right: string };
      gains: Readonly<Record<string, number>>;
      setCounter?: { id: string; value: number };
      event?: string;
    }[];
    dangerFaces: readonly string[];
    dangerDistance: number;
    amplifiedDistance: number;
    extraDistance: Readonly<Record<string, number>>;
    ranking: readonly (readonly string[])[];
  };
  dangerCounter: string;
  resolvedEvent: string;
  eventNamespace: string;
};
