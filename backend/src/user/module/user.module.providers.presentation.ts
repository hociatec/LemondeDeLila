import { AuthWsHandler } from '../infrastructure/presentation/ws/auth-ws.handler';
import { UserWsHandler } from '../infrastructure/presentation/ws/user-ws.handler';
import { UserWsRegistrar } from '../infrastructure/presentation/ws/user-ws.registrar';

export const USER_PRESENTATION_PROVIDERS = [
  AuthWsHandler,
  UserWsHandler,
  UserWsRegistrar,
];
