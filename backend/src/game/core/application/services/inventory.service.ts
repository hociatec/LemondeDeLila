import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../models/generic-module.model';

@Injectable()
export class InventoryService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'inventory',
      label: 'Inventaire',
      description:
        'Suivi des possessions des joueurs (cartes, ressources, statuts).',
      capabilities: [
        {
          id: 'items',
          description: 'Gestion des elements detenus (ajout/retrait).',
        },
        {
          id: 'lists',
          description: 'Listes d objectifs ou collections a completer.',
        },
        {
          id: 'statuses',
          description: 'Etats temporaires (perte de tour, bonus).',
        },
      ],
    };
  }
}
