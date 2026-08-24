import type { NawakMetadata } from '../../model/nawak-state.model';
import type { NawakChallenge } from '../../model/nawak-challenge.model';

export const NAWAK_CHALLENGE_PORT = Symbol('NAWAK_CHALLENGE_PORT');

export interface NawakChallengePort {
  loadChallenge(meta: NawakMetadata): {
    challenge: NawakChallenge;
    meta: NawakMetadata;
  };
}
