import { Injectable } from '@nestjs/common';
import type { DameNatureMetadata } from '../model/dame-nature.model';

/**
 * Gestion de la pollution (incrément et détection du seuil).
 * La logique reste simple : on incrémente d'un point à chaque fin de tour,
 * et certains événements peuvent ajouter des points supplémentaires.
 */
@Injectable()
export class DameNaturePollutionService {
  get(meta: DameNatureMetadata, playerId: number): number {
    return (meta.pollutionByPlayer ?? {})[String(playerId)] ?? 0;
  }

  tick(
    meta: DameNatureMetadata,
    playerId: number,
    amount = 1,
  ): {
    metadata: DameNatureMetadata;
    reachedMax: boolean;
    delta: number;
    playerPollution: number;
  } {
    const key = String(playerId);
    const current = (meta.pollutionByPlayer ?? {})[key] ?? 0;
    const bounded = Math.min(meta.maxPollution, Math.max(0, current + amount));
    const pollutionByPlayer = {
      ...(meta.pollutionByPlayer ?? {}),
      [key]: bounded,
    };
    const metadata: DameNatureMetadata = { ...meta, pollutionByPlayer };
    const delta = bounded - current;
    const reachedMax = Object.values(pollutionByPlayer).some(
      (v) => (typeof v === 'number' ? v : 0) >= meta.maxPollution,
    );
    return { metadata, reachedMax, delta, playerPollution: bounded };
  }
}
