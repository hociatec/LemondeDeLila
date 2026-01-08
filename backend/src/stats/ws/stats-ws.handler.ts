import { HttpException, Injectable } from '@nestjs/common';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { SocialService } from '../../social/services/social.service';
import { GameStatsService } from '../services/game-stats.service';
import { LeaderboardTopDto } from './leaderboard-ws.dto';
import { StatsUserDto } from './stats-ws.dto';

@Injectable()
export class StatsWsHandler {
  constructor(
    private readonly stats: GameStatsService,
    private readonly validator: PayloadValidationService,
    private readonly social: SocialService,
  ) {}

  async my(session: WsSession) {
    const user = requireUser(session);
    const games = await this.stats.getMyStats(user.id);
    return { type: 'stats.my', payload: { games } };
  }

  async user(session: WsSession, payload: any) {
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

  async leaderboardTop(payload: any) {
    const dto = this.validator.validate(LeaderboardTopDto, payload);
    const entries = await this.stats.getTop10(dto.gameType);
    return {
      type: 'leaderboard.top',
      payload: { gameType: dto.gameType, entries },
    };
  }
}
