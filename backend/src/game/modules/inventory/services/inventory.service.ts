import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class InventoryService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'inventory',
      label: 'Inventaire',
      description: 'Suivi des possessions des joueurs (cartes, ressources, statuts).',
      capabilities: [
        { id: 'items', description: 'Gestion des éléments détenus (ajout/retrait).' },
        { id: 'lists', description: 'Listes d’objectifs ou collections à compléter.' },
        { id: 'statuses', description: 'États temporaires (perte de tour, bonus).' },
      ],
    };
  }
}
