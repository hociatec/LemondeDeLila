import type { PlayerMap } from '../../../core/application/public-api';

export type OlympiaState = Record<string, never>;

export type OlympiaPlayerView = {
  divinity: PlayerMap<string>;
};
