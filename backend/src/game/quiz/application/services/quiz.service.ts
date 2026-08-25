import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../../core/application/models/generic-module.model';

@Injectable()
export class QuizService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'quiz',
      label: 'Quiz',
      description: 'Gestion des questions/reponses et validation.',
      capabilities: [
        {
          id: 'questions',
          description: 'Selection et distribution de questions.',
        },
        { id: 'answers', description: 'Reception et validation des reponses.' },
        {
          id: 'rewards',
          description: 'Application des effets (bonus/malus) selon la reponse.',
        },
      ],
    };
  }
}
