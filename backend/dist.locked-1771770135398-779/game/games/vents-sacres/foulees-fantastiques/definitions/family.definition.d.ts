export type FouleesFamilyPack = {
    id: string;
    family: string;
    habitat: string;
    pawns: readonly string[];
};
export declare const FOULEES_FAMILY_PENDING_LABEL = "Choisissez la famille d'animaux que vous souhaitez jouer, puis Entree.";
export declare const FOULEES_FAMILY_PACKS: readonly FouleesFamilyPack[];
export declare function toFouleesFamilyChoice(pack: FouleesFamilyPack): {
    id: string;
    label: string;
};
