import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import { getSafePlayers } from '../../../../../application/helpers/setup-service.helper';
import { loadV1Content } from '../../../../../application/helpers/content-loader.helper';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { GameContentLoaderService } from '../../../engine/public-api';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { loadCanonicalPawns } from '../../../../../application/helpers/pawn-catalog.helper';
import { ensureSeededRng } from '../../../../../../common/utils/public-api';
import { seededShuffle } from '../../../../../../common/utils/public-api';
import { queueConfiguredPawnSelection } from '../../../../../application/helpers/configured-pawn-setup.helper';
import type {
  AFondLesBallonsCard,
  AFondLesBallonsCharacter,
  AFondLesBallonsMetadata,
  AFondLesBallonsPawnsJsonV1,
  AFondLesBallonsTile,
} from '../../model/a-fond-les-ballons-state.model';

export class AFondLesBallonsSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private loadPawns() {
    const raw = loadV1Content<AFondLesBallonsPawnsJsonV1>(this.contentLoader, {
      gameType: 'a-fond-les-ballons',
      baseDir: __dirname,
      filename: 'pawns.json',
      arrayField: 'pawns',
      minItems: 1,
    });

    return loadCanonicalPawns(raw.pawns).map((pawn) => ({
      id: pawn.id,
      label: pawn.name,
      description: pawn.description,
    }));
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const positions: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
    }

    const tiles = buildTiles();

    const metaSeed = asRecord(baseState.metadata);
    const shuffledDeck = this.random.shuffle(metaSeed, defaultLoufoqueDeck());
    const pawns = this.loadPawns();
    const pawnByPlayerId = normalizePawnAssignments(
      players,
      metaSeed.pawnByPlayerId ?? metaSeed.charactersByPlayerId,
      pawns,
    );
    const setupStarterId =
      typeof metaSeed.setupStarterId === 'number'
        ? metaSeed.setupStarterId
        : resolveSeededStarterId(
            players,
            baseState.metadata ?? {},
            baseState.turn?.currentPlayerId ?? null,
          );
    const charactersByPlayerId = buildCharactersByPlayerId(
      pawnByPlayerId,
      pawns,
    );

    const metaBase: AFondLesBallonsMetadata = {
      tiles,
      positions,
      pawns,
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

    const next: GameStateEntity = {
      ...baseState,
      phase: 'playing',
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: setupStarterId,
        direction: 1,
      },
      metadata: { ...metaSeed, ...shuffledDeck.meta, ...metaBase },
    };

    return queueConfiguredPawnSelection({
      state: next,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: pawns,
      startPlayerId: setupStarterId,
      pendingType: 'choose_pawn',
      metadataAssignmentKey: 'pawnByPlayerId',
      pawnDataMapper: (p) => ({
        id: toText(p.id),
        label: toText(p.label),
        description: toText(p.description),
      }),
    });
  }
}

function resolveSeededStarterId(
  players: Array<{ id: number }>,
  meta: unknown,
  fallbackId: number | null,
): number | null {
  if (!players.length) return fallbackId;
  if (
    typeof fallbackId === 'number' &&
    players.some((p) => p?.id === fallbackId)
  ) {
    return fallbackId;
  }
  const seed = ensureSeededRng((meta ?? {}) as Record<string, unknown>).seed;
  const shuffled = seededShuffle(
    players,
    seed,
    'a-fond-les-ballons:setup-starter',
  );
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
        ? 'DÃ©part - La TaniÃ¨re Ã  Tartines'
        : type === 'finish'
          ? 'La Grosse Noix DorÃ©e'
          : type === 'bonus'
            ? 'Bonus'
            : type === 'folie'
              ? 'Folie'
              : type === 'piege'
                ? 'PiÃ¨ge'
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
  pawns: Array<{ id: string; label: string }>,
): Record<number, string> {
  const byId: Record<number, string> = {};
  if (!raw || typeof raw !== 'object') return byId;
  const rawRecord = asRecord(raw);
  const used = new Set<string>();
  for (const p of players) {
    const value = rawRecord[String(p.id)];
    const resolved = resolvePawnIdFromChoices(value, pawns);
    if (!resolved || used.has(resolved)) continue;
    used.add(resolved);
    byId[p.id] = resolved;
  }
  return byId;
}

function buildCharactersByPlayerId(
  pawnByPlayerId: Record<number, string>,
  pawns: Array<{ id: string; label: string; description: string }>,
): Record<number, AFondLesBallonsCharacter> {
  const byId: Record<number, AFondLesBallonsCharacter> = {};
  for (const [playerIdRaw, pawnId] of Object.entries(pawnByPlayerId ?? {})) {
    const playerId = Number(playerIdRaw);
    if (!Number.isFinite(playerId)) continue;
    const pawn = pawns.find((p) => p.id === pawnId);
    if (!pawn) continue;
    byId[playerId] = {
      id: pawn.id,
      name: pawn.label,
      description: pawn.description,
    };
  }
  return byId;
}

function resolvePawnIdFromChoices(
  raw: unknown,
  pawns: Array<{ id: string; label: string }>,
): string | null {
  if (raw == null) return null;
  const rawRecord = asRecord(raw);
  const value =
    typeof raw === 'object'
      ? (rawRecord.id ?? rawRecord.pawnId ?? rawRecord.value ?? raw)
      : raw;
  const text = toText(value);
  if (!text) return null;
  const key = normalizePawnKey(text);
  const direct = pawns.find((p) => normalizePawnKey(p.id) === key);
  if (direct) return direct.id;
  const byLabel = pawns.find((p) => normalizePawnKey(p.label) === key);
  return byLabel?.id ?? null;
}

function normalizePawnKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const CASE_DESCRIPTIONS: string[] = [
  "Vous commencez votre aventure Ã  la TaniÃ¨re Ã  Tartines. Prenez une grande inspiration et sentez l'air frais de la course.",
  "Un tunnel secret s'ouvre entre deux racines. Vous glissez Ã  toute vitesse et avancez de 2 cases supplÃ©mentaires.",
  'Une noix farfelue rebondit devant vous ! La folie vous emporte : piochez une carte Loufoque.',
  'Des feuilles mortes crissent sous vos pattes, mais vous avancez calmement.',
  'Une tartine gluante traÃ®ne sur le sol. Oh non ! Vous glissez et reculez de 2 cases.',
  'Une flaque de confiture vous fait tourner sur vous-mÃªme. Avancez ou reculez de 1 Ã  3 cases, alÃ©atoirement.',
  'Une douce brise caresse vos moustaches. Rien Ã  signaler ici, continuez votre route.',
  'Un vent fou souffle dans la clairiÃ¨re ! Vous Ã©changez votre place avec un joueur de votre choix.',
  "Une gerbille farceuse vous regarde intensÃ©ment. La folie s'empare de vous : piochez une carte Loufoque.",
  "Une clairiÃ¨re tranquille s'Ã©tend devant vous, idÃ©ale pour souffler un peu.",
  'Vous dÃ©couvrez un passage rapide entre les arbres. Avancez de 2 cases supplÃ©mentaires.',
  'Vous glissez sur une racine humide ! Reculez de 2 cases.',
  'Un petit ruisseau vous fait tourner sur vous-mÃªme. Avancez ou reculez de 1 Ã  3 cases, alÃ©atoirement.',
  'Vous passez sous un vieux chÃªne majestueux. Rien ne vous retient ici.',
  'Une bulle de savon gÃ©ante apparaÃ®t ! Piochez une carte Loufoque et appliquez son effet.',
  "Un tunnel sombre et secret s'ouvre. Vous avancez de 2 cases supplÃ©mentaires.",
  "Une flaque de sirop gluant vous fait perdre l'Ã©quilibre. Reculez de 2 cases.",
  'Le sol est recouvert de mousse glissante. Tournez sur vous-mÃªme et avancez ou reculez de 1 Ã  3 cases, alÃ©atoirement.',
  "Une odeur de noisette flotte dans l'air. Vous pouvez avancer tranquillement.",
  'Une noix chanteuse vous perturbe. Piochez une carte Loufoque.',
  'Catastrophe ! Le Grand Chaton Gourmand rÃ´de ici. Il vous attrape et vous renvoie Ã  la case dÃ©part.',
  'Un petit tunnel secret se rÃ©vÃ¨le derriÃ¨re un buisson. Avancez de 2 cases supplÃ©mentaires.',
  'Une tartine tombÃ©e vous fait glisser. Reculez de 2 cases.',
  'Une flaque de lait renversÃ© vous fait tourner. Avancez ou reculez de 1 Ã  3 cases, alÃ©atoirement.',
  'Une branche basse frÃ´le votre museau. Rien de bien mÃ©chant ici.',
  'Un minuscule campagnol farceur surgit. Piochez une carte Loufoque.',
  'Vous trouvez un passage rapide entre les rochers. Avancez de 2 cases supplÃ©mentaires.',
  "Une tartine gluante apparaÃ®t au dÃ©tour d'un chemin. Reculez de 2 cases.",
  'Une feuille glissante vous fait tourner sur vous-mÃªme. Avancez ou reculez de 1 Ã  3 cases, alÃ©atoirement.',
  'Vous traversez un sentier calme bordÃ© de fleurs. Rien ne vous retient.',
  'Un vent tourbillonnant soulÃ¨ve des feuilles et petits cailloux. Ã‰changez votre place avec un joueur de votre choix.',
  'Une noix magique tombe juste devant vous. Piochez une carte Loufoque.',
  'Vous trouvez un tunnel Ã©troit cachÃ© sous les racines. Avancez de 2 cases supplÃ©mentaires.',
  'Une flaque de confiture inattendue vous fait reculer de 2 cases.',
  'Un ruisseau bouillonnant vous fait tourner sur vous-mÃªme. Avancez ou reculez de 1 Ã  3 cases, alÃ©atoirement.',
  'Une petite clairiÃ¨re ensoleillÃ©e vous permet de souffler un peu.',
  'Un Ã©trange bruit derriÃ¨re un buisson vous surprend. Piochez une carte Loufoque.',
  "Une tartine glissante vous fait perdre l'Ã©quilibre. Reculez de 2 cases.",
  'Vous glissez sur une feuille humide et tournez sur vous-mÃªme. Avancez ou reculez de 1 Ã  3 cases, alÃ©atoirement.',
  "La Grosse Noix DorÃ©e est juste lÃ  ! Vous l'atteignez enfin et remportez la partie. FÃ©licitations, Rongeur SuprÃªme !",
];
function defaultLoufoqueDeck(): AFondLesBallonsCard[] {
  return [
    {
      id: 1,
      text: 'Vous glissez sur une peau de banane sÃ©chÃ©e. Reculez de 2 cases.',
    },
    {
      id: 2,
      text: 'Un muscardin vous livre un cookie gÃ©ant, beaucoup trop lourd. Passez votre tour.',
    },
    {
      id: 3,
      text: "Vous sautez dans une flaque de confiture collante. Avancez d'une case.",
    },
    {
      id: 4,
      text: "Une noix Ã©trange chante et perturbe la TaniÃ¨re. La partie est figÃ©e : aucun joueur n'agit pendant ce tour.",
    },
    {
      id: 5,
      text: 'Un Ã©cureuil volant vous prend pour un ami et vous emporte dans les airs. Avancez de 4 cases.',
    },
    {
      id: 6,
      text: "Vous renversez une bouteille de sirop magique. Tous les joueurs reculent d'une case.",
    },
    {
      id: 7,
      text: 'Vous trouvez une corde Ã  sauter en rÃ©glisse enchantÃ©e. Avancez de 2 cases.',
    },
    { id: 8, text: "Le Grand Chaton Ã©ternue violemment. Reculez d'une case." },
    {
      id: 9,
      text: 'Vous vous prenez les pattes dans du chewing-gum collant. Passez votre tour.',
    },
    {
      id: 10,
      text: "Un lÃ©rot ninja surgit et vous tend une noisette turbo. Avancez jusqu'Ã  la prochaine case Bonus.",
    },
    {
      id: 11,
      text: 'Vous mangez trop de pop-corn et avez mal au ventre. Passez votre tour.',
    },
    {
      id: 12,
      text: "Votre museau vous dÃ©mange sans raison. Reculez d'une case.",
    },
    {
      id: 13,
      text: "Une gerboise farceuse vous chatouille les pattes. Sautez d'une case.",
    },
    {
      id: 14,
      text: 'Vous chevauchez un ragondin en trottinette. Avancez de 3 cases.',
    },
    {
      id: 15,
      text: "Vous faites tomber une montagne de cacahuÃ¨tes. Distrait, vous reculez d'une case.",
    },
    {
      id: 16,
      text: "Une bulle de savon gÃ©ante vous emporte. Avancez jusqu'Ã  la prochaine case Folie.",
    },
    {
      id: 17,
      text: 'Un capybara vous invite Ã  une sieste improvisÃ©e. Passez votre tour et ronflez Ã  ses cÃ´tÃ©s.',
    },
    {
      id: 18,
      text: 'Une souris malicieuse vous pique une noisette et file Ã  toute vitesse. Vous la poursuivez et avancez de 2 cases.',
    },
    {
      id: 19,
      text: "Un loir vous montre le chemin en remuant la queue. Avancez d'une case en souriant.",
    },
    {
      id: 20,
      text: 'Vous confondez une chaussette avec un bonnet, et ne voyez plus rien. Passez votre tour.',
    },
    {
      id: 21,
      text: "Vous renversez un pot de peinture fluo. Tout le monde avance d'une case.",
    },
    {
      id: 22,
      text: 'Une baguette magique vous transforme temporairement en fromage. Passez deux tours.',
    },
    { id: 23, text: 'Vous trouvez un trampoline gÃ©ant. Avancez de 4 cases.' },
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
      text: 'Vous Ã©ternuez des confettis multicolores. Tous les joueurs avancent du mÃªme nombre de cases obtenu prÃ©cÃ©demment.',
    },
    {
      id: 27,
      text: "Un petit avion de carton vous emporte maladroitement. Avancez d'une case, puis reculez de deux.",
    },
    {
      id: 28,
      text: 'Vous lisez un vieux grimoire ronronique. Ã‰changez votre position avec le joueur de votre choix.',
    },
    {
      id: 29,
      text: "Une catapulte de fromage rebondit sur vous. Reculez jusqu'Ã  la case 13.",
    },
    {
      id: 30,
      text: "Vous tombez dans une mare d'Ã©paisse mousse. Passez votre tour.",
    },
    {
      id: 31,
      text: "Un hutia curieux bondit sur votre chemin et vous bouscule gentiment. Avancez d'une case un peu Ã©tourdi.",
    },
    {
      id: 32,
      text: 'Un fromage qui parle vous raconte une irrÃ©sistible blague. Avancez de 2 cases.',
    },
    {
      id: 33,
      text: 'Vous jouez Ã  saute-rongeur avec un paca. Avancez de 3 cases.',
    },
    {
      id: 34,
      text: 'Vous entrez dans la Boutique des Rongeurs Fous. Piochez deux cartes Loufoques et appliquez celle qui vous fait le plus reculer.',
    },
    {
      id: 35,
      text: 'Un tunnel dÃ©fectueux vous mÃ¨ne droit chez le Chaton gourmand. Retournez Ã  la case dÃ©part.',
    },
    {
      id: 36,
      text: 'Vous devenez temporairement invisible. Durant deux tours, vous ignorez les effets des cases PiÃ¨ge.',
    },
    {
      id: 37,
      text: 'Vous mangez un piment super piquant. Reculez de 5 cases.',
    },
    {
      id: 38,
      text: "Un biscuit gÃ©ant explose. Tous les joueurs se dÃ©placent d'une case alÃ©atoire.",
    },
    {
      id: 39,
      text: 'Une pluie de bonbons tombe sur vous. Avancez de 2 cases.',
    },
    {
      id: 40,
      text: "La Reine des Rongeurs vous envoie un message. Si vous Ãªtes sur une case Glissade, avancez jusqu'Ã  la case 40.",
    },
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}






