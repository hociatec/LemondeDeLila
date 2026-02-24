export declare function turnAnnouncement(playerLabel: string): string;
export declare function pawnPlacement(params: {
    playerLabel: string;
    pawnLabel: string;
    position: number;
    tileLabel: string;
}): string;
export declare function diceRoll(params: {
    playerLabel: string;
    value: number;
    sides?: number;
}): string;
export declare function victoryAnnouncement(playerLabel: string): string;
