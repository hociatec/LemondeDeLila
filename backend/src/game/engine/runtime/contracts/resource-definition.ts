export type ResourceDefinition<TResourceId extends string = string> = {
  readonly component: 'resource.pool';
  readonly id: TResourceId;
  readonly initial?: number;
  readonly min?: number;
  readonly max?: number;
};
