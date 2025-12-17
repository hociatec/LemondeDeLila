import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';

/**
 * Utilitaires partagés Panier Express afin d'éviter de réimplémenter les mêmes helpers
 * dans chaque service (nom de joueur, accès sécurisés, etc.).
 */
@Injectable()
export class PanierExpressUtils {
  playerName(state: GameStateEntity, playerId: number): string {
    const player = state.players?.find((p) => p.id === playerId);
    const username = typeof player?.username === 'string' ? player?.username.trim() : '';
    return username.length ? username : `Joueur ${playerId}`;
  }
}
