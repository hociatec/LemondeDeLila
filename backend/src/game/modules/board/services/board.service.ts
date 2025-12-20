import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class BoardService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'board',
      label: 'Plateau',
      description:
        'Gestion des cases, positions, déplacements et validation des chemins.',
      capabilities: [
        {
          id: 'grid',
          description: 'Représentation du plateau (cases, types, liens).',
        },
        { id: 'position', description: 'Coordonnées des joueurs et entités.' },
        {
          id: 'movement',
          description:
            'Calcul des déplacements et validation des règles de parcours.',
        },
      ],
    };
  }
}
