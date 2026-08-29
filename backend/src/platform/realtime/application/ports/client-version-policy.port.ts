export const CLIENT_VERSION_POLICY = Symbol('CLIENT_VERSION_POLICY');

export interface ClientVersionPolicy {
  getMinimumVersion(product: string | null): Promise<string | null>;
}
