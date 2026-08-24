import { HttpException, Injectable } from '@nestjs/common';
import { requireUser } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { SocialInteractionsService } from '../../../../social/public-api';
import { GameStatsService } from '../../../application/services/game-stats.service';
import { LeaderboardTopDto } from './dto/leaderboard-ws.dto';
import { StatsUserDto } from './dto/stats-ws.dto';

@Injectable()
export class StatsWsHandler {
  constructor(
    private readonly stats: GameStatsService,
    private readonly validator: PayloadValidationService,
    private readonly social: SocialInteractionsService,
  ) {}

  async my(session: WsSession) {
    const user = requireUser(session);
    const games = await this.stats.getMyStats(user.id);
    return { type: 'stats.my', payload: { games } };
  }

  async user(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(StatsUserDto, payload);

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const isAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
    if (!isAdmin) {
      const profile = await this.social.getProfile(user.id, dto.userId);
      if (!profile.isOwner && !profile.canView) {
        throw new HttpException('Profil privé.', 403);
      }
    }

    const games = await this.stats.getMyStats(dto.userId);
    return { type: 'stats.user', payload: { userId: dto.userId, games } };
  }

  async leaderboardGames() {
    const games = await this.stats.getLeaderboardGames();
    return { type: 'leaderboard.games', payload: { games } };
  }

  async leaderboardTop(payload: unknown) {
    const dto = this.validator.validate(LeaderboardTopDto, payload);
    const entries = await this.stats.getTop10(dto.gameType);
    return {
      type: 'leaderboard.top',
      payload: { gameType: dto.gameType, entries },
    };
  }
}

