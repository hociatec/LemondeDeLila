export type DameNatureFamilyMember = { id: string; name: string };

export type DameNatureFamily = { id: string; name: string; members: DameNatureFamilyMember[] };

export type DameNatureFamiliesJsonV1 = { version: 1; families: DameNatureFamily[] };

export type DameNatureQuizCardDef = { id: string; question: string; choices: string[]; answer: string };

export type DameNatureQuizJsonV1 = { version: 1; quiz: DameNatureQuizCardDef[] };

export type DameNatureDangerCardDef = { id: string; label: string; pollutionDelta: number };

export type DameNaturePollutionJsonV1 = { version: 1; maxPollution: number; cards: DameNatureDangerCardDef[] };
