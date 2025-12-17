import { Injectable } from '@nestjs/common';
import { DameNatureMetadata } from './dame-nature.service';

/**
 * Gestion de la pollution (incrément et détection du seuil).
 * La logique reste simple : on incrémente d'un point à chaque fin de tour,
 * et certains événements peuvent ajouter des points supplémentaires.
 */
@Injectable()
export class DameNaturePollutionService {
  tick(meta: DameNatureMetadata, amount = 1): { metadata: DameNatureMetadata; reachedMax: boolean; delta: number } {
    const current = typeof meta.pollution === 'number' ? meta.pollution : 0;
    const bounded = Math.min(meta.maxPollution, Math.max(0, current + amount));
    const metadata: DameNatureMetadata = { ...meta, pollution: bounded };
    const delta = bounded - current;
    return { metadata, reachedMax: bounded >= meta.maxPollution, delta };
  }
}
