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
    skipped?: Array<{
      id: number;
      remainingBefore: number;
      remainingAfter: number;
    }>;
  } {
    if (!players.length) {
      return { turnIndex: currentIndex, currentPlayerId: -1, skipTurn };
    }
    let nextIndex = currentIndex;
    let attempts = 0;
    const updatedSkip = { ...skipTurn };
    const skipped: Array<{
      id: number;
      remainingBefore: number;
      remainingAfter: number;
    }> = [];
    const totalSkips = Object.values(skipTurn).reduce(
      (sum, value) => sum + Math.max(0, value ?? 0),
      0,
    );
    const maxAttempts = players.length + totalSkips;

    do {
      nextIndex = (nextIndex + 1) % players.length;
      const pid = players[nextIndex].id;
      const remaining = updatedSkip[pid] ?? 0;
      if (remaining > 0) {
        const remainingAfter = remaining - 1;
        updatedSkip[pid] = remainingAfter;
        skipped.push({ id: pid, remainingBefore: remaining, remainingAfter });
        attempts += 1;
        continue;
      }
      break;
    } while (attempts < maxAttempts);

    return {
      turnIndex: nextIndex,
      currentPlayerId: players[nextIndex].id,
      skipTurn: updatedSkip,
      ...(skipped.length ? { skipped } : {}),
    };
  }
}
