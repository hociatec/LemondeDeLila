import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { DameNatureMetadata } from '../services/dame-nature.service';

export type FamilyCard = {
  familyId: string;
  familyName: string;
  memberId: string;
  memberName: string;
  role: string;
};

export type PlayerExt = {
  id: number;
  username: string;
  isBot: boolean;
  hand: FamilyCard[];
  handCount: number;
  books: string[];
};

export function suggestDameNatureBotActions(
  state: GameStateEntity,
  botPlayerId: number,
  players: PlayerExt[],
  familiesCatalog: { id: string; members: { id: string }[] }[],
): GameSingleActionDto[] {
  const meta = state.metadata as DameNatureMetadata;
  const deckAvailable = (meta.deck?.length ?? 0) + (meta.discards?.length ?? 0) > 0;
  const me = players.find((p) => p.id === botPlayerId);
  const others = players.filter((p) => p.id !== botPlayerId);
  const hand = me?.hand ?? [];

  // Main vide ou aucun adversaire : priorité à la pioche
  if (!hand.length || !others.length) {
    return deckAvailable ? [{ type: 'draw', payload: { playerId: botPlayerId } }] : [];
  }

  // Comptage par famille
  const familyCounts: Record<string, { count: number; cards: FamilyCard[] }> = {};
  hand.forEach((c) => {
    if (!familyCounts[c.familyId]) {
      familyCounts[c.familyId] = { count: 0, cards: [] };
    }
    familyCounts[c.familyId].count += 1;
    familyCounts[c.familyId].cards.push(c);
  });

  // Familles non complétées
  const candidateFamilies = Object.entries(familyCounts)
    .filter(([familyId, info]) => !(me?.books ?? []).includes(familyId) && info.count >= 1)
    .map(([_, info]) => info);

  if (candidateFamilies.length === 0) {
    return deckAvailable ? [{ type: 'draw', payload: { playerId: botPlayerId } }] : [];
  }

  // Pondération : plus de cartes => plus de chances de choisir
  const pickFamily = weightedPick(candidateFamilies.map((f) => ({ count: f.count, card: f.cards[0] })));
  const ownedMemberIds = new Set(familyCounts[pickFamily.card.familyId]?.cards.map((c) => c.memberId) ?? []);
  const familyCatalog = familiesCatalog.find((f) => f.id === pickFamily.card.familyId);
  const missingMembers = familyCatalog ? familyCatalog.members.filter((m) => !ownedMemberIds.has(m.id)) : [];
  const memberToAsk =
    missingMembers.length > 0
      ? missingMembers[Math.floor(Math.random() * missingMembers.length)].id
      : pickFamily.card.memberId;

  const target = others[Math.floor(Math.random() * others.length)];
  return [
    {
      type: 'ask_card',
      payload: {
        familyId: pickFamily.card.familyId,
        memberId: memberToAsk,
        target: target.id,
        playerId: botPlayerId,
      },
    },
  ];
}

function weightedPick(families: { count: number; card: FamilyCard }[]): { count: number; card: FamilyCard } {
  if (!families.length) {
    return { count: 0, card: { familyId: '', familyName: '', memberId: '', memberName: '', role: '' } };
  }
  const total = families.reduce((sum, f) => sum + f.count, 0);
  let r = Math.random() * total;
  for (const fam of families) {
    r -= fam.count;
    if (r <= 0) {
      return fam;
    }
  }
  return families[families.length - 1];
}
