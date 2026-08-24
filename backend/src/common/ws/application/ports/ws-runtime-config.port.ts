export const WS_RUNTIME_CONFIG = Symbol('WS_RUNTIME_CONFIG');

export type WsRuntimeConfig = {
  nodeEnv: string;
  sharedSecret: string | null;
  wsTicketSecret: string | null;
  wsTicketTtlSeconds: number;
  jwtIssuer: string;
  jwtAudience: string | null;
  jwtClockToleranceSeconds: number;
  jwtAlgorithm: string | null;
  jwtSecret: string | null;
  jwtPrivateKeyPem: string | null;
  jwtPrivateKeyPath: string | null;
  jwtPublicKeyPem: string | null;
  jwtPublicKeyPath: string | null;
};
