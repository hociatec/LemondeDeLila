export type TiePolicy = 'no-kill' | 'random' | 'all';
export type VoteResult = {
    winnerId: number | null;
    tie: boolean;
    tally: Record<number, number>;
};
export declare class VoteService {
    resolveVotes(votes: Record<number, number | null | undefined>, tiePolicy?: TiePolicy): VoteResult;
}
