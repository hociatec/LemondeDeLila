import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

import { getSafePlayers } from '../../../../../core/application/helpers/setup-service.helper';
import { loadV1Content } from '../../../../../core/application/helpers/content-loader.helper';
import { GameCoreService } from '../../../../../core/application/services/game-core.service';
import { RandomService } from '../../../../../core/application/services/random.service';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { GameContentLoaderService } from '../../../../../core/application/services/game-content-loader.service';
import { loadCanonicalPawns } from '../../../../../pawn-selection/public-api';
import { ensureSeededRng } from '../../../../../../common/utils/public-api';
import { seededShuffle } from '../../../../../../common/utils/public-api';
import {
  assignConfiguredBotPawns,
  queueConfiguredPawnSelection,
} from '../../../../../pawn-selection/public-api';
import type {
  AventureSauvageCard,
  AventureSauvageMetadata,
  AventureSauvagePawnsJsonV1,
  AventureSauvageTile,
} from '../../model/aventure-sauvage-state.model';

export class AventureSauvageSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly contentLoader: GameContentLoaderService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  private loadPawns() {
    const raw = loadV1Content<AventureSauvagePawnsJsonV1>(this.contentLoader, {
      gameType: 'aventure-sauvage',
      baseDir: __dirname,
      contentDir: '../../model/content',
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
    const baseMeta = asRecord(baseState.metadata);
    const pawns = this.loadPawns();
    const pawnByPlayerId = this.normalizePawnAssignments(
      players,
      baseMeta.pawnByPlayerId,
      pawns,
    );
    const setupStarterId =
      typeof baseMeta.setupStarterId === 'number'
        ? baseMeta.setupStarterId
        : resolveSeededStarterId(
            players,
            baseState.metadata ?? {},
            baseState.turn?.currentPlayerId ?? null,
          );

    const metaBase: AventureSauvageMetadata = {
      tiles,
      positions,
      statuses: { skipTurn: {} },
      pawns,
      pawnByPlayerId,
      setupStarterId,
      decks: {
        animal: [],
        patte: [],
        discardAnimal: [],
        discardPatte: [],
      },
      winnerId: null,
    };

    // IMPORTANT: les cartes doivent etre melangees au debut, sinon on pioche toujours dans l'ordre du fichier.
    // On utilise le RNG seede cote serveur (metadata.rng) pour avoir un comportement stable par "session" (runId/startedAt).
    let rngMeta = buildShuffleMeta(baseState.metadata);
    const shuffledAnimal = this.random.shuffle(rngMeta, defaultAnimalDeck());
    rngMeta = shuffledAnimal.meta;
    const shuffledPatte = this.random.shuffle(rngMeta, defaultPatteDeck());
    rngMeta = shuffledPatte.meta;
    metaBase.decks = {
      ...metaBase.decks,
      animal: shuffledAnimal.values,
      patte: shuffledPatte.values,
    };

    const next: GameStateEntity = {
      ...baseState,
      phase: 'playing',
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: setupStarterId,
        direction: 1,
      },
      metadata: {
        ...(baseState.metadata ?? {}),
        ...metaBase,
        rng: rngMeta.rng,
      },
    };

    const withBots = assignConfiguredBotPawns({
      state: next,
      core: this.core,
      catalog: pawns.map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        description: pawn.description,
      })),
      metadataAssignmentKey: 'pawnByPlayerId',
    });

    return queueConfiguredPawnSelection({
      state: withBots,
      core: this.core,
      setupFlow: this.setupFlow,
      catalog: pawns.map((pawn) => ({
        id: pawn.id,
        label: pawn.label,
        description: pawn.description,
      })),
      startPlayerId: setupStarterId,
      pendingType: 'choose_pawn',
      metadataAssignmentKey: 'pawnByPlayerId',
      choiceLabelBuilder: (pawn) =>
        toText(pawn.description).length > 0
          ? `${toText(pawn.label)}: ${toText(pawn.description)}`
          : toText(pawn.label),
      pawnDataMapper: (choice) => ({
        id: toText(choice.id),
        label: toText(choice.label),
        description: toText(choice.description),
      }),
    });
  }

  private normalizePawnAssignments(
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
      const resolved = this.setupFlow.resolveChoice(value, pawns);
      const pawnId = toText(resolved?.id);
      if (!pawnId || used.has(pawnId)) continue;
      used.add(pawnId);
      byId[p.id] = pawnId;
    }
    return byId;
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
    'aventure-sauvage:setup-starter',
  );
  return shuffled[0]?.id ?? fallbackId ?? players[0]?.id ?? null;
}

function buildTiles(): AventureSauvageTile[] {
  return [
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        "Vous pénétrez dans la jungle par un sentier étroit. L'air est chaud, chargé d'odeurs de feuilles et de terre humide. L'aventure commence.",
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        'Vous avancez sous une canopée dense. Des gouttes tombent encore des branches, comme si la jungle respirait autour de vous.',
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'Vous marchez sur un sol souple recouvert de mousse. Chaque pas devient une petite aventure imprévisible.',
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        'Vous traversez une clairière silencieuse. Le calme est étrange, presque trop parfait.',
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        'Vous suivez un ancien chemin tracé par les saisons, mais quelque chose ralentit soudain votre progression.',
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        "Vous entendez des bruissements lointains dans les feuillages. Impossible de savoir s'il s'agit du vent... ou d'autre chose.",
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        "Vous passez près d'un grand arbre aux racines apparentes. Elles serpentent au sol comme un labyrinthe naturel.",
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        "Vous longez un ruisseau peu profond. L'eau clapote doucement et attire votre attention.",
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        'Vous progressez dans une zone plus sombre. La lumière filtre à peine entre les feuilles épaisses.',
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'Vous atteignez un passage étroit envahi de lianes. Votre avancée devient maladroite et imprévisible.',
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        "Vous débouchez dans un espace plus ouvert. L'air circule mieux, et vous respirez plus librement.",
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        "Le sol devient irrégulier. Racines et pierres transforment chaque pas en jeu d'équilibre.",
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        'Vous traversez une zone marécageuse. Chaque mouvement demande prudence et patience.',
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        'Vous suivez une légère montée. Vos muscles travaillent, mais la progression est satisfaisante.',
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'Vous marquez une courte pause sur un terrain stable. Les sons de la jungle vous entourent.',
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        "Vous redescendez vers une zone plus humide. L'atmosphère devient lourde et collante.",
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'Vous avancez sur un chemin bordé de grandes feuilles. Elles frôlent vos bras à chaque pas.',
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        'Vous traversez une clairière balayée par une brise plus fraîche. Le contraste est agréable.',
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'La végétation devient très dense. Le sol disparaît presque sous les plantes.',
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        "Un tronc tombé barre le chemin. Vous devez ralentir et contourner l'obstacle.",
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        "Vous marchez sur une terre plus sèche. L'ambiance change subtilement autour de vous.",
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'Les sons semblent amplifiés, comme si la jungle réagissait à chacun de vos mouvements.',
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        "Le sentier devient sinueux et instable. Votre progression est mise à l'épreuve.",
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'Le sol est tapissé de feuilles mortes. Elles craquent sous vos pieds de façon imprévisible.',
    },
    {
      type: 'neutral',
      label: 'Case Neutre (verte)',
      description:
        'Le passage se resserre. La végétation se fait plus pressante, presque oppressante.',
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        "Le chemin s'éclaircit soudain. Vous vous sentez encouragé à continuer.",
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        "L'atmosphère change. Vous sentez que vous approchez d'un lieu important, mais la jungle résiste encore.",
    },
    {
      type: 'animal',
      label: 'Case Animal rigolo (rouge)',
      description:
        'Le terrain devient stable et dégagé. Votre progression est fluide et assurée.',
    },
    {
      type: 'patte',
      label: 'Case Coup de patte (jaune)',
      description:
        'Vous traversez une dernière zone dense. La jungle semble tester votre détermination une ultime fois.',
    },
    {
      type: 'finish',
      label: 'Case Neutre - Arrivée (verte)',
      description:
        "Vous atteignez enfin la mare au coeur de la jungle. L'eau est calme, l'air plus frais, et le sentier s'arrête ici. Votre aventure prend fin.",
    },
  ];
}

function defaultAnimalDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    {
      id: 1,
      deck: 'animal',
      text: "Vous entendez soudain le rire strident d'une hyène tout près de vous. Surpris, vous trébuchez, tombez au sol et effectuez un roulé-boulé incontrôlé qui vous propulse plus loin sur le chemin. Avancez de deux cases.",
      moveDelta: 2,
    },
    {
      id: 2,
      deck: 'animal',
      text: "Vous surprenez un hippopotame en train de bâiller largement dans l'eau. Effrayé par sa gueule immense, vous reculez d'une case avant de retrouver votre équilibre en riant.",
      moveDelta: -1,
    },
    {
      id: 3,
      deck: 'animal',
      text: 'Vous voyez un impala sauter agilement devant vous. Vous décidez de le suivre et avancez de 3 cases.',
      moveDelta: 3,
    },
    {
      id: 4,
      deck: 'animal',
      text: 'Vous apercevez un suricate se redresser curieusement. Relancez le dé.',
      reroll: true,
    },
    {
      id: 5,
      deck: 'animal',
      text: "Vous observez un flamant rose glisser avec grâce à la surface de l'eau. Fasciné par sa démarche élégante, vous restez un instant figé à le contempler. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 6,
      deck: 'animal',
      text: "Vous entendez le cri joyeux d'un guépard. Avancez de 1 case.",
      moveDelta: 1,
    },
    {
      id: 7,
      deck: 'animal',
      text: "Vous surprenez un buffle en train de se secouer après s'être roulé dans la boue. Ce spectacle vous amuse et vous fait avancer d'une case.",
      moveDelta: 1,
    },
    {
      id: 8,
      deck: 'animal',
      text: 'Vous marchez silencieusement comme un serpent dans la savane. Avancez de 2 cases.',
      moveDelta: 2,
    },
    {
      id: 9,
      deck: 'animal',
      text: "Vous apercevez un calao majestueux battre des ailes au-dessus de vous. Le souffle de son vol vous pousse légèrement : avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 10,
      deck: 'animal',
      text: 'Vous êtes surpris par un babouin facétieux faisant tomber un régime de bananes sur votre tête. Étourdi, vous passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 11,
      deck: 'animal',
      text: "Vous entendez le chant joyeux d'un tisserin aux couleurs vives perché dans un arbre. Son rythme farfelu vous fait battre des mains et taper des pieds : avancez de 2 cases.",
      moveDelta: 2,
    },
    {
      id: 12,
      deck: 'animal',
      text: 'Vous improvisez une mélodie avec des branches, des feuilles et des fruits tombés autour de vous. La musique de la jungle vous emporte, et sans vous en rendre compte, vous avancez de 3 cases.',
      moveDelta: 3,
    },
    {
      id: 13,
      deck: 'animal',
      text: "Vous voyez un phacochère tournoyer sur lui-même dans un élan de folie. Vous rigolez tellement que vous avancez d'une case en suivant son rythme.",
      moveDelta: 1,
    },
    {
      id: 14,
      deck: 'animal',
      text: "Vous surprenez un gecko en train de taper du pied sur une feuille. L'effet est si drôle que vous avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 15,
      deck: 'animal',
      text: "Vous observez un petit pangolin qui se tortille en rythme sur le chemin. Cela vous amuse tellement que vous avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 16,
      deck: 'animal',
      text: "Vous comptabilisez les pas d'un grand marabout. Avancez de 2 cases.",
      moveDelta: 2,
    },
    {
      id: 17,
      deck: 'animal',
      text: "Vous poursuivez une grenouille géante de nénuphar en nénuphar. À chaque saut, vous glissez, tournez en rond et finissez par reculer d'une case avant de rebondir aussitôt en avant d'une case, en éclatant de rire.",
    },
    {
      id: 18,
      deck: 'animal',
      text: "Vous apercevez une petite mangouste curieuse sur votre chemin. En essayant de l'éviter, vous bondissez maladroitement et atterrissez avec un petit plouf sur une racine. Avancez de 1 case en riant de vous-même.",
      moveDelta: 1,
    },
    {
      id: 19,
      deck: 'animal',
      text: 'Un rhinocéros passe juste à côté de vous. Vous grimpez sur son dos et, émerveillé, vous avancez de trois cases.',
      moveDelta: 3,
    },
    {
      id: 20,
      deck: 'animal',
      text: 'Vous tentez de grimper à un arbre pour observer la savane, mais vous vous retrouvez coincé dans les branches, les pieds dans le vide ! Vous passez votre tour bêtement.',
      skipTurns: 1,
    },
  ];
  return deck;
}

function defaultPatteDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    {
      id: 1,
      deck: 'patte',
      text: 'Vous croisez une civette endormie en travers du chemin. Surpris, vous restez immobile pour ne pas la réveiller. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 2,
      deck: 'patte',
      text: "Une pluie tropicale tombe soudainement. Vous vous faites éclabousser et glissez un peu. Reculez d'une case.",
      moveDelta: -1,
    },
    {
      id: 3,
      deck: 'patte',
      text: "Le vent fait tomber un nid d'aigles serpentier juste devant vous. Vous restez bouche bée à observer les petits oisillons s'agiter dans le nid. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 4,
      deck: 'patte',
      text: "Un jeune scorpion forestier bloque votre chemin et s'amuse à faire des pirouettes, sa queue tourbillonnant dans les airs. Vous sursautez en riant et reculez d'une case.",
      moveDelta: -1,
    },
    {
      id: 5,
      deck: 'patte',
      text: "Un très jeune fourmilier curieux s'approche de vous et renifle vos bottes comme un petit enfant intrigué. Amusé, il se jette au sol et se roule à vos pieds. Éclatant de rire, vous restez bloqué un instant et ne bougez pas de votre case. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 6,
      deck: 'patte',
      text: 'Vous vous reposez sous un baobab pour reprendre des forces. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 7,
      deck: 'patte',
      text: 'Vous vous arrêtez sous un manguier où un loriquet farceur vous pique votre casquette. Passez votre tour pour la récupérer.',
      skipTurns: 1,
    },
    {
      id: 8,
      deck: 'patte',
      text: 'Vous glissez sur des feuilles de bananier humides tombées au sol. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 9,
      deck: 'patte',
      text: 'Votre parcours est interrompu par un caméléon changeant de couleur juste devant vous. Vous restez ébahi. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 10,
      deck: 'patte',
      text: "Un perroquet gris du Gabon se met à grimper le long d'un tronc et tombe juste à côté de vous. Vous sursautez et reculez d'une case.",
      moveDelta: -1,
    },
  ];
  return deck;
}

function buildShuffleMeta(
  seedMeta: unknown,
): Record<string, unknown> & { rng: { seed: number; counter: number } } {
  const meta = asRecord(seedMeta);
  const baseRng = ensureSeededRng(meta);
  const runId = Number(meta.roomRunId ?? 0);
  const generatedAt = toText(meta.generatedAt);
  const salt =
    Number.isFinite(runId) && runId !== 0
      ? runId
      : generatedAt
        ? hashSeed(generatedAt)
        : 0;
  const seed = (baseRng.seed + (salt >>> 0)) >>> 0;
  return { ...meta, rng: { seed, counter: baseRng.counter } };
}

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
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
