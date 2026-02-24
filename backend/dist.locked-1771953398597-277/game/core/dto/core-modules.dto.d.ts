export type CoreModuleDescriptor = {
    id: string;
    label: string;
    description?: string;
};
export type CoreModulesResponse = {
    modules: CoreModuleDescriptor[];
};
