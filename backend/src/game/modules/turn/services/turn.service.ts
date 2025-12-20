import { Injectable } from '@nestjs/common';
import type { ModuleOverviewDto } from '../../dto/generic-module.dto';

@Injectable()
export class TurnService {
  getOverview(): ModuleOverviewDto {
    return {
      id: 'turn',
      label: 'Tour de jeu',
      description:
        'Gestion de l’ordre des joueurs, sens de rotation et sauts de tour.',
      capabilities: [
        {
          id: 'order',
          description: 'Suivi de l’ordre des joueurs et du joueur courant.',
        },
        {
          id: 'direction',
          description: 'Sens horaire/anti-horaire et inversions.',
        },
        { id: 'skip', description: 'Perte de tour et pénalités temporelles.' },
      ],
    };
  }

  nextTurn(
    players: Array<{ id: number }>,
    currentIndex: number,
    skipTurn: Record<number, number>,
  ): {
    turnIndex: number;
    currentPlayerId: number;
    skipTurn: Record<number, number>;
  } {
    if (!players.length) {
      return { turnIndex: currentIndex, currentPlayerId: -1, skipTurn };
    }
    let nextIndex = currentIndex;
    let attempts = 0;
    const updatedSkip = { ...skipTurn };

    do {
      nextIndex = (nextIndex + 1) % players.length;
      const pid = players[nextIndex].id;
      const remaining = updatedSkip[pid] ?? 0;
      if (remaining > 0) {
        updatedSkip[pid] = remaining - 1;
        attempts += 1;
        continue;
      }
      break;
    } while (attempts < players.length);

    return {
      turnIndex: nextIndex,
      currentPlayerId: players[nextIndex].id,
      skipTurn: updatedSkip,
    };
  }
}
