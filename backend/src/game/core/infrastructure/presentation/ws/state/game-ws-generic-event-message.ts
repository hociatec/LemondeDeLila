type GenericEventMessageInput = {
  type: string;
  data: Record<string, unknown>;
  actorId: number | null;
  players: ReadonlyMap<number, string>;
  viewerPlayerId: number | null;
};

export function genericGameEventMessage(
  input: GenericEventMessageInput,
): string {
  const player = (value: unknown): string => {
    const id = numberValue(value);
    if (id == null) return '';
    return id === input.viewerPlayerId
      ? 'Vous'
      : (input.players.get(id) ?? `Joueur ${id}`);
  };
  const value = (key: string): string => scalarText(input.data[key]);
  const actor = player(input.actorId);
  return (
    cardAndTurnMessage(input, player, actor, value) ||
    boardAndPlayerMessage(input, player, actor, value) ||
    activityMessage(input, player, value)
  );
}

function cardAndTurnMessage(
  input: GenericEventMessageInput,
  player: (value: unknown) => string,
  actor: string,
  value: (key: string) => string,
): string {
  const { type, data, players } = input;
  if (type === 'turn.started') {
    const id = numberValue(data.playerId);
    const name = id == null ? '' : (players.get(id) ?? `Joueur ${id}`);
    return name ? `C'est au tour de ${name}.` : '';
  }
  if (type === 'dice.rolled' && actor)
    return `${actor} lance les dés${value('total') ? ` : ${value('total')}` : ''}.`;
  if (type === 'card.drawn' && actor)
    return `${actor} ${actor === 'Vous' ? 'piochez' : 'pioche'} une carte.`;
  if (type === 'card.received') {
    const name = player(data.playerId);
    return name ? `${name} reçoit une carte.` : '';
  }
  if (type === 'card.played' && actor)
    return `${actor} joue ${scalarText(data.card) || 'une carte'}.`;
  if (type === 'card.transferred') {
    const from = player(data.fromPlayerId);
    const to = player(data.toPlayerId);
    return from && to ? `${from} donne une carte à ${to}.` : '';
  }
  if (type === 'cards.exchanged' || type === 'cards.hands-swapped') {
    const left = player(data.leftPlayerId);
    const right = player(data.rightPlayerId);
    return left && right ? `${left} et ${right} échangent leurs cartes.` : '';
  }
  return '';
}

function boardAndPlayerMessage(
  input: GenericEventMessageInput,
  player: (value: unknown) => string,
  actor: string,
  value: (key: string) => string,
): string {
  const { type, data } = input;
  if (type === 'resource.changed') {
    const name = player(data.playerId);
    const resource = humanLabel(value('resource'));
    return name && resource && value('value')
      ? `${name} : ${resource} vaut ${value('value')}.`
      : '';
  }
  if (type === 'resource.transferred') {
    const from = player(data.from);
    const to = player(data.to);
    const resource = humanLabel(value('resource'));
    return from && to && resource && value('amount')
      ? `${from} transfère ${value('amount')} ${resource} à ${to}.`
      : '';
  }
  if (type === 'pawn.moved' && actor && value('from') && value('to'))
    return `${actor} déplace son pion de la case ${value('from')} à la case ${value('to')}.`;
  if (type === 'pawn.landed') {
    const name = player(data.playerId);
    return name && value('position')
      ? `${name} arrive sur la case ${value('position')}.`
      : '';
  }
  if (type === 'pawn.assigned') {
    const name = player(data.playerId);
    const pawn = humanLabel(value('pawnId'));
    return name && pawn ? `${pawn} est attribué à ${name}.` : '';
  }
  if (type === 'player.eliminated') {
    const name = player(data.playerId);
    return name ? `${name} est éliminé.` : '';
  }
  if (type === 'player.skipped') {
    const name = player(data.playerId);
    return name ? `${name} passe son tour.` : '';
  }
  if (type === 'round.player-left') {
    const name = player(data.playerId);
    return name
      ? `${name} ${name === 'Vous' ? 'sortez' : 'sort'} de la manche.`
      : '';
  }
  return '';
}

function activityMessage(
  input: GenericEventMessageInput,
  player: (value: unknown) => string,
  value: (key: string) => string,
): string {
  const { type, data } = input;
  if (type === 'match.started') return 'La partie démarre, bon jeu !';
  if (type === 'round.started' && value('number'))
    return `La manche ${value('number')} commence.`;
  if (type === 'round.ended') return 'La manche est terminée.';
  if (type === 'game.finished') return 'La partie est terminée.';
  if (type === 'quiz.asked') return 'Une nouvelle question est posée.';
  if (type === 'quiz.revealed') return 'La réponse du quiz est révélée.';
  if (type === 'submissions.revealed') return 'Les soumissions sont révélées.';
  if (type === 'submission.received') {
    const name = player(data.playerId);
    return name
      ? `${name} ${name === 'Vous' ? 'avez soumis votre' : 'a soumis sa'} réponse.`
      : '';
  }
  if (type === 'judge.started' || type === 'judge.changed') {
    const name = player(data.playerId);
    return name ? `${name} devient juge.` : '';
  }
  if (type === 'inventory.item-added' || type === 'inventory.item-removed')
    return inventoryMessage(type, data, player, value);
  if (type === 'economy.item-bought' || type === 'economy.item-sold')
    return economyMessage(type, data, player, value);
  return '';
}

function inventoryMessage(
  type: string,
  data: Record<string, unknown>,
  player: (value: unknown) => string,
  value: (key: string) => string,
): string {
  const name = player(data.playerId);
  const item = humanLabel(value('itemId'));
  const verb =
    type === 'inventory.item-added'
      ? name === 'Vous'
        ? 'recevez'
        : 'reçoit'
      : name === 'Vous'
        ? 'perdez'
        : 'perd';
  return name && item && value('count')
    ? `${name} ${verb} ${value('count')} ${item}.`
    : '';
}

function economyMessage(
  type: string,
  data: Record<string, unknown>,
  player: (value: unknown) => string,
  value: (key: string) => string,
): string {
  const name = player(data.playerId);
  const item = humanLabel(value('itemId'));
  const verb =
    type === 'economy.item-bought'
      ? name === 'Vous'
        ? 'achetez'
        : 'achète'
      : name === 'Vous'
        ? 'vendez'
        : 'vend';
  return name && item ? `${name} ${verb} ${item}.` : '';
}

function numberValue(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function scalarText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function humanLabel(value: string): string {
  const normalized = value
    .replace(/[-_.]+/g, ' ')
    .trim()
    .toLowerCase();
  return normalized
    ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
    : '';
}
