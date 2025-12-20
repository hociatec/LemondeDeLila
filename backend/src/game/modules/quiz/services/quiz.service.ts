import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class QuizService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'quiz',
      label: 'Quiz',
      description: 'Gestion des questions/réponses et validation.',
      capabilities: [
        {
          id: 'questions',
          description: 'Sélection et distribution de questions.',
        },
        { id: 'answers', description: 'Réception et validation des réponses.' },
        {
          id: 'rewards',
          description: 'Application des effets (bonus/malus) selon la réponse.',
        },
      ],
    };
  }
}
