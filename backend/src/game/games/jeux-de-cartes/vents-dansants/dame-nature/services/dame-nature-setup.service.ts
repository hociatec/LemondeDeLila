import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeckPoolService, DeckPoolState } from '../../../../../modules/cards/services/deck-pool.service';
import { GameStateEntity, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';
import { DameNatureMetadata } from './dame-nature.service';
import { dameNatureLog } from '../../../../../../common/utils/damenature-logger';
import {
  DameNatureDangerCardDef,
  DameNatureFamiliesJsonV1,
  DameNaturePollutionJsonV1,
  DameNatureQuizCardDef,
  DameNatureQuizJsonV1,
} from '../models/dame-nature-catalog.model';

export type FamilyCard = {
  kind?: 'family' | 'quiz' | 'danger';
  familyId: string;
  familyName: string;
  memberId: string;
  memberName: string;
  role: string;
  question?: string;
  answer?: string;
  choices?: string[];
  pollutionDelta?: number;
};

type FamilyDef = {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; role: string }>;
};

@Injectable()
export class DameNatureSetupService {
  constructor(private readonly deckPool: DeckPoolService) {}

  private familiesCache: FamilyDef[] | null = null;
  private quizCache: DameNatureQuizCardDef[] | null = null;
  private dangerCache: DameNatureDangerCardDef[] | null = null;
  private familiesJsonCache: DameNatureFamiliesJsonV1 | null = null;
  private quizJsonCache: DameNatureQuizJsonV1 | null = null;
  private pollutionJsonCache: DameNaturePollutionJsonV1 | null = null;

  private static findUp(startDir: string, filename: string, maxDepth = 10): string | null {
    let current = startDir;
    for (let depth = 0; depth < maxDepth; depth += 1) {
      const candidate = path.join(current, filename);
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  }

  private static readTextFileWithFallback(filePath: string): string {
    const utf8 = fs.readFileSync(filePath, { encoding: 'utf8' }).replace(/^\uFEFF/, '');
    const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
    if (replacementCount <= 2) return utf8;
    return fs.readFileSync(filePath, { encoding: 'latin1' }).replace(/^\uFEFF/, '');
  }

  private static fixMojibakeString(value: string): string {
    const score = (s: string) => {
      const suspicious = (s.match(/[\u00C2\u00C3\u00E2\u0153\u0178\u0160\u0161\u017D\u017E\u2030]/g) ?? []).length;
      const replacement = (s.match(/\uFFFD/g) ?? []).length;
      return suspicious * 2 + replacement * 10;
    };
    const currentScore = score(value);
    if (currentScore === 0) return value;

    const windows1252ToBytes = (input: string): Uint8Array => {
      // Convertit une string JS (Unicode) en bytes CP1252, pour corriger le mojibake du type "Ã‰" (Ã + ‰).
      const map: Record<number, number> = {
        0x20ac: 0x80,
        0x201a: 0x82,
        0x0192: 0x83,
        0x201e: 0x84,
        0x2026: 0x85,
        0x2020: 0x86,
        0x2021: 0x87,
        0x02c6: 0x88,
        0x2030: 0x89,
        0x0160: 0x8a,
        0x2039: 0x8b,
        0x0152: 0x8c,
        0x017d: 0x8e,
        0x2018: 0x91,
        0x2019: 0x92,
        0x201c: 0x93,
        0x201d: 0x94,
        0x2022: 0x95,
        0x2013: 0x96,
        0x2014: 0x97,
        0x02dc: 0x98,
        0x2122: 0x99,
        0x0161: 0x9a,
        0x203a: 0x9b,
        0x0153: 0x9c,
        0x017e: 0x9e,
        0x0178: 0x9f,
      };
      const bytes: number[] = [];
      for (const ch of input) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp <= 0xff) {
          bytes.push(cp);
        } else if (map[cp] != null) {
          bytes.push(map[cp]);
        } else {
          // caractère non représentable en cp1252 -> remplacer (laisser la string telle quelle)
          bytes.push(0x3f); // '?'
        }
      }
      return Uint8Array.from(bytes);
    };

    const candidates = [
      Buffer.from(value, 'latin1').toString('utf8'),
      Buffer.from(windows1252ToBytes(value)).toString('utf8'),
    ].filter((c) => typeof c === 'string' && c.length > 0);

    let best = value;
    let bestScore = currentScore;
    for (const c of candidates) {
      const s = score(c);
      if (s < bestScore) {
        best = c;
        bestScore = s;
      }
    }
    return best;
  }

  private static fixMojibakeDeep<T>(value: T): T {
    if (typeof value === 'string') {
      return DameNatureSetupService.fixMojibakeString(value) as unknown as T;
    }
    if (Array.isArray(value)) {
      return value.map((v) => DameNatureSetupService.fixMojibakeDeep(v)) as unknown as T;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      Object.keys(obj).forEach((k) => {
        out[k] = DameNatureSetupService.fixMojibakeDeep(obj[k]);
      });
      return out as T;
    }
    return value;
  }

  families(): FamilyDef[] {
    if (this.familiesCache) return this.familiesCache;

    const familiesJson = this.familiesJson();
    this.familiesCache = familiesJson.families.map((f) => ({
      id: f.id,
      name: f.name,
      members: (f.members ?? []).map((m) => ({ id: m.id, name: m.name, role: 'Membre' })),
    }));
    return this.familiesCache;
  }

  quizCards(): DameNatureQuizCardDef[] {
    if (this.quizCache) return this.quizCache;
    const quizJson = this.quizJson();
    this.quizCache = quizJson.quiz ?? [];
    return this.quizCache;
  }

  dangerCards(): DameNatureDangerCardDef[] {
    if (this.dangerCache) return this.dangerCache;
    const pollutionJson = this.pollutionJson();
    this.dangerCache = pollutionJson.cards ?? [];
    return this.dangerCache;
  }

  maxPollution(): number {
    const pollutionJson = this.pollutionJson();
    return typeof pollutionJson.maxPollution === 'number' ? pollutionJson.maxPollution : 12;
  }

  private familiesJson(): DameNatureFamiliesJsonV1 {
    if (this.familiesJsonCache) return this.familiesJsonCache;
    const filePath = path.join(__dirname, '..', 'models', 'families.json');
    try {
      const raw = DameNatureSetupService.readTextFileWithFallback(filePath);
      const parsed = DameNatureSetupService.fixMojibakeDeep(JSON.parse(raw)) as DameNatureFamiliesJsonV1;
      if (!parsed || (parsed as any).version !== 1) throw new Error('version');
      if (!Array.isArray(parsed.families) || parsed.families.length === 0) throw new Error('families');
      this.familiesJsonCache = parsed;
      dameNatureLog('setup.families_json.loaded', { source: filePath, families: parsed.families.length });
      return parsed;
    } catch (e) {
      throw new Error(`Catalogue Dame Nature introuvable/invalide: families.json (${String(e)})`);
    }
  }

  private quizJson(): DameNatureQuizJsonV1 {
    if (this.quizJsonCache) return this.quizJsonCache;
    const filePath = path.join(__dirname, '..', 'models', 'quiz.json');
    try {
      const raw = DameNatureSetupService.readTextFileWithFallback(filePath);
      const parsed = DameNatureSetupService.fixMojibakeDeep(JSON.parse(raw)) as DameNatureQuizJsonV1;
      if (!parsed || (parsed as any).version !== 1) throw new Error('version');
      if (!Array.isArray(parsed.quiz)) throw new Error('quiz');
      this.quizJsonCache = parsed;
      dameNatureLog('setup.quiz_json.loaded', { source: filePath, quiz: parsed.quiz.length });
      return parsed;
    } catch (e) {
      throw new Error(`Catalogue Dame Nature introuvable/invalide: quiz.json (${String(e)})`);
    }
  }

  private pollutionJson(): DameNaturePollutionJsonV1 {
    if (this.pollutionJsonCache) return this.pollutionJsonCache;
    const filePath = path.join(__dirname, '..', 'models', 'pollution.json');
    try {
      const raw = DameNatureSetupService.readTextFileWithFallback(filePath);
      const parsed = DameNatureSetupService.fixMojibakeDeep(JSON.parse(raw)) as DameNaturePollutionJsonV1;
      if (!parsed || (parsed as any).version !== 1) throw new Error('version');
      if (!Array.isArray(parsed.cards)) throw new Error('cards');
      if (typeof parsed.maxPollution !== 'number') throw new Error('maxPollution');
      this.pollutionJsonCache = parsed;
      dameNatureLog('setup.pollution_json.loaded', { source: filePath, max: parsed.maxPollution, cards: parsed.cards.length });
      return parsed;
    } catch (e) {
      throw new Error(`Catalogue Dame Nature introuvable/invalide: pollution.json (${String(e)})`);
    }
  }

  buildMetadata(): DameNatureMetadata {
    const families = this.families();
    if (!families.length) {
      throw new Error('Impossible de démarrer Dame Nature: aucune famille définie (catalogue vide).');
    }
    const deck: FamilyCard[] = [];
    families.forEach((fam) => {
      fam.members.forEach((m) => {
        deck.push({
          kind: 'family',
          familyId: fam.id,
          familyName: fam.name,
          memberId: m.id,
          memberName: m.name,
          role: m.role,
        });
      });
    });

    // Cartes spéciales : Nature en danger / Quiz (définies via JSON/texte)
    const dangerCards: FamilyCard[] = this.dangerCards().map((d) => ({
      kind: 'danger',
      familyId: 'danger',
      familyName: 'Nature en danger',
      memberId: d.id,
      memberName: d.label,
      role: 'Événement',
      pollutionDelta: d.pollutionDelta,
    }));

    const quizCards: FamilyCard[] = this.quizCards().map((q) => ({
      kind: 'quiz',
      familyId: 'quiz',
      familyName: 'Quiz Nature',
      memberId: q.id,
      memberName: q.question,
      role: 'Quiz',
      question: q.question,
      answer: q.answer,
      choices: q.choices,
    }));

    deck.push(...dangerCards, ...quizCards);
    return {
      decks: this.deckPool.set<FamilyCard>({}, 'family', this.deckPool.shuffle(deck)),
      familyGoal: 4,
      maxPollution: this.maxPollution(),
      pollutionByPlayer: {},
      catalog: { families: families.map((f) => ({ id: f.id, name: f.name })) },
      actionLog: [],
      phaseId: 'turn',
      victoryId: null,
      winnerId: null,
    };
  }

  drawCard(meta: DameNatureMetadata): { card: FamilyCard | null; metadata: DameNatureMetadata } {
    const { card, pool } = this.deckPool.draw<FamilyCard>(meta.decks as DeckPoolState<FamilyCard>, 'family');
    const metadata: DameNatureMetadata = { ...meta, decks: pool };
    return { card: card ?? null, metadata };
  }

  discardCard(meta: DameNatureMetadata, card: FamilyCard): DameNatureMetadata {
    const decks = this.deckPool.discard(meta.decks as DeckPoolState<FamilyCard>, 'family', card);
    return { ...meta, decks };
  }

  /**
   * Pioche une carte de famille uniquement (ignore les quiz/danger) pour l'initialisation.
   * Les cartes non-famille sont retirées du paquet et ignorées pour ne pas polluer les mains.
   */
  drawFamilyCard(meta: DameNatureMetadata): { card: FamilyCard | null; metadata: DameNatureMetadata; skipped: FamilyCard[] } {
    let currentMeta = meta;
    const skipped: FamilyCard[] = [];
    for (let i = 0; i < 50; i += 1) {
      const draw = this.drawCard(currentMeta);
      currentMeta = draw.metadata;
      if (!draw.card) return { card: null, metadata: currentMeta, skipped };
      if (draw.card.kind === 'family' || !draw.card.kind) {
        return { card: draw.card, metadata: currentMeta, skipped };
      }
      // On retire les cartes spéciales des mains initiales, mais on les conserve en défausse pour qu'elles puissent être piochées plus tard.
      skipped.push(draw.card);
      currentMeta = this.discardCard(currentMeta, draw.card);
    }
    return { card: null, metadata: currentMeta, skipped };
  }

  initializePlayers(
    baseState: GameStateEntity,
    metadata: DameNatureMetadata,
  ): Array<PlayerStateEntity & { hand: FamilyCard[]; handCount: number; books: string[] }> {
    const allPlayers: Array<PlayerStateEntity & { hand: FamilyCard[]; handCount: number; books: string[] }> = [];
    (baseState.players ?? []).forEach((p) => {
      allPlayers.push({
        id: p.id,
        username: p.username,
        isBot: (p as any).isBot ?? false,
        hand: [],
        handCount: 0,
        books: [],
      });
    });
    // distribution initiale (4 cartes)
    for (let i = 0; i < 4; i += 1) {
      for (const player of allPlayers) {
        const draw = this.drawFamilyCard(metadata);
        metadata.decks = draw.metadata.decks;
        if (!draw.card) break;
        if (draw.skipped.length) {
          dameNatureLog('init.skip_special', {
            playerId: player.id,
            skipped: draw.skipped.map((c) => c.kind ?? 'special'),
          });
        }
        player.hand.push(draw.card);
        player.handCount = player.hand.length;
      }
    }
    return allPlayers;
  }

  ensurePlayers(state: GameStateEntity) {
    const players = state.players ?? [];
    return players.map((p) => {
      const anyPlayer = p as any;
      const hand: FamilyCard[] = Array.isArray(anyPlayer.hand) ? anyPlayer.hand : [];
      const books: string[] = Array.isArray(anyPlayer.books) ? anyPlayer.books : [];
      return {
        id: p.id,
        username: p.username,
        isBot: anyPlayer.isBot ?? false,
        hand,
        handCount: anyPlayer.handCount ?? hand.length,
        books,
      };
    });
  }
}
