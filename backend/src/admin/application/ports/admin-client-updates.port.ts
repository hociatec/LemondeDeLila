export interface AdminClientUpdateLatest {
  version?: string | null;
  publishedAt?: string | null;
  message?: string | null;
  publicUrl?: string | null;
  minRequiredVersion?: string | null;
}

export interface AdminClientUpdatesPort {
  getLatest(): Promise<AdminClientUpdateLatest | null>;
  getPublishedClickOnceVersionFromDisk(): Promise<string | null>;
  saveLatest(input: {
    version: string;
    publishedAt: string;
    message: string | null;
    publicUrl: string | null;
    minRequiredVersion: string;
  }): Promise<void>;
  resolveClientPublicUrl(
    latest: AdminClientUpdateLatest | null,
  ): string | null;
}

export const ADMIN_CLIENT_UPDATES_PORT = Symbol('ADMIN_CLIENT_UPDATES_PORT');
