export type CapabilityDto = {
  id: string;
  description: string;
};

export type ModuleOverviewDto = {
  id: string;
  label: string;
  description: string;
  capabilities: CapabilityDto[];
};
