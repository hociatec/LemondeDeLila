export interface LamaLikePanel {
    title: string;
    message: string;
}
export type LamaLikePanelParams = {
    hand: string[];
    handCounts?: Record<number, number>;
    discardLabel?: string;
    playMessage?: string;
    handsMessage?: string;
    scoreLines?: string[];
    tableMessage?: string;
};
export declare function buildLamaLikePanels(params: LamaLikePanelParams): Record<string, LamaLikePanel>;
export declare function summarizeHandCounts(hands?: Record<string | number, unknown[]>): Record<number, number>;
