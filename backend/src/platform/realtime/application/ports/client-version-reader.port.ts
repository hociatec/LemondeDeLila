export const CLIENT_VERSION_READER = Symbol('CLIENT_VERSION_READER');

export interface ClientVersionReader {
  getMinimumVersion(product: string | null): Promise<string | null>;
}
