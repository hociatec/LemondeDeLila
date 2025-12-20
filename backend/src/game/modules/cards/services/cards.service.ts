import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class CardsService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'cards',
      label: 'Cartes',
      description:
        'Gestion des paquets : pioche, mélange, défausse et multi-types de cartes.',
      capabilities: [
        {
          id: 'decks',
          description: 'Création et configuration de paquets multiples.',
        },
        {
          id: 'draw-discard',
          description: 'Pioche, défausse et remise en jeu.',
        },
        {
          id: 'shuffling',
          description: 'Mélange et randomisation configurables.',
        },
      ],
    };
  }
}
