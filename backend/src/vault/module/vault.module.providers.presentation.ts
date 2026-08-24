import { VaultWsHandler } from '../infrastructure/presentation/ws/vault-ws.handler';
import { VaultWsRegistrar } from '../infrastructure/presentation/ws/vault-ws.registrar';

export const VAULT_PRESENTATION_PROVIDERS = [
  VaultWsHandler,
  VaultWsRegistrar,
];
