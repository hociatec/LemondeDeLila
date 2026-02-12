import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { ensureSeededRng } from '../../../../../common/utils/seeded-rng';
import { seededShuffle } from '../../../../../common/utils/seeded-shuffle';
import type {
  AFondLesBallonsCard,
  AFondLesBallonsCharacter,
  AFondLesBallonsMetadata,
  AFondLesBallonsTile,
} from '../model/a-fond-les-ballons-state.entity';
import {
  A_FOND_LES_BALLONS_PAWNS,
  resolvePawnId,
} from '../a-fond-les-ballons.pawns';

@Injectable()
export class AFondLesBallonsSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
    }

    const tiles = buildTiles();

    const metaSeed = (baseState.metadata ?? {}) as any;
    const shuffledDeck = this.random.shuffle(metaSeed, defaultLoufoqueDeck());
    const pawnByPlayerId = normalizePawnAssignments(
      players,
      metaSeed?.pawnByPlayerId ?? metaSeed?.charactersByPlayerId,
    );
    const setupStarterId =
      typeof metaSeed?.setupStarterId === 'number'
        ? metaSeed.setupStarterId
        : resolveSeededStarterId(
            players,
            baseState.metadata ?? {},
            baseState.turn?.currentPlayerId ?? null,
          );
    const charactersByPlayerId = buildCharactersByPlayerId(pawnByPlayerId);

    const metaBase: AFondLesBallonsMetadata = {
      tiles,
      positions,
      pawns: A_FOND_LES_BALLONS_PAWNS,
      pawnByPlayerId,
      setupStarterId,
      charactersByPlayerId,
      statuses: { skipTurn: {}, trapImmunityTurns: {} },
      decks: {
        loufoque: shuffledDeck.values,
        discardLoufoque: [],
      },
      winnerId: null,
    };

    const pendingInfo = buildPawnPending(players, pawnByPlayerId, setupStarterId);
    const turnIndex =
      pendingInfo?.turnIndex != null ? pendingInfo.turnIndex : baseState.turnIndex;
    const turnPlayerId =
      pendingInfo?.playerId != null
        ? pendingInfo.playerId
        : setupStarterId ?? baseState.turn?.currentPlayerId ?? null;

    let next: GameStateEntity = {
      ...baseState,
      phase: 'playing',
      pending: pendingInfo?.pending ?? null,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: turnPlayerId,
        direction: 1,
      },
      turnIndex,
      metadata: { ...metaSeed, ...shuffledDeck.meta, ...metaBase },
    };

    next = this.core.appendLog(next, '=== A fond les ballons ! ===');
    next = this.core.appendLog(
      next,
      "Objectif : atteindre exactement la case 40 (la Grosse Noix Dor�e). Si vous d�passez, vous reculez du surplus.",
    );
    next = this.core.appendLog(next, 'Pions disponibles :');
    for (const pawn of A_FOND_LES_BALLONS_PAWNS) {
      next = this.core.appendLog(next, `- ${pawn.label}`);
    }

    return next;
  }
}

function resolveSeededStarterId(
  players: Array<{ id: number }>,
  meta: unknown,
  fallbackId: number | null,
): number | null {
  if (!players.length) return fallbackId;
  if (typeof fallbackId === 'number' && players.some((p) => p?.id === fallbackId)) {
    return fallbackId;
  }
  const seed = ensureSeededRng((meta ?? {}) as Record<string, unknown>).seed;
  const shuffled = seededShuffle(players, seed, 'a-fond-les-ballons:setup-starter');
  return shuffled[0]?.id ?? fallbackId ?? players[0]?.id ?? null;
}

function buildTiles(): AFondLesBallonsTile[] {
  const types: AFondLesBallonsTile['type'][] = [
    'start',
    'bonus',
    'folie',
    'neutral',
    'piege',
    'glissade',
    'neutral',
    'tornade',
    'folie',
    'neutral',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'chaton',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'tornade',
    'folie',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'piege',
    'glissade',
    'finish',
  ];

  const tiles: AFondLesBallonsTile[] = [];
  for (let i = 0; i < 40; i += 1) {
    const type = types[i] ?? 'neutral';
    const caseNumber = i + 1;

    const label =
      type === 'start'
        ? 'Départ - La Tanière à Tartines'
        : type === 'finish'
          ? 'La Grosse Noix Dorée'
          : type === 'bonus'
            ? 'Bonus'
            : type === 'folie'
              ? 'Folie'
              : type === 'piege'
                ? 'Piège'
                : type === 'glissade'
                  ? 'Glissade'
                  : type === 'tornade'
                    ? 'Tornade'
                    : type === 'chaton'
                      ? 'Chaton'
                      : 'Neutre';

    tiles.push({
      type,
      label: `Case ${caseNumber} - ${label}`,
      description: CASE_DESCRIPTIONS[i],
    });
  }
  return tiles;
}



function normalizePawnAssignments(
  players: Array<{ id: number }>,
  raw: unknown,
): Record<number, string> {
  const byId: Record<number, string> = {};
  if (!raw || typeof raw !== 'object') return byId;
  const used = new Set<string>();
  for (const p of players) {
    const value = (raw as any)[p.id];
    const resolved = resolvePawnId(value);
    if (!resolved || used.has(resolved)) continue;
    used.add(resolved);
    byId[p.id] = resolved;
  }
  return byId;
}

function buildPawnPending(
  players: Array<{ id: number }>,
  pawnByPlayerId: Record<number, string>,
  startId: number | null,
): { pending: any; playerId: number; turnIndex: number } | null {
  if (!players.length) return null;
  const startIndex =
    startId != null ? players.findIndex((p) => p?.id === startId) : -1;
  const count = players.length;
  const baseIndex = startIndex >= 0 ? startIndex : 0;
  let nextIndex = -1;
  for (let i = 0; i < count; i += 1) {
    const idx = (baseIndex + i) % count;
    const pid = players[idx]?.id;
    if (pid == null) continue;
    if (!pawnByPlayerId[pid]) {
      nextIndex = idx;
      break;
    }
  }
  if (nextIndex < 0) return null;

  const used = new Set(
    Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
  );
  const choices = A_FOND_LES_BALLONS_PAWNS.filter((p) => !used.has(p.id));
  if (choices.length === 0) return null;

  return {
    playerId: players[nextIndex].id,
    turnIndex: nextIndex,
    pending: {
      type: 'choose_pawn',
      playerId: players[nextIndex].id,
      blocking: true,
      label: 'Choisissez votre pion.',
      choices: choices.map((p) =>
        p.description && String(p.description).trim().length > 0
          ? `${p.label}: ${p.description}`
          : p.label,
      ),
      data: {
        pawns: choices.map((p) => ({
          id: p.id,
          label: p.label,
          description: p.description,
        })),
      },
    },
  };
}

function buildCharactersByPlayerId(
  pawnByPlayerId: Record<number, string>,
): Record<number, AFondLesBallonsCharacter> {
  const byId: Record<number, AFondLesBallonsCharacter> = {};
  for (const [playerIdRaw, pawnId] of Object.entries(pawnByPlayerId ?? {})) {
    const playerId = Number(playerIdRaw);
    if (!Number.isFinite(playerId)) continue;
    const pawn = A_FOND_LES_BALLONS_PAWNS.find((p) => p.id === pawnId);
    if (!pawn) continue;
    byId[playerId] = {
      id: pawn.id,
      name: pawn.label,
      description: pawn.description,
    };
  }
  return byId;
}

const CASE_DESCRIPTIONS: string[] = [
  "Vous commencez votre aventure à la Tanière à Tartines. Prenez une grande inspiration et sentez l'air frais de la course.",
  "Un tunnel secret s'ouvre entre deux racines. Vous glissez à toute vitesse et avancez de 2 cases supplémentaires.",
  "Une noix farfelue rebondit devant vous ! La folie vous emporte : piochez une carte Loufoque.",
  "Des feuilles mortes crissent sous vos pattes, mais vous avancez calmement.",
  "Une tartine gluante traîne sur le sol. Oh non ! Vous glissez et reculez de 2 cases.",
  "Une flaque de confiture vous fait tourner sur vous-même. Avancez ou reculez de 1 à 3 cases, aléatoirement.",
  "Une douce brise caresse vos moustaches. Rien à signaler ici, continuez votre route.",
  "Un vent fou souffle dans la clairière ! Vous échangez votre place avec un joueur de votre choix.",
  "Une gerbille farceuse vous regarde intensément. La folie s'empare de vous : piochez une carte Loufoque.",
  "Une clairière tranquille s'étend devant vous, idéale pour souffler un peu.",
  "Vous découvrez un passage rapide entre les arbres. Avancez de 2 cases supplémentaires.",
  "Vous glissez sur une racine humide ! Reculez de 2 cases.",
  "Un petit ruisseau vous fait tourner sur vous-même. Avancez ou reculez de 1 à 3 cases, aléatoirement.",
  "Vous passez sous un vieux chêne majestueux. Rien ne vous retient ici.",
  "Une bulle de savon géante apparaît ! Piochez une carte Loufoque et appliquez son effet.",
  "Un tunnel sombre et secret s'ouvre. Vous avancez de 2 cases supplémentaires.",
  "Une flaque de sirop gluant vous fait perdre l'équilibre. Reculez de 2 cases.",
  "Le sol est recouvert de mousse glissante. Tournez sur vous-même et avancez ou reculez de 1 à 3 cases, aléatoirement.",
  "Une odeur de noisette flotte dans l'air. Vous pouvez avancer tranquillement.",
  "Une noix chanteuse vous perturbe. Piochez une carte Loufoque.",
  "Catastrophe ! Le Grand Chaton Gourmand rôde ici. Il vous attrape et vous renvoie à la case départ.",
  "Un petit tunnel secret se révèle derrière un buisson. Avancez de 2 cases supplémentaires.",
  "Une tartine tombée vous fait glisser. Reculez de 2 cases.",
  "Une flaque de lait renversé vous fait tourner. Avancez ou reculez de 1 à 3 cases, aléatoirement.",
  "Une branche basse frôle votre museau. Rien de bien méchant ici.",
  "Un minuscule campagnol farceur surgit. Piochez une carte Loufoque.",
  "Vous trouvez un passage rapide entre les rochers. Avancez de 2 cases supplémentaires.",
  "Une tartine gluante apparaît au détour d'un chemin. Reculez de 2 cases.",
  "Une feuille glissante vous fait tourner sur vous-même. Avancez ou reculez de 1 à 3 cases, aléatoirement.",
  "Vous traversez un sentier calme bordé de fleurs. Rien ne vous retient.",
  "Un vent tourbillonnant soulève des feuilles et petits cailloux. Échangez votre place avec un joueur de votre choix.",
  "Une noix magique tombe juste devant vous. Piochez une carte Loufoque.",
  "Vous trouvez un tunnel étroit caché sous les racines. Avancez de 2 cases supplémentaires.",
  "Une flaque de confiture inattendue vous fait reculer de 2 cases.",
  "Un ruisseau bouillonnant vous fait tourner sur vous-même. Avancez ou reculez de 1 à 3 cases, aléatoirement.",
  "Une petite clairière ensoleillée vous permet de souffler un peu.",
  "Un étrange bruit derrière un buisson vous surprend. Piochez une carte Loufoque.",
  "Une tartine glissante vous fait perdre l'équilibre. Reculez de 2 cases.",
  "Vous glissez sur une feuille humide et tournez sur vous-même. Avancez ou reculez de 1 à 3 cases, aléatoirement.",
  "La Grosse Noix Dorée est juste là ! Vous l'atteignez enfin et remportez la partie. Félicitations, Rongeur Suprême !",
];
function defaultLoufoqueDeck(): AFondLesBallonsCard[] {
  return [
    { id: 1, text: 'Vous glissez sur une peau de banane séchée. Reculez de 2 cases.' },
    {
      id: 2,
      text: 'Un muscardin vous livre un cookie géant, beaucoup trop lourd. Passez votre tour.',
    },
    {
      id: 3,
      text: 'Vous sautez dans une flaque de confiture collante. Avancez d\'une case.',
    },
    {
      id: 4,
      text: 'Une noix étrange chante et perturbe la Tanière. La partie est figée : aucun joueur n\'agit pendant ce tour.',
    },
    {
      id: 5,
      text: 'Un écureuil volant vous prend pour un ami et vous emporte dans les airs. Avancez de 4 cases.',
    },
    {
      id: 6,
      text: 'Vous renversez une bouteille de sirop magique. Tous les joueurs reculent d\'une case.',
    },
    {
      id: 7,
      text: 'Vous trouvez une corde à sauter en réglisse enchantée. Avancez de 2 cases.',
    },
    { id: 8, text: 'Le Grand Chaton éternue violemment. Reculez d\'une case.' },
    {
      id: 9,
      text: 'Vous vous prenez les pattes dans du chewing-gum collant. Passez votre tour.',
    },
    {
      id: 10,
      text: 'Un lérot ninja surgit et vous tend une noisette turbo. Avancez jusqu\'à la prochaine case Bonus.',
    },
    {
      id: 11,
      text: 'Vous mangez trop de pop-corn et avez mal au ventre. Passez votre tour.',
    },
    {
      id: 12,
      text: 'Votre museau vous démange sans raison. Reculez d\'une case.',
    },
    {
      id: 13,
      text: 'Une gerboise farceuse vous chatouille les pattes. Sautez d\'une case.',
    },
    {
      id: 14,
      text: 'Vous chevauchez un ragondin en trottinette. Avancez de 3 cases.',
    },
    {
      id: 15,
      text: 'Vous faites tomber une montagne de cacahuètes. Distrait, vous reculez d\'une case.',
    },
    {
      id: 16,
      text: 'Une bulle de savon géante vous emporte. Avancez jusqu\'à la prochaine case Folie.',
    },
    {
      id: 17,
      text: 'Un capybara vous invite à une sieste improvisée. Passez votre tour et ronflez à ses côtés.',
    },
    {
      id: 18,
      text: 'Une souris malicieuse vous pique une noisette et file à toute vitesse. Vous la poursuivez et avancez de 2 cases.',
    },
    {
      id: 19,
      text: 'Un loir vous montre le chemin en remuant la queue. Avancez d\'une case en souriant.',
    },
    {
      id: 20,
      text: 'Vous confondez une chaussette avec un bonnet, et ne voyez plus rien. Passez votre tour.',
    },
    {
      id: 21,
      text: 'Vous renversez un pot de peinture fluo. Tout le monde avance d\'une case.',
    },
    {
      id: 22,
      text: 'Une baguette magique vous transforme temporairement en fromage. Passez deux tours.',
    },
    { id: 23, text: 'Vous trouvez un trampoline géant. Avancez de 4 cases.' },
    {
      id: 24,
      text: 'Un agouti philosophe vous parle longuement. Passez votre tour.',
    },
    {
      id: 25,
      text: 'Vous construisez une solide cabane en biscuits. Rejouez.',
    },
    {
      id: 26,
      text: 'Vous éternuez des confettis multicolores. Tous les joueurs avancent du même nombre de cases obtenu précédemment.',
    },
    {
      id: 27,
      text: 'Un petit avion de carton vous emporte maladroitement. Avancez d\'une case, puis reculez de deux.',
    },
    {
      id: 28,
      text: 'Vous lisez un vieux grimoire ronronique. Échangez votre position avec le joueur de votre choix.',
    },
    {
      id: 29,
      text: 'Une catapulte de fromage rebondit sur vous. Reculez jusqu\'à la case 13.',
    },
    {
      id: 30,
      text: 'Vous tombez dans une mare d\'épaisse mousse. Passez votre tour.',
    },
    {
      id: 31,
      text: 'Un hutia curieux bondit sur votre chemin et vous bouscule gentiment. Avancez d\'une case un peu étourdi.',
    },
    {
      id: 32,
      text: 'Un fromage qui parle vous raconte une irrésistible blague. Avancez de 2 cases.',
    },
    {
      id: 33,
      text: 'Vous jouez à saute-rongeur avec un paca. Avancez de 3 cases.',
    },
    {
      id: 34,
      text: 'Vous entrez dans la Boutique des Rongeurs Fous. Piochez deux cartes Loufoques et appliquez celle qui vous fait le plus reculer.',
    },
    {
      id: 35,
      text: 'Un tunnel défectueux vous mène droit chez le Chaton gourmand. Retournez à la case départ.',
    },
    {
      id: 36,
      text: 'Vous devenez temporairement invisible. Durant deux tours, vous ignorez les effets des cases Piège.',
    },
    {
      id: 37,
      text: 'Vous mangez un piment super piquant. Reculez de 5 cases.',
    },
    {
      id: 38,
      text: 'Un biscuit géant explose. Tous les joueurs se déplacent d\'une case aléatoire.',
    },
    {
      id: 39,
      text: 'Une pluie de bonbons tombe sur vous. Avancez de 2 cases.',
    },
    {
      id: 40,
      text: 'La Reine des Rongeurs vous envoie un message. Si vous êtes sur une case Glissade, avancez jusqu\'à la case 40.',
    },
  ];
}

