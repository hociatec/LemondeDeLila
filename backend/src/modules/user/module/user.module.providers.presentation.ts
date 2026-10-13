import { AuthWsHandler } from '../infrastructure/presentation/ws/auth-ws.handler';
import { UserShortcutsWsRegistrar } from '../infrastructure/presentation/ws/user-shortcuts-ws.registrar';
import { UserWsHandler } from '../infrastructure/presentation/ws/user-ws.handler';
import { UserWsRegistrar } from '../infrastructure/presentation/ws/user-ws.registrar';

export const USER_PRESENTATION_PROVIDERS = [
  UserShortcutsWsRegistrar,
  AuthWsHandler,
  UserWsHandler,
  UserWsRegistrar,
];
