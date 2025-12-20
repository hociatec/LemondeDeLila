import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class EffectsService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'effects',
      label: 'Effets',
      description: 'Conséquences génériques appliquées au jeu.',
      capabilities: [
        { id: 'draw', description: 'Piocher des cartes dans un paquet donné.' },
        { id: 'skip', description: 'Perdre ou gagner un tour.' },
        {
          id: 'move',
          description:
            'Reculer/avancer de cases ou se déplacer vers une case cible.',
        },
      ],
    };
  }
}
