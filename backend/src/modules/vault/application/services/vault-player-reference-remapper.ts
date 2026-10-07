// Persisted player references are different from ordinary numeric game values.
const playerKeyPaths = [
  'turn.scheduledTurnReplacements',
  'scores',
  'engine.match.playerStatuses',
  'engine.playerValues.scores',
  'engine.playerValues.resources.*',
  'engine.playerValues.statuses',
  'engine.playerValues.scheduledSkips',
  'engine.playerValues.scheduledExtraTurns',
  'engine.kits.cards.hands.*',
  'engine.kits.cards.completedSets.*',
  'engine.kits.inventory.byPlayer.*',
  'engine.kits.movement.positions.*',
  'engine.kits.pawns.assignments.*',
  'engine.kits.dice.rollsByPlayer',
  'engine.kits.quiz.sessions.*.answers',
  'engine.submissions.sessions.*.valuesByPlayerId',
];
const playerValuePaths = [
  'players.*.id',
  'turn.scheduledTurnReplacements.*',
  'engine.match.result.ranking',
  'engine.submissions.sessions.*.valueOrder',
  'engine.kits.pawns.owners.*.*',
  'engine.kits.ownership.owners.*.*',
];

function matches(
  path: readonly string[],
  patterns: readonly string[],
): boolean {
  return patterns.some((pattern) => {
    const parts = pattern.split('.');
    return (
      parts.length === path.length &&
      parts.every((part, index) => part === '*' || part === path[index])
    );
  });
}

export function remapPlayerReferences(
  value: unknown,
  ids: ReadonlyMap<number, number>,
  path: readonly string[] = [],
  reference = false,
): unknown {
  if (path.length > 64)
    throw new Error('État de jeu trop profond pour la restauration.');
  if (typeof value === 'number')
    return reference ? (ids.get(value) ?? value) : value;
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    if (value.length > 10_000)
      throw new Error('Collection de jeu trop volumineuse.');
    return value.map((item, index) => {
      const nextPath = [...path, String(index)];
      return remapPlayerReferences(
        item,
        ids,
        nextPath,
        reference || matches(nextPath, playerValuePaths),
      );
    });
  }
  const entries = Object.entries(value);
  if (entries.length > 10_000)
    throw new Error('Collection de jeu trop volumineuse.');
  const record = value as Record<string, unknown>;
  const mapKeys =
    matches(path, playerKeyPaths) || path.at(-1) === 'privateDataByPlayer';
  const keys = new Set<string>();
  return Object.fromEntries(
    entries.map(([key, item]) => {
      const numeric = Number(key);
      const nextKey =
        mapKeys && String(numeric) === key && ids.has(numeric)
          ? String(ids.get(numeric))
          : key;
      if (keys.has(nextKey))
        throw new Error('Collision entre identifiants de joueurs restaurés.');
      keys.add(nextKey);
      const nextPath = [...path, key];
      const playerChoice =
        (record.kind === 'player' || record.kind === 'players') &&
        (key === 'options' || key === 'timeoutValue');
      const isReference =
        key === 'playerId' ||
        key.endsWith('PlayerId') ||
        key === 'playerIds' ||
        key.endsWith('PlayerIds') ||
        key === 'actorId' ||
        key === 'replacedSlotOwnerId' ||
        playerChoice ||
        matches(nextPath, playerValuePaths);
      return [nextKey, remapPlayerReferences(item, ids, nextPath, isReference)];
    }),
  );
}
