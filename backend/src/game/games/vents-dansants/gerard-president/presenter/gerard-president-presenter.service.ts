import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type {
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import type { GerardPresidentMetadata } from '../model/gerard-president-state.entity';

@Injectable()
export class GerardPresidentPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const metadata = (state.metadata ?? {}) as GerardPresidentMetadata;
    const submissions = metadata.submissions ?? {};
    const sanitizedSubmissions: Record<number, string[]> = {};
    Object.entries(submissions).forEach(([key, names]) => {
      const playerId = Number(key);
      sanitizedSubmissions[playerId] =
        playerId === userId
          ? [...(names ?? [])]
          : (names ?? []).map(() => 'Prénom secret');
    });

    const hand = metadata.hands?.[userId] ?? [];
    const specialHand = metadata.specialHands?.[userId] ?? [];

    const handCounts: Record<number, number> = {};
    Object.entries(metadata.hands ?? {}).forEach(([key, values]) => {
      const playerId = Number(key);
      if (Number.isFinite(playerId)) {
        handCounts[playerId] = Array.isArray(values) ? values.length : 0;
      }
    });

    const isMaster = metadata.masterId === userId;
    const themeHidden =
      metadata.themeSecretActive && metadata.masterId != null && !isMaster;
    const currentTheme = themeHidden ? 'Thème secret' : metadata.currentTheme;
    const secondTheme =
      themeHidden && metadata.secondTheme ? 'Thème secret' : metadata.secondTheme;

    return {
      ...state,
      metadata: {
        ...metadata,
        currentTheme,
        secondTheme,
        hands: { [userId]: [...hand] },
        specialHands: { [userId]: [...specialHand] },
        submissions: sanitizedSubmissions,
      },
      extras: {
        handCounts,
      },
    };
  }
}
