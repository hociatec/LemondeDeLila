import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../core/application/models/generic-module.model';

@Injectable()
export class CardsService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'cards',
      label: 'Cartes',
      description:
        'Gestion des paquets : pioche, melange, defausse et multi-types de cartes.',
      capabilities: [
        {
          id: 'decks',
          description: 'Creation et configuration de paquets multiples.',
        },
        {
          id: 'draw-discard',
          description: 'Pioche, defausse et remise en jeu.',
        },
        {
          id: 'shuffling',
          description: 'Melange et randomisation configurables.',
        },
      ],
    };
  }
}
