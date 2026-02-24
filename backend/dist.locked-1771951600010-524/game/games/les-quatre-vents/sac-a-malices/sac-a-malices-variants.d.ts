import type { SacMetadata, SacVariantId } from './model/sac-a-malices.types';
type SacRules = NonNullable<SacMetadata['rules']>;
export type SacVariantConfig = {
    id: SacVariantId;
    label: string;
    summary: string;
    gameType: string;
    contentDir?: string;
    rules: SacRules;
    utilitiesMin: number;
};
export declare const SAC_VARIANTS: SacVariantConfig[];
export declare const SAC_VARIANT_BY_ID: Record<SacVariantId, SacVariantConfig>;
export declare const SAC_VARIANT_COUNT: number;
export declare const getVariantIndex: (id: SacVariantId) => number;
export declare const parseVariantInput: (raw: unknown) => SacVariantId | null;
export declare const buildVariantChoiceLabel: () => string;
export {};
