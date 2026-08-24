import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type {
  FrousseCard,
  FrousseMetadata,
  FroussePawn,
  FrousseTile,
} from '../../model/frousse.types';

export type FrousseRuntimeMetadata = FrousseMetadata & {
  keepTurnNow?: boolean;
};

export function asFrousseRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toFrousseText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

export function asFroussePendingRecord(value: unknown): {
  type?: string;
  playerId?: unknown;
} | null {
  if (!value || typeof value !== 'object') return null;
  const record = asFrousseRecord(value);
  return {
    type: toFrousseText(record.type),
    playerId: record.playerId,
  };
}

export function normalizeFrousseMeta(
  input: unknown,
): FrousseRuntimeMetadata {
  const raw = asFrousseRecord(input);
  const statuses = asFrousseRecord(raw.statuses);
  const decks = asFrousseRecord(raw.decks);
  return {
    tiles: (Array.isArray(raw.tiles) ? raw.tiles : []) as FrousseTile[],
    positions: asFrousseRecord(raw.positions) as Record<number, number>,
    statuses: {
      skipTurn: asFrousseRecord(statuses.skipTurn) as Record<number, number>,
      ignoreNextTrap: asFrousseRecord(statuses.ignoreNextTrap) as Record<
        number,
        boolean
      >,
      ignoreTrapUntilNextDraw: asFrousseRecord(
        statuses.ignoreTrapUntilNextDraw,
      ) as Record<number, boolean>,
      ignoreNextPrank: asFrousseRecord(statuses.ignoreNextPrank) as Record<
        number,
        boolean
      >,
      ignoreNextGhost: asFrousseRecord(statuses.ignoreNextGhost) as Record<
        number,
        boolean
      >,
      nextMoveCap: asFrousseRecord(statuses.nextMoveCap) as Record<
        number,
        number
      >,
      nextRollMalus: asFrousseRecord(statuses.nextRollMalus) as Record<
        number,
        number
      >,
      nextRollKeepLowest: asFrousseRecord(
        statuses.nextRollKeepLowest,
      ) as Record<number, boolean>,
      nextRollDouble: asFrousseRecord(statuses.nextRollDouble) as Record<
        number,
        boolean
      >,
      nextRollIfThreeBackTwo: asFrousseRecord(
        statuses.nextRollIfThreeBackTwo,
      ) as Record<number, boolean>,
      blocked: asFrousseRecord(
        statuses.blocked,
      ) as FrousseMetadata['statuses']['blocked'],
    },
    decks: {
      cards: (Array.isArray(decks.cards) ? decks.cards : []) as FrousseCard[],
      discard: (Array.isArray(decks.discard)
        ? decks.discard
        : []) as FrousseCard[],
    },
    pawns: (Array.isArray(raw.pawns) ? raw.pawns : []) as FroussePawn[],
    pendingContext:
      (asFrousseRecord(raw.pendingContext) as FrousseMetadata['pendingContext']) ??
      null,
    winnerId: typeof raw.winnerId === 'number' ? raw.winnerId : null,
    starterChosenAfterPawnSelection:
      raw.starterChosenAfterPawnSelection === true,
    keepTurnNow: raw.keepTurnNow === true,
  };
}

export function clampFrousse(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function extractFrousseMoveDelta(text: string): number {
  const numWords: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };

  const parseNumberish = (raw: string): number => {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
    const key = raw.trim().toLowerCase();
    return numWords[key] ?? 0;
  };

  let total = 0;
  const forwardOrBackPattern =
    /(avancez|reculez)\s+(?:de|d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢])\s*(\d+|un|une|deux|trois|quatre|cinq|six)(?:\s+cases?)?/gi;
  let fbMatch: RegExpExecArray | null;
  while ((fbMatch = forwardOrBackPattern.exec(text)) !== null) {
    const amount = parseNumberish(fbMatch[2]);
    if (amount <= 0) continue;
    const verb = String(fbMatch[1] ?? '').toLowerCase();
    total += verb.startsWith('recul') ? -amount : amount;
  }
  const jumpPattern =
    /sautez\s+(\d+|un|une|deux|trois|quatre|cinq|six)(?:\s+cases?)?/gi;
  let jumpMatch: RegExpExecArray | null;
  while ((jumpMatch = jumpPattern.exec(text)) !== null) {
    const amount = parseNumberish(jumpMatch[1]);
    if (amount > 0) total += amount;
  }
  if (total !== 0) return total;

  const narrativeForward = text.match(
    /avancez[\s\S]*?d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (narrativeForward) return parseNumberish(narrativeForward[1]);

  const narrativeBack = text.match(
    /recul(?:ez|ant|e|es)?[\s\S]*?d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*(\d+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (narrativeBack) return -parseNumberish(narrativeBack[1]);

  const forwardApos = text.match(/Avancez\s+d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*(\d+)\s+case/i);
  if (forwardApos) return Number(forwardApos[1]) || 0;
  const forwardAposWords = text.match(
    /Avancez\s+d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forwardAposWords) return parseNumberish(forwardAposWords[1]);

  const forward = text.match(/Avancez\s+de\s+(\d+)\s+case/i);
  if (forward) return Number(forward[1]) || 0;
  const forwardWords = text.match(
    /Avancez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forwardWords) return parseNumberish(forwardWords[1]);

  const backApos = text.match(/Reculez\s+d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*(\d+)\s+case/i);
  if (backApos) return -(Number(backApos[1]) || 0);
  const backAposWords = text.match(
    /Reculez\s+d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backAposWords) return -parseNumberish(backAposWords[1]);

  const back = text.match(/Reculez\s+de\s+(\d+)\s+case/i);
  if (back) return -(Number(back[1]) || 0);
  const backWords = text.match(
    /Reculez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backWords) return -parseNumberish(backWords[1]);
  const jump = text.match(/Sautez\s+(\d+)\s+case/i);
  if (jump) return Number(jump[1]) || 0;
  return 0;
}

export function extractFrousseSkipTurns(text: string): number {
  const numeric = text.match(/Passez\s+(\d+)\s+tours?/i);
  if (numeric) {
    const n = Number(numeric[1]);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  const oneWord = text.match(/Passez\s+(un|une)\s+tour/i);
  if (oneWord) return 1;
  if (/Passez deux tours/i.test(text)) return 2;
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez votre tour/i.test(text) || /Passez un tour/i.test(text)) return 1;
  return 0;
}

export function isFrousseTeleportToCase40(text: string): boolean {
  return /jusqu['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]?(?:a|ÃƒÆ’Ã‚Â )\s+la case 40/i.test(text);
}

export function describeFrousseCardEffect(card: FrousseCard): string {
  const text = card.text ?? '';

  if (
    /FantÃƒÆ’Ã‚Â´me/i.test(card.category) &&
    /fantÃƒÆ’Ã‚Â´me farceur/i.test(text) &&
    /ÃƒÆ’Ã‚Â©chang|echange/i.test(text)
  ) {
    return 'ÃƒÆ’Ã¢â‚¬Â°change alÃƒÆ’Ã‚Â©atoire de place.';
  }
  if (
    /ÃƒÆ’Ã‚Â©chang|echange/i.test(text) &&
    (/votre place/i.test(text) || /vos places/i.test(text))
  ) {
    return 'ÃƒÆ’Ã¢â‚¬Â°changez votre place avec un autre joueur.';
  }
  if (/Ignorez le prochain piÃƒÆ’Ã‚Â¨ge/i.test(text))
    return 'Ignorez le prochain piÃƒÆ’Ã‚Â¨ge.';
  if (/Ignorez les piÃƒÆ’Ã‚Â¨ges jusqu['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]au prochain symbole/i.test(text))
    return 'Ignorez les piÃƒÆ’Ã‚Â¨ges jusquÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢au prochain symbole.';
  if (/Ignorez la prochaine carte FantÃƒÆ’Ã‚Â´me/i.test(text))
    return 'Ignorez la prochaine carte FantÃƒÆ’Ã‚Â´me.';
  if (/annule une farce/i.test(text) || /rien ne vous arrive/i.test(text))
    return 'Ignorez la prochaine farce.';
  if (
    /Sautez\s+6\s+cases/i.test(text) ||
    (/Bonus/i.test(card.category) && card.localNumber === 13)
  )
    return 'Sautez 6 cases.';
  if (/Doublez votre prochain lancer/i.test(text))
    return 'Doublez le prochain lancer de dÃƒÆ’Ã‚Â©.';
  if (
    /gardez le plus petit/i.test(text) ||
    /gardez le chiffre le plus bas/i.test(text)
  )
    return 'Rejouez en gardant le plus petit rÃƒÆ’Ã‚Â©sultat.';
  if (/malus de moins 2/i.test(text) || /malus de -2/i.test(text))
    return 'Rejouez avec un malus de -2 au lancer.';
  if (/Si vous faites un trois, reculez de 2 cases/i.test(text))
    return 'Si vous faites un trois, reculez de 2 cases.';
  if (isFrousseTeleportToCase40(text)) return 'Allez directement a la case 40.';
  if (
    /Relancez le dÃƒÆ’Ã‚Â©/i.test(text) ||
    (/Relancez/i.test(text) && /dÃƒÆ’Ã‚Â©/i.test(text))
  )
    return 'Rejouez immÃƒÆ’Ã‚Â©diatement.';
  if (/laissant les autres joueurs (filer|avancer) de 3 cases/i.test(text))
    return 'Les autres avancent de 3 cases, vous passez 1 tour.';
  if (
    /si le rÃƒÆ’Ã‚Â©sultat est impair, passez (?:votre|un|une|1)?\s*tour/i.test(text)
  ) {
    return 'Lancez le dÃƒÆ’Ã‚Â© : si le rÃƒÆ’Ã‚Â©sultat est impair, passez 1 tour.';
  }
  const skip = extractFrousseSkipTurns(text);
  if (skip > 0) return `Passez ${skip} tour${skip > 1 ? 's' : ''}.`;
  if (/case depart/i.test(text) || /Retour a la case une/i.test(text))
    return 'Retournez a la case depart.';
  if (/Allez en cuisine/i.test(text)) return 'Allez en cuisine.';

  const combo = text.match(
    /Avancez\s+de\s+(\d+)\s+cases?,\s+puis\s+reculez\s+de\s+(\d+)\s+cases?/i,
  );
  if (combo)
    return `Avancez de ${combo[1]} cases, puis reculez de ${combo[2]}.`;
  const delta = extractFrousseMoveDelta(text);
  if (delta > 0) return `Avancez de ${delta} case${delta > 1 ? 's' : ''}.`;
  if (delta < 0)
    return `Reculez de ${Math.abs(delta)} case${Math.abs(delta) > 1 ? 's' : ''}.`;

  const need56 = text.match(/lancer un (\d) ou un (\d)/i);
  if (need56)
    return `BloquÃƒÆ’Ã‚Â© : lancez un ${need56[1]} ou un ${need56[2]} pour vous libÃƒÆ’Ã‚Â©rer.`;
  const need6 = text.match(/obtenir un 6/i);
  if (need6 && /jusqu/i.test(text))
    return 'BloquÃƒÆ’Ã‚Â© : obtenez un 6 pour vous libÃƒÆ’Ã‚Â©rer.';
  const needMin = text.match(/obtenez pas un (\d) ou plus/i);
  if (needMin)
    return `BloquÃƒÆ’Ã‚Â© : obtenez ${needMin[1]} ou plus pour vous libÃƒÆ’Ã‚Â©rer.`;
  if (/nombre pair/i.test(text))
    return 'BloquÃƒÆ’Ã‚Â© : obtenez un nombre pair pour vous libÃƒÆ’Ã‚Â©rer.';

  if (/n['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]avancerez que d['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢](une|un)e seule case/i.test(text))
    return 'Au prochain tour, avancez dÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢une seule case.';

  return 'Effet immÃƒÆ’Ã‚Â©diat.';
}

export function normalizeFrousseCardText(text: string): string {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function formatFrousseCardDrawLog(
  playerName: string,
  cardText: string,
  effectLabel: string,
): string {
  const base = `${playerName} pioche une carte (${cardText})`;
  if (shouldSuppressRepeatedFrousseEffect(cardText, effectLabel)) {
    return `${base}.`;
  }
  return `${base} : ${effectLabel}`;
}

export function lowercaseFrousseFirst(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) return text;
  if (text.length === 1) return text.toLowerCase();
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function describeFroussePawnLabel(
  state: GameStateEntity,
  meta: FrousseRuntimeMetadata,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === playerId);
  const playerRecord = asFrousseRecord(player);
  const explicitLabel = toFrousseText(playerRecord.pawnLabel);
  if (explicitLabel) return `"${explicitLabel}"`;
  const pawnId = toFrousseText(playerRecord.pawn);
  const fromMeta = Array.isArray(meta.pawns)
    ? meta.pawns.find((pawn: FroussePawn) => toFrousseText(pawn?.id) === pawnId)
    : null;
  const name = toFrousseText(fromMeta?.name) || pawnId;
  if (name) return `"${name}"`;
  return 'un pion';
}

export function describeFroussePawnPossessive(
  state: GameStateEntity,
  meta: FrousseRuntimeMetadata,
  playerId: number,
): string {
  const raw = describeFroussePawnLabel(state, meta, playerId);
  const inner = String(raw ?? '')
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim();
  if (!inner) {
    return '"son pion"';
  }
  const stripped = inner
    .replace(/^(un|une|le|la|les)\s+/i, '')
    .replace(/^l['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*/i, '')
    .trim();
  const base = lowercaseFrousseFirst(stripped || inner);
  const feminine = /^(une|la)\s+/i.test(inner);
  const possessive = feminine ? 'sa' : 'son';
  return `"${possessive} ${base}"`;
}

function shouldSuppressRepeatedFrousseEffect(
  cardText: string,
  effectLabel: string,
): boolean {
  const effect = normalizeFrousseForContains(effectLabel);
  if (!effect) return false;
  const card = normalizeFrousseForContains(cardText);
  if (!card) return false;
  if (card.includes(effect)) return true;

  const effectTokens = tokenizeFrousseMeaningfulText(effectLabel);
  if (!effectTokens.length) return false;
  const cardTokens = new Set(tokenizeFrousseMeaningfulText(cardText));
  return effectTokens.every((token) => cardTokens.has(token));
}

function normalizeFrousseForContains(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeFrousseMeaningfulText(value: string): string[] {
  const stopWords = new Set([
    'a',
    'au',
    'aux',
    'avec',
    'ce',
    'ces',
    'd',
    'de',
    'des',
    'du',
    'en',
    'et',
    'immediatement',
    'jusqu',
    'l',
    'la',
    'le',
    'les',
    'ou',
    'un',
    'une',
    'vos',
    'votre',
    'vous',
  ]);

  return normalizeFrousseForContains(value)
    .split(' ')
    .map(stemFrousseComparableToken)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function stemFrousseComparableToken(token: string): string {
  let out = token.trim();
  if (out.length > 4 && out.endsWith('es')) {
    out = out.slice(0, -2);
  } else if (out.length > 3 && (out.endsWith('s') || out.endsWith('x'))) {
    out = out.slice(0, -1);
  }
  return out;
}
