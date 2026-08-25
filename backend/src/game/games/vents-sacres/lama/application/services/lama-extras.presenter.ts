import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import type { LamaCardValue, LamaMetadata } from '../../model/lama.model';
import {
  lamaCardLabel,
  nextLamaValue,
  LAMA_VALUE,
} from '../../model/lama.model';
import { stringOrEmpty } from '@common/utils/public-api';
import { isLamaDrawLocked } from '../policies/lama-draw.policy';

export class LamaExtrasPresenter {
  build(
    state: GameStateEntity,
    metadata: LamaMetadata,
    userId: number,
    currentPlayerId: number | null,
    base: Record<string, unknown>,
  ): Record<string, unknown> {
    const players = Array.isArray(state.players) ? state.players : [];

    const handValues = (metadata.handsByPlayerId ?? {})[String(userId)] ?? [];
    const hand = handValues
      .filter((v) => typeof v === 'number' && v >= 1 && v <= LAMA_VALUE)
      .sort((a, b) => a - b)
      .map(lamaCardLabel);

    const scoreBy = metadata.scoresByPlayerId ?? {};
    const myScore = Number(scoreBy[String(userId)] ?? 0);
    const namesById = new Map<number, string>();
    players
      .filter((p) => typeof p?.id === 'number')
      .forEach((p) => {
        const pid = p.id;
        namesById.set(
          pid,
          this.sanitizePlayerName(p.username) || `Joueur ${pid}`,
        );
      });
    const orderedPlayerIds = players
      .map((p) => (typeof p?.id === 'number' ? p.id : null))
      .filter((pid): pid is number => pid != null);
    const knownPlayerIdSet = new Set(orderedPlayerIds);
    const orphanScores = Object.entries(scoreBy)
      .filter(([pid]) => !knownPlayerIdSet.has(Number(pid)))
      .map(([, score]) => Number(score))
      .filter((score) => Number.isFinite(score));

    const scoreLines: string[] = orderedPlayerIds.map((pid) => {
      const name = namesById.get(pid) || `Joueur ${pid}`;
      const direct = Number(scoreBy[String(pid)]);
      const scoreValue = Number.isFinite(direct)
        ? direct
        : orphanScores.length > 0
          ? Number(orphanScores.shift())
          : 0;
      return `${name}: ${scoreValue}`;
    });

    const discard = Array.isArray(metadata.discard) ? metadata.discard : [];
    const top = discard.length ? discard[discard.length - 1] : null;
    const discardTop = top ? lamaCardLabel(top) : '(vide)';
    const drawLocked = isLamaDrawLocked(metadata);

    const playableText = (() => {
      if (this.isSetup(state)) {
        const loseAt = metadata.loseAtScore ?? null;
        return loseAt != null
          ? `Réglages: défaite à ${loseAt} jetons.`
          : 'Réglages: choisissez le score de défaite, puis Entrée.';
      }
      if (!this.isStarted(state)) return 'Partie non démarrée.';
      if (currentPlayerId !== userId) return "Ce n'est pas votre tour.";
      const step = metadata.step ?? 'turn_choice';
      if (step === 'return_token')
        return 'Rendez 1 jeton ou 1 diamant (10 jetons) si possible.';
      if (!top) return 'Défausse vide.';
      const allowed = new Set<LamaCardValue>([top, nextLamaValue(top)]);
      const counts = new Map<LamaCardValue, number>();
      for (const v of handValues) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const parts: string[] = [];
      for (const [value, count] of [...counts.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        if (!allowed.has(value)) continue;
        parts.push(`${lamaCardLabel(value)}×${count}`);
      }
      return `Défausse : ${discardTop}. (${drawLocked ? '↑/↓ choisir, Entrée jouer, P passer, C défausse, E mains, S score' : '↑/↓ choisir, Entrée jouer, Espace piocher, P passer, C défausse, E mains, S score'})`;
    })();

    return {
      ...base,
      hand,
      score: [`Total jetons: ${myScore}`, ...scoreLines],
      ui: {
        panels: {
          hand: {
            title: 'Main',
            message: hand.length ? `Main: ${hand.join(', ')}` : 'Main: (vide)',
          },
          hands: {
            title: 'Mains',
            message: (() => {
              const by = metadata.handsByPlayerId ?? {};
              const parts = players
                .filter((p) => p?.id)
                .map((p) => {
                  const pid = p.id;
                  const name = this.sanitizePlayerName(p.username) || `#${pid}`;
                  const count = Array.isArray(by[String(pid)])
                    ? by[String(pid)].length
                    : 0;
                  return `${name}: ${count}`;
                });
              return parts.length
                ? `Cartes en main — ${parts.join(', ')}.`
                : 'Cartes en main : inconnues.';
            })(),
          },
          discard: {
            title: 'Carte au-dessus',
            message: `Carte au-dessus : ${discardTop}.`,
          },
          play: {
            title: 'À jouer',
            message: playableText,
          },
          score: {
            title: 'Jetons',
            message: (() => {
              if (scoreLines.length === 0) return 'Jetons: inconnus.';
              const loseAt =
                metadata.loseAtScore != null
                  ? Number(metadata.loseAtScore)
                  : null;
              const loseText =
                loseAt != null && Number.isFinite(loseAt)
                  ? ` Défaite à ${loseAt} jetons.`
                  : '';
              return `Jetons: ${scoreLines.join(', ')}.${loseText}`;
            })(),
          },
          table: {
            title: 'Table',
            message:
              metadata.loseAtScore != null
                ? `Défaite à ${metadata.loseAtScore} jetons.`
                : 'Défaite: non configurée.',
          },
        },
      },
    };
  }

  private sanitizePlayerName(raw: unknown): string {
    let name = stringOrEmpty(raw).trim();
    name = name
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (name.startsWith('"') && name.endsWith('"')) {
      name = name.slice(1, -1).trim();
    }
    const lowered = name.toLowerCase();
    if (
      lowered.endsWith('(zone de jeu)') ||
      lowered.endsWith('(zone de jeux)') ||
      lowered.endsWith('(game zone)')
    ) {
      const openParen = name.lastIndexOf('(');
      if (openParen > 0) {
        name = name.slice(0, openParen).trimEnd();
      }
    }
    return name;
  }

  private isSetup(state: GameStateEntity): boolean {
    const status = String(state?.status ?? '')
      .toLowerCase()
      .trim();
    const phase = String(state?.phase ?? '')
      .toLowerCase()
      .trim();
    return status === 'setup' || phase === 'setup';
  }

  private isStarted(state: GameStateEntity): boolean {
    return (
      String(state.status ?? '')
        .toLowerCase()
        .trim() === 'started'
    );
  }

  private topDiscard(meta: LamaMetadata): LamaCardValue | null {
    const discard = meta.discard ?? [];
    const top = discard.length ? discard[discard.length - 1] : null;
    if (!top) return null;
    if (top < 1 || top > LAMA_VALUE) return null;
    return top;
  }

}
