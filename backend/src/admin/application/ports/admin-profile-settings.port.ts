export interface AdminProfileSettings {
  bioMinLength?: number;
  bioMaxLength?: number;
}

export interface AdminProfileSettingsPort {
  get(): AdminProfileSettings;
  update(update: AdminProfileSettings): Promise<AdminProfileSettings>;
}

export const ADMIN_PROFILE_SETTINGS_PORT = Symbol(
  'ADMIN_PROFILE_SETTINGS_PORT',
);
