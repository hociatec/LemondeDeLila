export type FouleesFantastiquesTile = {
  id: string;
  type: 'normal';
  label: string;
};

export type FouleesFantastiquesColor = 'Rouge' | 'Bleu' | 'Vert' | 'Jaune';

export type FouleesFantastiquesPawnState = {
  pawnIndex: number; // 0..3
  /**
   * Progression "linéaire" sur le chemin du joueur.
   * -1 = dans l'écurie (départ), 0..trackLength-1 = sur le plateau,
   * trackLength..trackLength+homeLength-1 = abri (cases 1..homeLength, arrivée incluse).
   */
  progress: number;
};

export type FouleesFantastiquesMetadata = {
  tiles: FouleesFantastiquesTile[];
  trackLength: number;
  homeLength: number;
  pawnsByPlayer: Record<number, FouleesFantastiquesPawnState[]>;
  colorsByPlayer: Record<number, FouleesFantastiquesColor>;
  // Personnalisation "univers" (familles/animaux) pour les logs et l'accessibilité.
  familyIdByPlayer?: Record<number, string>;
  familyByPlayer?: Record<number, string>;
  habitatByPlayer?: Record<number, string>;
  pawnNamesByPlayer?: Record<number, string[]>;
  // Décalage de départ sur la piste principale (0..trackLength-1).
  offsets: Record<number, number>;
  // Cases safe sur la piste (0..trackLength-1)
  safeTiles: number[];
  // Vue plateau pour le client générique (position principale par joueur)
  positions: Record<number, number>;
  laps: Record<number, number>;
  statuses: {
    skipTurn: Record<number, number>;
  };
  winnerId: number | null;
};
