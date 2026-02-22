"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVariantChoiceLabel = exports.parseVariantInput = exports.getVariantIndex = exports.SAC_VARIANT_COUNT = exports.SAC_VARIANT_BY_ID = exports.SAC_VARIANTS = void 0;
const baseRules = {
    startMoney: 2000,
    passStartBonus: 200,
    potEnabled: true,
    rentBlockedInJail: true,
    jail: {
        maxTurns: 3,
        autoFine: 100,
        allowPayFine: true,
        allowDoubleEscape: false,
    },
};
const buildRules = (overrides = {}) => ({
    ...baseRules,
    ...overrides,
    jail: {
        ...baseRules.jail,
        ...(overrides.jail ?? {}),
    },
});
exports.SAC_VARIANTS = [
    {
        id: 'classic',
        label: 'Chouette et fortune !',
        summary: 'Jeu de type Monopoly (version Dijon).',
        gameType: 'sac-a-malices',
        rules: buildRules(),
        utilitiesMin: 1,
    },
    {
        id: 'gaia',
        label: 'Gaïa',
        summary: 'Variante écologie : projets durables et cartes Chance/Communauté.',
        gameType: 'sac-a-malices-gaia',
        contentDir: 'variants/gaia/model/content',
        rules: buildRules({
            startMoney: 1500,
            potEnabled: false,
            rentBlockedInJail: false,
        }),
        utilitiesMin: 0,
    },
    {
        id: 'violette-boussole',
        label: 'Violette & Boussole',
        summary: 'Variante Toulouse : propriétés, loyers, Chance/Caisse, Parc Gratuit.',
        gameType: 'sac-a-malices-violette-boussole',
        contentDir: 'variants/violette-boussole/model/content',
        rules: buildRules(),
        utilitiesMin: 1,
    },
    {
        id: 'sabord-quai',
        label: 'Sabord et Quai',
        summary: 'Variante Nantes : propriétés, loyers, Chance/Caisse, Parc Gratuit.',
        gameType: 'sac-a-malices-sabord-quai',
        contentDir: 'variants/sabord-quai/model/content',
        rules: buildRules(),
        utilitiesMin: 1,
    },
    {
        id: 'route-des-flandres',
        label: 'La Route des Flandres',
        summary: 'Variante Lille : achetez, construisez, payez des loyers.',
        gameType: 'sac-a-malices-route-des-flandres',
        contentDir: 'variants/route-des-flandres/model/content',
        rules: buildRules(),
        utilitiesMin: 1,
    },
    {
        id: 'cosmos-credit',
        label: 'Cosmos & Crédit',
        summary: 'Variante cosmique : anomalies/événements, doubles pour sortir de prison.',
        gameType: 'sac-a-malices-cosmos-credit',
        contentDir: 'variants/cosmos-credit/model/content',
        rules: buildRules({
            startMoney: 1500,
            potEnabled: false,
            rentBlockedInJail: false,
            jail: {
                autoFine: 0,
                allowPayFine: false,
                allowDoubleEscape: true,
            },
        }),
        utilitiesMin: 0,
    },
    {
        id: 'pintzel-couronnes',
        label: 'Pintzel & Couronnes !',
        summary: 'Variante Strasbourg : propriétés, loyers, Chance/Caisse, Parc Gratuit.',
        gameType: 'sac-a-malices-pintzel-couronnes',
        contentDir: 'variants/pintzel-couronnes/model/content',
        rules: buildRules(),
        utilitiesMin: 1,
    },
];
exports.SAC_VARIANT_BY_ID = exports.SAC_VARIANTS.reduce((acc, variant) => {
    acc[variant.id] = variant;
    return acc;
}, {});
const aliasToVariant = {
    classic: 'classic',
    classique: 'classic',
    dijon: 'classic',
    base: 'classic',
    sacamalices: 'classic',
    'sac-a-malices': 'classic',
    gaia: 'gaia',
    violette: 'violette-boussole',
    boussole: 'violette-boussole',
    'violette-boussole': 'violette-boussole',
    'violette-et-boussole': 'violette-boussole',
    sabord: 'sabord-quai',
    quai: 'sabord-quai',
    'sabord-quai': 'sabord-quai',
    'sabord-et-quai': 'sabord-quai',
    flandres: 'route-des-flandres',
    'route-des-flandres': 'route-des-flandres',
    'route-flandres': 'route-des-flandres',
    cosmos: 'cosmos-credit',
    credit: 'cosmos-credit',
    'cosmos-credit': 'cosmos-credit',
    'cosmos-et-credit': 'cosmos-credit',
    pintzel: 'pintzel-couronnes',
    couronnes: 'pintzel-couronnes',
    'pintzel-couronnes': 'pintzel-couronnes',
};
for (const variant of exports.SAC_VARIANTS) {
    aliasToVariant[`sac-a-malices-${variant.id}`] = variant.id;
}
const normalizeKey = (value) => String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
exports.SAC_VARIANT_COUNT = exports.SAC_VARIANTS.length;
const getVariantIndex = (id) => {
    const idx = exports.SAC_VARIANTS.findIndex((v) => v.id === id);
    return idx >= 0 ? idx + 1 : 1;
};
exports.getVariantIndex = getVariantIndex;
const parseVariantInput = (raw) => {
    if (raw == null)
        return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        const index = Math.trunc(raw);
        const picked = exports.SAC_VARIANTS[index - 1];
        return picked ? picked.id : null;
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed)
            return null;
        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber)) {
            const index = Math.trunc(asNumber);
            const picked = exports.SAC_VARIANTS[index - 1];
            if (picked)
                return picked.id;
        }
        const key = normalizeKey(trimmed);
        if (!key)
            return null;
        if (aliasToVariant[key])
            return aliasToVariant[key];
    }
    return null;
};
exports.parseVariantInput = parseVariantInput;
const buildVariantChoiceLabel = () => {
    return exports.SAC_VARIANTS.map((variant, idx) => `${idx + 1}=${variant.label}`).join(' ; ');
};
exports.buildVariantChoiceLabel = buildVariantChoiceLabel;
//# sourceMappingURL=sac-a-malices-variants.js.map