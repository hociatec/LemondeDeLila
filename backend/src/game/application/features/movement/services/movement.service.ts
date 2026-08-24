import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../../models/generic-module.model';

@Injectable()
export class MovementService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'movement',
      label: 'Deplacement',
      description:
        'Deplacements issus du de ou d effets, avec validation des limites du plateau.',
      capabilities: [
        {
          id: 'dice',
          description: 'Appliquer les resultats de de sur le mouvement.',
        },
        {
          id: 'effects',
          description: 'Deplacements forces (reculer, avancer, teleportation).',
        },
        {
          id: 'bounds',
          description: 'Validation des bords, cases speciales et rebonds.',
        },
      ],
    };
  }
}
