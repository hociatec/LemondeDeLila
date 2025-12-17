import { Injectable } from '@nestjs/common';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { PanierExpressUtilsService } from '../utils/panier-express-utils.service';

/**
 * Utilitaires partagés Panier Express afin d'éviter de réimplémenter les mêmes helpers
 * dans chaque service (nom de joueur, accès sécurisés, etc.).
 * Étend la version utils pour bénéficier des méthodes de normalisation communes.
 */
@Injectable()
export class PanierExpressUtils extends PanierExpressUtilsService {
  playerName(state: GameStateEntity, playerId: number): string {
    return this.getPlayerName(state, playerId);
  }
}
