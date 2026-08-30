import type {
  SubmissionFlowStage,
  SubmissionKitState,
  SubmissionPlayerView,
} from '../submissions/submission-controller';

export function projectSubmissions<TSubmission>(
  state: SubmissionKitState<TSubmission>,
  viewerPlayerId: number | null,
): SubmissionPlayerView<TSubmission> {
  return {
    stage: projectSubmissionStage(state),
    sessions: Object.fromEntries(
      Object.entries(state.sessions).map(([id, session]) => {
        const submittedPlayerIds = Object.keys(session.valuesByPlayerId).map(
          Number,
        );
        const pendingPlayerIds = session.participantPlayerIds.filter(
          (playerId) => !submittedPlayerIds.includes(playerId),
        );
        const maySeeAll = session.revealed || !session.secret;
        const ownValue =
          viewerPlayerId == null
            ? undefined
            : session.valuesByPlayerId[String(viewerPlayerId)];
        return [
          id,
          {
            kind: session.kind,
            participantPlayerIds: [...session.participantPlayerIds],
            submittedPlayerIds,
            pendingPlayerIds,
            closed: session.closed,
            revealed: session.revealed,
            ...(maySeeAll
              ? {
                  valuesByPlayerId: structuredClone(session.valuesByPlayerId),
                }
              : ownValue === undefined
                ? {}
                : { ownValue: structuredClone(ownValue) }),
          },
        ];
      }),
    ),
    judges: Object.fromEntries(
      Object.entries(state.judges).map(([id, rotation]) => [
        id,
        {
          playerId:
            rotation.playerIds[rotation.index % rotation.playerIds.length],
          playerIds: [...rotation.playerIds],
          index: rotation.index,
        },
      ]),
    ),
  };
}

function projectSubmissionStage(
  state: SubmissionKitState<unknown>,
): SubmissionFlowStage {
  const sessions = Object.values(state.sessions);
  const vote = sessions.find((session) => session.kind === 'vote');
  if (vote) return vote.closed ? 'complete' : 'voting';
  const submission = sessions.find((session) => session.kind === 'submission');
  if (!submission) return 'idle';
  if (!submission.closed) return 'collecting';
  return submission.revealed ? 'revealed' : 'ready-to-reveal';
}
