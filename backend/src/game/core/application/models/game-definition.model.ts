export type PhaseKind = 'player-action' | 'system';

export type RoleDefinition<TRoleId extends string = string> = {
  id: TRoleId;
  name: string;
  unique: boolean;
};

export type PhaseDefinition<TPhaseId extends string = string> = {
  id: TPhaseId;
  kind: PhaseKind;
};

export type ActionDefinition = {
  blocking?: boolean;
  autoResolve?: boolean;
};

export interface GameDefinition<
  TGameId extends string = string,
  TRoleId extends string = string,
  TActionType extends string = string,
  TPhaseId extends string = string,
  TVictory = unknown,
> {
  id: TGameId;
  displayName: string;
  minPlayers: number;
  maxPlayers: number;
  roles: readonly RoleDefinition<TRoleId>[];
  actions: readonly TActionType[];
  actionsMeta?: Partial<Record<TActionType, ActionDefinition>>;
  phaseOrder: readonly PhaseDefinition<TPhaseId>[];
  victory: TVictory;
}
