export interface ContextConfigurationCapability {
  isComplete(): boolean;
  owner(): number | null;
  values<TConfig extends object = Record<string, unknown>>(): TConfig;
  get<TValue>(key: string): TValue | null;
}
