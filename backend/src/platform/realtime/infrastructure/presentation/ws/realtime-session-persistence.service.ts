import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SESSION_STORE,
  type SessionStateStore,
} from '../../../../session/public-api';
import { bestEffort } from '../../../../observability/public-api';
import { getErrorMessage } from '../../../../../shared/utils/public-api';
import type { RealtimeClientSession } from './realtime-api.types';

/** Maps connection identity to session storage and owns its failure policy. */
@Injectable()
export class RealtimeSessionPersistenceService {
  private readonly logger = new Logger(RealtimeSessionPersistenceService.name);
  constructor(
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStateStore,
  ) {}
  async persistSession(
    session: Pick<RealtimeClientSession, 'connectionId' | 'user'>,
  ): Promise<void> {
    try {
      await this.sessionStore.save(session.connectionId, {
        userId: session.user?.id ?? null,
        username: session.user?.username,
        roles: session.user?.roles ?? null,
      });
    } catch (err) {
      this.logger.warn(
        `Impossible de persister la session WS (connectionId=${session.connectionId}): ${getErrorMessage(err)}`,
      );
    }
  }

  async clearSession(connectionId: string): Promise<void> {
    await bestEffort(
      this.sessionStore.delete(connectionId),
      `suppression session realtime connection=${connectionId}`,
      this.logger,
    );
  }
}
