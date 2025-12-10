import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class ExchangeService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'exchange',
      label: 'Échange',
      description: 'Mécanismes d’échange entre joueurs (cartes, ressources, troc).',
      capabilities: [
        { id: 'offers', description: 'Création et validation d’offres d’échange.' },
        { id: 'constraints', description: 'Règles d’éligibilité et contraintes de jeu.' },
        { id: 'resolution', description: 'Application des échanges et mise à jour des inventaires.' },
      ],
    };
  }
}
