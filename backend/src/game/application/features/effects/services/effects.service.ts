import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../../models/generic-module.model';

@Injectable()
export class EffectsService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'effects',
      label: 'Effets',
      description: 'Consequences generiques appliquees au jeu.',
      capabilities: [
        { id: 'draw', description: 'Piocher des cartes dans un paquet donne.' },
        { id: 'skip', description: 'Perdre ou gagner un tour.' },
        {
          id: 'move',
          description:
            'Reculer/avancer de cases ou se deplacer vers une case cible.',
        },
      ],
    };
  }
}
