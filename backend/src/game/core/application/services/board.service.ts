import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../models/generic-module.model';

@Injectable()
export class BoardService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'board',
      label: 'Plateau',
      description:
        'Gestion des cases, positions, deplacements et validation des chemins.',
      capabilities: [
        {
          id: 'grid',
          description: 'Representation du plateau (cases, types, liens).',
        },
        { id: 'position', description: 'Coordonnees des joueurs et entites.' },
        {
          id: 'movement',
          description:
            'Calcul des deplacements et validation des regles de parcours.',
        },
      ],
    };
  }
}
