import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../../models/generic-module.model';

@Injectable()
export class ExchangeService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'exchange',
      label: 'Echange',
      description:
        'Mecanismes d echange entre joueurs (cartes, ressources, troc).',
      capabilities: [
        {
          id: 'offers',
          description: 'Creation et validation d offres d echange.',
        },
        {
          id: 'constraints',
          description: 'Regles d eligibilite et contraintes de jeu.',
        },
        {
          id: 'resolution',
          description: 'Application des echanges et mise a jour des inventaires.',
        },
      ],
    };
  }
}
