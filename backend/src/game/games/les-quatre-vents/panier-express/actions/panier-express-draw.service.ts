import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { PanierExpressSetupService } from '../setup/panier-express-setup.service';
import { playingLog } from '../../../../../common/utils/playing-logger';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PanierExpressDeckService } from './panier-express-deck.service';

@Injectable()
export class PanierExpressDrawService {
  private static readonly MAX_INVENTORY = 5;

  constructor(
    private readonly setup: PanierExpressSetupService,
    private readonly core: GameCoreService,
    private readonly utils: PanierExpressUtils,
    private readonly deckHelper: PanierExpressDeckService,
  ) {}

  drawCourse(
    state: GameStateEntity,
    playerId: number,
    standId?: string,
  ): GameStateEntity {
    const meta = state.metadata as PanierExpressMetadata;
    const noDraw = (meta as any)?.statuses?.noDrawCourses?.[playerId] ?? 0;
    if (noDraw > 0) {
      return this.core.appendLog(
        state,
        `[Panier Express] ${this.utils.playerName(state, playerId)} ne peut pas piocher de carte ce tour-ci.`,
      );
    }
    const decks = meta.decks ?? this.setup.buildDeckPool(state);
    let metaAfter: PanierExpressMetadata = { ...meta, decks };

    const resolvedStandId = standId ?? this.findStandAtPosition(meta, playerId);
    const standKey = resolvedStandId ? `courses-${resolvedStandId}` : 'courses';

    const draw = this.drawAtStand(metaAfter, standKey, resolvedStandId);
    metaAfter = draw.metadata;
    if (!draw.card) {
      const debugLabel = resolvedStandId ? standKey : 'courses';
      return this.core.appendLog(
        state,
        `[Panier Express] Stand ${resolvedStandId || 'inconnu'} : aucune carte disponible (deck ${debugLabel}).`,
      );
    }

    const { card, metadata } = draw;
    let discarded: 'duplicate' | 'full' | null = null;
    let duplicateSource: 'panier' | 'inventaire' | null = null;
    let kept = false;
    const players = (state.players ?? []).map((player) => {
      if (player.id !== playerId) return player;
      const shoppingList = this.utils.toStringArray(player.shoppingList);
      const basket = this.utils.toStringArray(player.basket);
      const inventory = this.utils.toStringArray(player.inventory);
      const alreadyInBasket = basket.includes(card);
      const alreadyInInventory = inventory.includes(card);
      const isNeeded = shoppingList.includes(card) && !alreadyInBasket;

      if (alreadyInBasket) {
        discarded = 'duplicate';
        duplicateSource = 'panier';
        return { ...player, inventory, basket };
      }

      if (isNeeded) {
        kept = true;
        if (alreadyInInventory) {
          discarded = 'duplicate';
          duplicateSource = 'inventaire';
          return {
            ...player,
            basket: [...basket, card],
            inventory: this.utils.removeOne(inventory, card),
          };
        }
        return { ...player, basket: [...basket, card], inventory };
      }

      if (alreadyInInventory) {
        discarded = 'duplicate';
        duplicateSource = 'inventaire';
        return { ...player, inventory, basket };
      }
      if (inventory.length >= PanierExpressDrawService.MAX_INVENTORY) {
        discarded = 'full';
        return { ...player, inventory, basket };
      }
      kept = true;
      return { ...player, inventory: [...inventory, card], basket };
    });

    const nextMeta: PanierExpressMetadata = {
      ...(metadata as any),
      lastObtainedCourse: {
        ...(((metadata as any)?.lastObtainedCourse ?? {}) as Record<
          number,
          string | null
        >),
        [playerId]: kept ? card : null,
      },
      discards:
        discarded && card
          ? {
              ...((metadata as any)?.discards ?? {}),
              courses: [
                ...((((metadata as any)?.discards?.courses ?? []) as any[]) ??
                  []),
                card,
              ],
            }
          : ((metadata as any)?.discards ?? { courses: [] }),
    };
    const nextState: GameStateEntity = {
      ...state,
      players,
      metadata: nextMeta as any,
    };
    const courseLabel = this.utils.formatCourseLabel(card);
    const playerLabel = this.utils.playerName(state, playerId);
    const message = discarded
      ? discarded === 'duplicate'
        ? duplicateSource === 'panier'
          ? `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'a dÃƒÂ©jÃƒÂ  dans le panier. Cet ingrÃƒÂ©dient part donc ÃƒÂ  la dÃƒÂ©fausse.`
          : duplicateSource === 'inventaire'
            ? `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'ingrÃƒÂ©dient est dÃƒÂ©jÃƒÂ  prÃƒÂ©sent dans l'inventaire. Cet ingrÃƒÂ©dient part donc ÃƒÂ  la dÃƒÂ©fausse.`
            : `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'a dÃƒÂ©jÃƒÂ . Cet ingrÃƒÂ©dient part donc ÃƒÂ  la dÃƒÂ©fausse.`
        : `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'inventaire est plein. Cet ingrÃƒÂ©dient part donc ÃƒÂ  la dÃƒÂ©fausse.`
      : `[Panier Express] ${playerLabel} pioche "${courseLabel}".`;
    const logged = this.core.appendLog(nextState, message);

    const playerView = players.find((p) => p.id === playerId);
    playingLog('panier.draw', {
      roomId: (state.metadata as any)?.roomId ?? null,
      gameType: (state.metadata as any)?.gameType ?? null,
      userId: playerId,
      type: 'draw',
      playerId,
      card,
      standId: resolvedStandId || null,
      shoppingList: playerView?.shoppingList ?? [],
      basket: playerView?.basket ?? [],
      inventory: playerView?.inventory ?? [],
      discarded,
    });

    return logged;
  }

  private drawAtStand(
    meta: PanierExpressMetadata,
    standKey: string,
    standId?: string,
  ): { card: string | null; metadata: PanierExpressMetadata } {
    if (standId) {
      const replenish = () =>
        standId === 'bonus'
          ? [...this.setup.courseItems()]
          : this.setup.buildReplenishableDeck(
              this.setup.standCourseMap()[standId] ?? this.setup.courseItems(),
            );
      const draw = this.deckHelper.drawWithReplenish<string>(
        meta,
        standKey,
        replenish,
      );
      if (draw.card) {
        return draw;
      }
      return this.deckHelper.drawWithReplenish<string>(
        draw.metadata,
        'courses',
        () => this.setup.buildReplenishableDeck(),
      );
    }
    return this.deckHelper.drawWithReplenish<string>(meta, 'courses', () =>
      this.setup.buildReplenishableDeck(),
    );
  }

  private findStandAtPosition(
    meta: PanierExpressMetadata,
    playerId: number,
  ): string | undefined {
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles?.[pos];
    return tile?.type === 'stand' ? tile.standId : undefined;
  }
}
