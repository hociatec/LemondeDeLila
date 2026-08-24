export type PiratesCardEffect =
  | { kind: 'move'; delta: number }
  | { kind: 'skip'; turns: number }
  | { kind: 'immunity'; turns: number }
  | { kind: 'gainGold'; amount: number }
  | { kind: 'loseGold'; amount: number }
  | { kind: 'reroll' }
  | { kind: 'targetMove'; delta: number }
  | { kind: 'stealTreasure'; count: number };

export const OBSTACLE_CARD_EFFECTS: Record<number, PiratesCardEffect> = {
  1: { kind: 'move', delta: -2 }, // Requin
  2: { kind: 'skip', turns: 1 }, // Orage
  3: { kind: 'skip', turns: 1 }, // Carte déchirée
  4: { kind: 'move', delta: -1 }, // Mal de mer
  5: { kind: 'skip', turns: 1 }, // Sable mouvant
  6: { kind: 'skip', turns: 1 }, // Cocotier
  7: { kind: 'loseGold', amount: 1 }, // Singe
  8: { kind: 'skip', turns: 2 }, // Pieuvre
  9: { kind: 'move', delta: -1 }, // Piège
  10: { kind: 'loseGold', amount: 1 }, // Toucan
};

export const BONUS_CARD_EFFECTS: Record<number, PiratesCardEffect> = {
  1: { kind: 'move', delta: 2 }, // Grande pagaie
  2: { kind: 'immunity', turns: 1 }, // Boussole
  3: { kind: 'reroll' }, // Chapeau
  4: { kind: 'move', delta: 2 }, // Carte secrète
  5: { kind: 'immunity', turns: 1 }, // Talisman
  6: { kind: 'move', delta: 3 }, // Coco vitaminée
  7: { kind: 'targetMove', delta: -1 }, // Ancre en or
  8: { kind: 'gainGold', amount: 1 }, // Hamac
  9: { kind: 'stealTreasure', count: 1 }, // Sabre
  10: { kind: 'immunity', turns: 2 }, // Lanterne
};

export function describeEffect(effect: PiratesCardEffect): string {
  switch (effect.kind) {
    case 'move':
      return effect.delta >= 0
        ? `Avance de ${effect.delta} cases.`
        : `Recule de ${Math.abs(effect.delta)} cases.`;
    case 'skip':
      return `Doit sauter ${effect.turns} tour(s).`;
    case 'immunity':
      return `Protégé contre ${effect.turns} obstacle(s) suivant(s).`;
    case 'gainGold':
      return `Gagne ${effect.amount} pièce(s) d'or.`;
    case 'loseGold':
      return `Perd ${effect.amount} pièce(s) d'or.`;
    case 'reroll':
      return 'Relance immédiatement le dé.';
    case 'targetMove':
      return `Ralentit un adversaire (${effect.delta}).`;
    case 'stealTreasure':
      return `Récupère ${effect.count} trésor(s) chez un adversaire.`;
    default:
      return '';
  }
}


