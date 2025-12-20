import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class MovementService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'movement',
      label: 'Déplacement',
      description:
        'Déplacements issus du dé ou d’effets, avec validation des limites du plateau.',
      capabilities: [
        {
          id: 'dice',
          description: 'Appliquer les résultats de dé sur le mouvement.',
        },
        {
          id: 'effects',
          description: 'Déplacements forcés (reculer, avancer, téléportation).',
        },
        {
          id: 'bounds',
          description: 'Validation des bords, cases spéciales et rebonds.',
        },
      ],
    };
  }
}
