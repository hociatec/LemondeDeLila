import { Global, Injectable, Module } from '@nestjs/common';
import {
  MESSAGE_CONTACT_POLICY,
  type MessageContactPolicy,
} from '../../modules/messaging/public-api';
import { SocialRelationshipService } from '../../modules/social/public-api';
import { SocialModule } from '../../modules/social/composition-api';

@Injectable()
export class MessagingContactPolicy implements MessageContactPolicy {
  constructor(private readonly relationships: SocialRelationshipService) {}
  async canSend(senderId: number, recipientId: number): Promise<boolean> {
    const state = await this.relationships.getRelationshipState(
      senderId,
      recipientId,
    );
    return !state.isBlocked && !state.blockedByTarget;
  }
}

@Global()
@Module({
  imports: [SocialModule],
  providers: [
    { provide: MESSAGE_CONTACT_POLICY, useClass: MessagingContactPolicy },
  ],
  exports: [MESSAGE_CONTACT_POLICY],
})
export class AppMessagingContactPolicyModule {}
