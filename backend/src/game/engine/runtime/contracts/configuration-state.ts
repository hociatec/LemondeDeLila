export type GameConfigurationState<
  TValues extends object = Record<string, unknown>,
> = {
  ownerPlayerId: number | null;
  complete: boolean;
  values: TValues;
};
