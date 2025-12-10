import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class VictoryService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'victory',
      label: 'Conditions de victoire',
      description: 'Cadre pour définir et vérifier les conditions gagnantes ou de fin de partie.',
      capabilities: [
        { id: 'criteria', description: 'Définition de critères (objectifs, score, positions).' },
        { id: 'checks', description: 'Évaluation des critères à chaque tour ou événement.' },
        { id: 'resolution', description: 'Annonce du vainqueur et fin de partie.' },
      ],
    };
  }
}
