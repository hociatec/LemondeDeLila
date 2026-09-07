export const WS_RUNTIME_CONFIG = Symbol('WS_RUNTIME_CONFIG');

export type WsRuntimeConfig = {
  nodeEnv: string;
  wsTicketSecret: string | null;
  wsTicketTtlSeconds: number;
  jwtIssuer: string;
  jwtAudience: string | null;
  jwtClockToleranceSeconds: number;
  jwtPrivateKeyPem: string | null;
  jwtPrivateKeyPath: string | null;
  jwtPublicKeyPem: string | null;
  jwtPublicKeyPath: string | null;
  maxBufferedBytes: number;
};
