import { Injectable } from '@nestjs/common';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { GameStatsService } from '../services/game-stats.service';
import { LeaderboardTopDto } from './leaderboard-ws.dto';

@Injectable()
export class StatsWsHandler {
  constructor(
    private readonly stats: GameStatsService,
    private readonly validator: PayloadValidationService,
  ) {}

  async my(session: WsSession) {
    const user = requireUser(session);
    const games = await this.stats.getMyStats(user.id);
    return { type: 'stats.my', payload: { games } };
  }

  async leaderboardGames() {
    const games = await this.stats.getLeaderboardGames();
    return { type: 'leaderboard.games', payload: { games } };
  }

  async leaderboardTop(payload: any) {
    const dto = this.validator.validate(LeaderboardTopDto, payload);
    const entries = await this.stats.getTop10(dto.gameType);
    return { type: 'leaderboard.top', payload: { gameType: dto.gameType, entries } };
  }
}

