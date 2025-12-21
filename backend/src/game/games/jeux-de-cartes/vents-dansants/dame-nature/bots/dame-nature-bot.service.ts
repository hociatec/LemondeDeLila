import { Injectable } from '@nestjs/common';
import { BotRunnerService } from '../../../../../modules/bot/services/bot-runner.service';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { DameNatureSetupService } from '../setup/dame-nature-setup.service';
import type {
  FamilyCard,
  DameNatureMetadata,
} from '../model/dame-nature.model';
import { GameStateEntity } from '../../../../../core/entities/game-state.entity';

@Injectable()
export class DameNatureBotService {
  constructor(
    private readonly botRunner: BotRunnerService,
    private readonly setup: DameNatureSetupService,
  ) {}

  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    const profile =
      (state.metadata as DameNatureMetadata)?.botProfile ?? 'greedy';
    const players = this.setup.ensurePlayers(state);
    const me = players.find((p) => p.id === botPlayerId);
    const others = players.filter((p) => p.id !== botPlayerId);
    const families = this.setup.families();
    const meta = state.metadata as DameNatureMetadata;
    const recentRequests = new Set<string>(
      (meta.actionLog ?? [])
        .filter((e) => e.actorId === botPlayerId && e.type === 'ask_card')
        .slice(-5)
        .map((e) => {
          const fam = e.payload?.familyId ?? '';
          const member = e.payload?.memberId ?? '';
          const target =
            e.payload?.target ??
            e.payload?.targetPlayerId ??
            e.payload?.targetId ??
            '';
          return `${fam}:${member}:${target}`;
        }),
    );

    const progress =
      meta.turnProgress?.playerId === botPlayerId
        ? meta.turnProgress
        : {
            playerId: botPlayerId,
            drew: false,
            discarded: false,
            asked: false,
          };
    const familyDeck = meta.decks?.family ?? { deck: [], discards: [] };
    void familyDeck;

    if (!me || !others.length) {
      return this.botRunner.choose(
        [{ type: 'draw', payload: { playerId: botPlayerId } }],
        { state, playerId: botPlayerId },
        profile,
        {
          preferTypes: ['draw'],
        },
      );
    }

    // Choix de famille où le bot a le plus de cartes non bookées
    const familyCounts: Record<string, { count: number; cards: FamilyCard[] }> =
      {};
    me.hand.forEach((c) => {
      if (!familyCounts[c.familyId])
        familyCounts[c.familyId] = { count: 0, cards: [] };
      familyCounts[c.familyId].count += 1;
      familyCounts[c.familyId].cards.push(c);
    });
    const desiredFamilies = Object.entries(familyCounts)
      .filter(([fid]) => !(me.books ?? []).includes(fid))
      .sort((a, b) => b[1].count - a[1].count)
      .map(([fid]) => fid);

    // Choix du joueur avec le plus de cartes pour maximiser les chances
    const sortedOthers = [...others].sort(
      (a, b) => (b.handCount ?? 0) - (a.handCount ?? 0),
    );
    const target = sortedOthers[0] ?? null;

    // Choisir une carte qui existe vraiment dans la main de la cible (sinon la demande serait invalide).
    const pickRequestedCard = (): FamilyCard | null => {
      if (!target?.hand?.length) return null;
      for (const familyId of desiredFamilies) {
        const catalog = families.find((f) => f.id === familyId);
        const owned = new Set(
          (me.hand ?? [])
            .filter((c) => c.familyId === familyId)
            .map((c) => c.memberId),
        );
        const missing = new Set(
          (catalog?.members ?? [])
            .filter((m) => !owned.has(m.id))
            .map((m) => m.id),
        );
        const match = target.hand.find(
          (c) => c.familyId === familyId && missing.has(c.memberId),
        );
        if (match) return match;
      }
      return target.hand[0] ?? null;
    };
    const requested = pickRequestedCard();

    // Règle de tour : 1 pioche + 1 défausse. Si la main est à 5 ou si la pioche est déjà faite, on défausse.
    const mustDiscard =
      (me.hand?.length ?? 0) > 4 || (progress.drew && !progress.discarded);
    if (mustDiscard) {
      const sorted = [...(me.hand ?? [])].sort((a, b) => {
        const aBooked = (me.books ?? []).includes(a.familyId) ? 1 : 0;
        const bBooked = (me.books ?? []).includes(b.familyId) ? 1 : 0;
        if (aBooked !== bBooked) return bBooked - aBooked;
        const ac = familyCounts[a.familyId]?.count ?? 0;
        const bc = familyCounts[b.familyId]?.count ?? 0;
        if (ac !== bc) return ac - bc;
        return String(a.memberId).localeCompare(String(b.memberId));
      });
      const pickDiscard = sorted[0] ?? null;
      if (pickDiscard) {
        return [
          {
            type: 'discard_card',
            payload: {
              playerId: botPlayerId,
              familyId: pickDiscard.familyId,
              memberId: pickDiscard.memberId,
            },
          },
        ];
      }
    }

    const actions: GameSingleActionDto[] = [];
    if (!progress.asked && requested && target != null) {
      // Depuis que l'échange est obligatoire, on doit toujours proposer une carte en contrepartie.
      const offer = me.hand[0] ?? null;
      if (!offer) {
        return this.botRunner.choose(
          [{ type: 'draw', payload: { playerId: botPlayerId } }],
          { state, playerId: botPlayerId },
          profile,
          {
            preferTypes: ['draw'],
          },
        );
      }
      const key = `${requested.familyId}:${requested.memberId}:${target.id}`;
      if (!recentRequests.has(key)) {
        actions.push({
          type: 'ask_card',
          payload: {
            playerId: botPlayerId,
            familyId: requested.familyId,
            memberId: requested.memberId,
            target: target.id,
            targetPlayerId: target.id,
            // offre
            giveFamilyId: offer.familyId,
            giveMemberId: offer.memberId,
            offerMemberId: offer.memberId,
            give: offer.memberId,
          },
        });
      }
    }
    actions.push({ type: 'draw', payload: { playerId: botPlayerId } });

    return this.botRunner.choose(
      actions,
      { state, playerId: botPlayerId },
      profile,
      {
        preferTypes: ['ask_card', 'draw'],
        fallbackTypes: ['draw'],
        score: (action) => {
          if (action.type === 'ask_card') return 5;
          // Piocher devient prioritaire si peu de cartes ou aucune famille majoritaire
          if (action.type === 'draw') {
            const maxFamilyCount = Object.values(familyCounts).reduce(
              (m, v) => Math.max(m, v.count),
              0,
            );
            return maxFamilyCount < 2 ? 6 : 3;
          }
          return 0;
        },
      },
    );
  }
}
