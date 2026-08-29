import { SOCIAL_RELATIONSHIP_NOTIFIER } from '../application/ports/social-relationship-notifier.port';
import { SocialWsHandler } from '../infrastructure/presentation/ws/social-ws.handler';
import { SocialWsRelationshipNotifierService } from '../infrastructure/presentation/ws/social-ws-relationship-notifier.service';
import { SocialWsRegistrar } from '../infrastructure/presentation/ws/social-ws.registrar';

export const SOCIAL_PRESENTATION_PROVIDERS = [
  SocialWsHandler,
  SocialWsRelationshipNotifierService,
  SocialWsRegistrar,
  {
    provide: SOCIAL_RELATIONSHIP_NOTIFIER,
    useExisting: SocialWsRelationshipNotifierService,
  },
];
