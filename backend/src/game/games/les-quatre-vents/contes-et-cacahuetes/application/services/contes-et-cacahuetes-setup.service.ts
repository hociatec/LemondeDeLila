import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import { getSafePlayers } from '../../../../../application/helpers/setup-service.helper';
import { GameCoreService } from '../../../../../application/services/game-core.service';
import { RandomService } from '../../../../../application/services/random.service';
import { SetupFlowService } from '../../../../../application/services/setup-flow.service';
import { fixMojibakeDeep } from '../../../../../../common/utils/mojibake';
import { queueConfiguredPawnSelection } from '../../../../../application/helpers/configured-pawn-setup.helper';
import type {
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesCard,
} from '../../model/contes-et-cacahuetes-state.model';
import { CONTES_PAWNS } from '../../model/contes-et-cacahuetes-pawns.data';

type ContesRuntimeMetadata = ContesCacahuetesMetadata & Record<string, unknown>;
export class ContesCacahuetesSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = getSafePlayers(baseState);
    const pawns = buildSharedPawns();
    const updatedPlayers = players.map((p) => ({
      ...p,
      pawn: toText(p.pawn).trim(),
    }));
    const positions: Record<number, number> = {};
    for (const p of updatedPlayers) positions[p.id] = 0;
    const seedMeta = this.getRuntimeMeta(baseState);
    const starterPick =
      updatedPlayers.length > 0
        ? this.random.nextInt(seedMeta, updatedPlayers.length)
        : { value: 0, meta: seedMeta };
    const setupStarterId =
      updatedPlayers.length > 0
        ? (updatedPlayers[
            Math.max(0, Math.min(updatedPlayers.length - 1, starterPick.value))
          ]?.id ?? null)
        : null;

    const shuffledDecks = this.shuffleDecks(starterPick.meta, buildDecks());

    const metaBase: ContesCacahuetesMetadata = {
      pawns,
      tiles: buildNarratedCanonicalTiles(),
      positions,
      setupStarterId,
      decks: shuffledDecks.decks,
      statuses: {
        skipTurn: {},
        rerollToken: {},
        shieldMalus: {},
        protectNextMalus: {},
        ignoreNextConteAndAdvance: {},
        replaceOneOn1By4: {},
        noBonusCardsTurns: {},
        forcedRollOneTurns: {},
        reverseNextTurn: {},
        blockedUntilPassed: {},
        turnSwapWith: {},
        turnSwapRemaining: {},
        turnSwapPlayingSlot: {},
        keyOfGold: {},
      },
      winnerId: null,
    };
    const next: GameStateEntity = {
      ...baseState,
      players: updatedPlayers,
      phase: 'playing',
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: setupStarterId,
        direction: 1,
      },
      metadata: {
        ...(baseState.metadata ?? {}),
        ...shuffledDecks.meta,
        ...metaBase,
      },
    };
    return fixMojibakeDeep(
      queueConfiguredPawnSelection({
        state: next,
        core: this.core,
        setupFlow: this.setupFlow,
        catalog: pawns.map((pawn) => ({
          id: pawn.id,
          label: pawn.label,
          description: pawn.description,
        })),
        startPlayerId: setupStarterId,
        pendingType: 'choose_pawn',
        playerPawnField: 'pawn',
        choiceLabelBuilder: (pawn) =>
          toText(pawn.description).trim().length > 0
            ? `${toText(pawn.label).trim()}: ${toText(pawn.description).trim()}`
            : toText(pawn.label).trim(),
        pawnDataMapper: (choice) => ({
          id: toText(choice.id).trim(),
          label: toText(choice.label).trim(),
          description: toText(choice.description).trim(),
        }),
      }),
    );
  }

  private getRuntimeMeta(state: GameStateEntity): ContesRuntimeMetadata {
    return (state.metadata ?? {}) as ContesRuntimeMetadata;
  }

  private shuffleDecks(
    meta: ContesRuntimeMetadata,
    decks: ContesCacahuetesMetadata['decks'],
  ): {
    meta: ContesRuntimeMetadata;
    decks: ContesCacahuetesMetadata['decks'];
  } {
    let nextMeta = meta;
    const bonus = this.random.shuffle(nextMeta, decks.bonus);
    nextMeta = bonus.meta;
    const malus = this.random.shuffle(nextMeta, decks.malus);
    nextMeta = malus.meta;
    const surprise = this.random.shuffle(nextMeta, decks.surprise);
    nextMeta = surprise.meta;
    const contes = this.random.shuffle(nextMeta, decks.contes);
    nextMeta = contes.meta;

    return {
      meta: nextMeta,
      decks: {
        ...decks,
        bonus: bonus.values,
        malus: malus.values,
        surprise: surprise.values,
        contes: contes.values,
      },
    };
  }
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function buildSharedPawns(): Array<{
  id: string;
  label: string;
  description: string;
}> {
  return CONTES_PAWNS.map((pawn) => ({ ...pawn }));
}

function buildCanonicalTiles(): ContesCacahuetesTile[] {
  const conteTitles = [
    'Case Conte - Japon : MomotarÅ',
    'Case Conte - SÃ©nÃ©gal : Le liÃ¨vre et la hyÃ¨ne',
    'Case Conte - Russie : Vassilissa la trÃ¨s belle',
    "Case Conte - Canada : L'ours gÃ©ant et l'enfant",
    'Case Conte - Maroc : Le figuier magique',
    'Case Conte - Chine : La princesse Ã©ventail',
    'Case Conte - Irlande : Le gÃ©ant Fionn et Benandonner',
    'Case Conte - PÃ©rou : Le colibri courageux',
    'Case Conte - Ã‰gypte : Le secret du Nil',
    'Case Conte - Australie : Tiddalik, la grenouille',
    "Case Conte - Allemagne : Le joueur de flÃ»te d'Hamelin",
    'Case Conte - Inde : Le prince au cobra',
    "Case Conte - Groenland : L'ourse et la chasseuse",
    "Case Conte - Italie : GiufÃ  et l'Ã¢ne",
    'Case Conte - Kenya : Le feu volant',
    'Case Conte - Chili : La lune et le renard',
    'Case Conte - France : Le Petit Poucet',
    'Case Conte - CorÃ©e du Sud : La grue reconnaissante',
    'Case Conte - BrÃ©sil : La tortue et le jaguar',
    'Case Conte - Iran : Le tapis volant',
    'Case Conte - ThaÃ¯lande : La mangue du roi',
    'Case Conte - Angleterre : Jack et le haricot magique',
    "Case Conte - Vietnam : L'enfant des riziÃ¨res",
    'Case Conte - Espagne : Le tambour enchantÃ©',
    'Case Conte - HaÃ¯ti : Ti-Jean et le diable',
    "Case Conte - Turquie : Nasreddine et l'Ã¢ne",
    'Case Conte - Nouvelle-ZÃ©lande : Maui ralentit le soleil',
    "Case Conte - Mali : L'hippopotame et les Ã©toiles",
    'Case Conte - Pologne : Le roi grenouille',
  ];

  const tileKinds = [
    'start',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'surprise',
    'conte',
    'malus',
    'conte',
    'bonus',
    'conte',
    'malus',
    'conte',
    'finish',
  ] as const;

  let conteIndex = 0;
  return tileKinds.map((kind, index) => {
    if (kind === 'conte') {
      const label = conteTitles[conteIndex] ?? `Case Conte ${conteIndex + 1}`;
      conteIndex += 1;
      return {
        id: `conte-${index + 1}`,
        type: 'conte',
        label,
      } as ContesCacahuetesTile;
    }

    const label =
      kind === 'start'
        ? 'Case DÃ©part'
        : kind === 'finish'
          ? 'Case ArrivÃ©e'
          : kind === 'bonus'
            ? 'Case Bonus'
            : kind === 'malus'
              ? 'Case Malus'
              : 'Case Surprise';

    return {
      id: `${kind}-${index + 1}`,
      type: kind,
      label,
    } as ContesCacahuetesTile;
  });
}

function buildNarratedCanonicalTiles(): ContesCacahuetesTile[] {
  const base = buildCanonicalTiles();
  const conteDescriptions = buildDecks().contes.map((card) => card.text);
  const descriptions = [
    "Vous ouvrez le grand livre des contes, et un vent de magie emporte vos feuilles volantesâ€¦ Chaque pas vous rapproche d'histoires fantastiques, de surprises et de rires Ã  profusion. L'aventure commence maintenant !",
    'Un coup de pouce magique ! La chance vous sourit, profitez-en.',
    null,
    'Le conte rÃ©serve toujours des rebondissements.',
    null,
    'Oupsâ€¦ le conte vous joue un vilain tour.',
    null,
    'Une bonne fÃ©e passait par lÃ â€¦ et elle Ã©tait de bonne humeur !',
    null,
    "Personne ne s'y attendaitâ€¦ pas mÃªme vous !",
    null,
    'Tout ne se passe pas comme prÃ©vu dans les histoiresâ€¦',
    null,
    'Le vent tourne en votre faveur, avancez avec le sourire.',
    null,
    'Un Ã©vÃ©nement Ã©trange surgit de nulle part.',
    null,
    'Une pÃ©ripÃ©tie inattendue freine votre avancÃ©e.',
    null,
    'Une histoire bien racontÃ©e porte toujours chance.',
    null,
    'Tout peut arriver quand on tourne la page.',
    null,
    'MÃªme les hÃ©ros trÃ©buchent parfois.',
    null,
    'Vous trouvez un trÃ¨fleâ€¦ Ã  quatre feuilles, Ã©videmment !',
    null,
    'Le hasard adore se mÃªler aux histoires.',
    null,
    "Le sort s'emmÃªleâ€¦ et vous avec.",
    null,
    'Le conte vous applaudit. Ã€ vous la rÃ©compense !',
    null,
    'Une surprise se cache entre les lignes.',
    null,
    'Le conte prend un tournant un peu grinÃ§ant.',
    null,
    'Les esprits du rÃ©cit vous encouragent chaleureusement.',
    null,
    'Le conte vous observeâ€¦ et agit !',
    null,
    'Une mauvaise surprise surgit entre deux pages.',
    null,
    'Un hÃ©ros bien prÃ©parÃ© mÃ©rite toujours un avantage.',
    null,
    "Rien n'est jamais figÃ© dans un bon rÃ©cit.",
    null,
    'Les chemins des lÃ©gendes ne sont pas toujours droits.',
    null,
    "La chance vous fait un clin d'oeil malicieux.",
    null,
    'Une surprise tombe pile au bon, ou, mauvais moment.',
    null,
    'Le destin vous testeâ€¦ courage !',
    null,
    'Un moment de gloireâ€¦ savourez-le !',
    null,
    'MÃªme Ã  la fin, le conte aime faire durer le suspense.',
    null,
    "Vous atteignez le majestueux livre magique, ses pages scintillent et s'animent autour de vous... Les contes du monde entier vous saluent et vous couronnent MaÃ®tre ou MaÃ®tresse des histoires, hÃ©ros de cette aventure mÃ©morable !",
  ];
  let conteIndex = 0;

  return base.map((tile, index) => {
    const description =
      tile.type === 'conte'
        ? (conteDescriptions[conteIndex++] ?? '')
        : (descriptions[index] ?? '');
    if (!description) return tile;
    return {
      ...tile,
      description,
    };
  });
}

function buildDecks(): ContesCacahuetesMetadata['decks'] {
  const bonus: ContesCard[] = [
    {
      id: 1,
      type: 'bonus',
      title: `Bottes de sept lieues`,
      text: `Avancez de 2 cases supplÃƒÆ’Ã‚Â©mentaires. Ces bottes magiques vous font bondir loin devant !`,
    },
    {
      id: 2,
      type: 'bonus',
      title: `Parchemin EnchantÃƒÆ’Ã‚Â©`,
      text: `Si le rÃƒÆ’Ã‚Â©sultat ne vous plaÃƒÆ’Ã‚Â®t pas, vous pouvez relancer qu'une seule fois le dÃƒÆ’Ã‚Â©. Le vieux grimoire vous montre une autre possibilitÃƒÆ’Ã‚Â©.`,
    },
    {
      id: 3,
      type: 'bonus',
      title: `Amulette Protectrice`,
      text: `Gardez cette carte dans votre main. Elle vous protÃƒÆ’Ã‚Â¨ge d'un malus (valable une fois). Elle se dÃƒÆ’Ã‚Â©fausse aprÃƒÆ’Ã‚Â¨s usage.`,
    },
    {
      id: 4,
      type: 'bonus',
      title: `Cape d'InvisibilitÃƒÆ’Ã‚Â©`,
      text: `Si vous arrivez sur une case Malus, son effet est automatiquement ignorÃƒÆ’Ã‚Â© et vous avancez d'une case supplÃƒÆ’Ã‚Â©mentaire.`,
    },
    {
      id: 5,
      type: 'bonus',
      title: `PoussiÃƒÆ’Ã‚Â¨re de FÃƒÆ’Ã‚Â©e`,
      text: `Vous pouvez faire avancer un autre joueur de votre choix de 2 cases. Un geste d'amitiÃƒÆ’Ã‚Â© qui crÃƒÆ’Ã‚Â©e la magie.`,
    },
    {
      id: 6,
      type: 'bonus',
      title: `Haricot Magique`,
      text: `Un haricot magique vous propulse dans les airs ! Lancez le dÃƒÆ’Ã‚Â© maintenant : le rÃƒÆ’Ã‚Â©sultat obtenu est automatiquement doublÃƒÆ’Ã‚Â©.`,
    },
    {
      id: 7,
      type: 'bonus',
      title: `ClÃƒÆ’Ã‚Â© d'Or Universelle`,
      text: `Si vous tombez sur une case Conte, choisissez l'effet (bonus ou malus) pour un autre joueur de votre choix. La clÃƒÆ’Ã‚Â© vous donne le pouvoir de dÃƒÆ’Ã‚Â©cider.`,
    },
    {
      id: 8,
      type: 'bonus',
      title: `Ami LÃƒÆ’Ã‚Â©gendaire`,
      text: `Vous ÃƒÆ’Ã‚Âªtes aidÃƒÆ’Ã‚Â© par un personnage magique ! Avancez de 3 cases.`,
    },
    {
      id: 9,
      type: 'bonus',
      title: `Pont Arc-en-ciel`,
      text: `Un pont magique apparaÃƒÆ’Ã‚Â®t ! Piochez une carte Bonus puis une carte Surprise, et appliquez leurs effets.`,
    },
    {
      id: 10,
      type: 'bonus',
      title: `Formule Magique`,
      text: `Choisissez un joueur et ÃƒÆ’Ã‚Â©changez votre prochain tour avec le sien (vous avancez ÃƒÆ’Ã‚  sa place, et inversement). Surprise garantie !`,
    },
    {
      id: 11,
      type: 'bonus',
      title: `FlÃƒÆ’Ã‚Â»te EnchantÃƒÆ’Ã‚Â©e`,
      text: `Tous les autres joueurs vous applaudissent : pendant leur prochain tour, ils avancent de 1 case seulement, mÃƒÆ’Ã‚Âªme avec un grand dÃƒÆ’Ã‚Â©.`,
    },
    {
      id: 12,
      type: 'bonus',
      title: `Corne d'Abondance`,
      text: `Piocher deux cartes Bonus mais gardez-en qu'une, la plus avantageuse. Un coup de chance rare !`,
    },
    {
      id: 13,
      type: 'bonus',
      title: `Monture Mystique`,
      text: `Un animal lÃƒÆ’Ã‚Â©gendaire vous emmÃƒÆ’Ã‚Â¨ne loin. Avancez de 5 cases, mais passez un tour au prochain lancÃƒÆ’Ã‚Â© de dÃƒÆ’Ã‚Â©.`,
    },
    {
      id: 14,
      type: 'bonus',
      title: `Feuille Magique`,
      text: `Gardez cette carte dans votre main : la prochaine fois que vous faites 1 au dÃƒÆ’Ã‚Â©, avancer de 4 cases ÃƒÆ’Ã‚  la place. Comme un coup de vent !`,
    },
    {
      id: 15,
      type: 'bonus',
      title: `Lanterne Lumineuse`,
      text: `La lanterne vous guide. Reculez de deux cases puis avancez de trois.`,
    },
  ];

  const malus: ContesCard[] = [
    {
      id: 1,
      type: 'malus',
      title: `SortilÃƒÆ’Ã‚Â¨ge de Sommeil`,
      text: `Vous vous endormez comme la Belle au bois dormant. Passez un tour.`,
    },
    {
      id: 2,
      type: 'malus',
      title: `Ronce EnchevÃƒÆ’Ã‚ÂªtrÃƒÆ’Ã‚Â©e`,
      text: `Vous ÃƒÆ’Ã‚Âªtes coincÃƒÆ’Ã‚Â© dans une forÃƒÆ’Ã‚Âªt de ronces... Reculez de 2 cases.`,
    },
    {
      id: 3,
      type: 'malus',
      title: `Grimoire Capricieux`,
      text: `Vous lisez une formule ÃƒÆ’Ã‚  l'envers : ÃƒÆ’Ã‚Â©changez votre place avec le joueur le plus proche derriÃƒÆ’Ã‚Â¨re vous !`,
    },
    {
      id: 4,
      type: 'malus',
      title: `Pluie de Mots OubliÃƒÆ’Ã‚Â©s`,
      text: `Vous oubliez un passage de votre histoire. Lancez le dÃƒÆ’Ã‚Â© et avancez seulement de la moitiÃƒÆ’Ã‚Â© du chiffre obtenu.`,
    },
    {
      id: 5,
      type: 'malus',
      title: `Loup dans la ForÃƒÆ’Ã‚Âªt`,
      text: `Un grand mÃƒÆ’Ã‚Â©chant loup surgit ! Vous devez attendre qu'un autre joueur atteigne ou dÃƒÆ’Ã‚Â©passe votre case pour pouvoir rejouer.`,
    },
    {
      id: 6,
      type: 'malus',
      title: `Sable Mouvant Magique`,
      text: `Vous vous enfoncez dans une ÃƒÆ’Ã‚Â©trange plage mouvante. Passez deux tours.`,
    },
    {
      id: 7,
      type: 'malus',
      title: `Page Manquante`,
      text: `Oh non ! Votre conte est incomplet. Vous devez retirer une carte Malus et subir son effet.`,
    },
    {
      id: 8,
      type: 'malus',
      title: `Confusion de Contes`,
      text: `Les histoires s'emmÃƒÆ’Ã‚Âªlent ! Avancez de 3 cases... puis reculez de 4. Zut, ce n'ÃƒÆ’Ã‚Â©tait pas dans cet ordre-lÃƒÆ’Ã‚  !`,
    },
    {
      id: 9,
      type: 'malus',
      title: `Maladresse de Sorcier`,
      text: `Vous cassez votre baguette magique. Piochez une carte Bonus puis donnez-la ÃƒÆ’Ã‚  un autre joueur de votre choix.`,
    },
    {
      id: 10,
      type: 'malus',
      title: `Ombre Farceuse`,
      text: `Une crÃƒÆ’Ã‚Â©ature invisible vous embÃƒÆ’Ã‚Âªte... Relancez votre dÃƒÆ’Ã‚Â©, mais cette fois, reculez au lieu d'avancer.`,
    },
    {
      id: 11,
      type: 'malus',
      title: `ÃƒÆ’Ã¢â‚¬Â°nigme Infernale`,
      text: `Vous ÃƒÆ’Ã‚Âªtes bloquÃƒÆ’Ã‚Â© par un sphinx rusÃƒÆ’Ã‚Â© ! Pour continuer, lancez le dÃƒÆ’Ã‚Â© : si vous obtenez un 4 ou plus, avancez normalement. Sinon, passez un tour.`,
    },
    {
      id: 12,
      type: 'malus',
      title: `Passage Obscur`,
      text: `Vous entrez dans un tunnel sombre. Retournez ÃƒÆ’Ã‚  la case Malus prÃƒÆ’Ã‚Â©cÃƒÆ’Ã‚Â©dente et revivez son effet.`,
    },
    {
      id: 13,
      type: 'malus',
      title: `Chaussures EnchantÃƒÆ’Ã‚Â©es... mais trop petites`,
      text: `Reculez de deux cases pour changer de chaussures. AÃƒÆ’Ã‚Â¯e !`,
    },
    {
      id: 14,
      type: 'malus',
      title: `Miroir BrisÃƒÆ’Ã‚Â©`,
      text: `Un miroir magique vous renvoie ÃƒÆ’Ã‚  votre passÃƒÆ’Ã‚Â©. Retournez ÃƒÆ’Ã‚  la case dÃƒÆ’Ã‚Â©part.`,
    },
    {
      id: 15,
      type: 'malus',
      title: `Grimoire Grincheux`,
      text: `Vous ne pouvez plus jouer de carte Bonus durant deux tours.`,
    },
  ];

  const surprise: ContesCard[] = [
    {
      id: 1,
      type: 'surprise',
      title: `Baguette Malicieuse`,
      text: `Une baguette magique s'agite toute seule ! Avancez d'une case... puis reculez de deux.`,
    },
    {
      id: 2,
      type: 'surprise',
      title: `Voyage en Tapis Volant`,
      text: `Quelle chance ! Vous vous laissez porter par un tapis magique et avancez de quatre cases.`,
    },
    {
      id: 3,
      type: 'surprise',
      title: `Rencontre Inattendue`,
      text: `Un personnage cÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â¨bre d'un autre conte apparaÃƒÆ’Ã‚Â®t ! Piochez une carte Bonus.`,
    },
    {
      id: 4,
      type: 'surprise',
      title: `Coffre aux Merveilles`,
      text: `Vous ouvrez un vieux coffre enchantÃƒÆ’Ã‚Â©. Tirez deux cartes au hasard (Bonus, Malus ou Surprise) et appliquez-les toutes les deux.`,
    },
    {
      id: 5,
      type: 'surprise',
      title: `PoussiÃƒÆ’Ã‚Â¨re de Rire`,
      text: `Un nuage de poussiÃƒÆ’Ã‚Â¨re de rire se rÃƒÆ’Ã‚Â©pand ! Chaque joueur lance un petit dÃƒÆ’Ã‚Â© de 1 ÃƒÆ’Ã‚  3. Celui qui a le plus grand avance d'une case. Remarque : s'il y a Ã©galitÃ© au chiffre trois, ils avancent ensemble.`,
    },
    {
      id: 6,
      type: 'surprise',
      title: `TempÃƒÆ’Ã‚Âªte de Pages`,
      text: `Un vent magique emporte les histoires ! Choisissez un autre joueur et ÃƒÆ’Ã‚Â©changez vos positions sur le plateau.`,
    },
    {
      id: 7,
      type: 'surprise',
      title: `Carte Invisible`,
      text: `Passez votre tour.`,
    },
    {
      id: 8,
      type: 'surprise',
      title: `Livre ÃƒÆ’Ã‚  l'Envers`,
      text: `Vous lisez une histoire ÃƒÆ’Ã‚  l'envers. Votre prochain tour se fait en reculant.`,
    },
    {
      id: 9,
      type: 'surprise',
      title: `Chanson EnchantÃƒÆ’Ã‚Â©e`,
      text: `Une mÃƒÆ’Ã‚Â©lodie magique rÃƒÆ’Ã‚Â©sonne ! Choisissez : avancer de 3 cases ou prendre une carte Bonus ÃƒÆ’Ã‚  un autre joueur.`,
    },
    {
      id: 10,
      type: 'surprise',
      title: `Dragon de Papier`,
      text: `Un mini-dragon apparaÃƒÆ’Ã‚Â®t dans votre livre ! Il vous protÃƒÆ’Ã‚Â¨ge automatiquement de la prochaine carte Malus.`,
    },
    {
      id: 11,
      type: 'surprise',
      title: `Conte Perdu`,
      text: `Vous dÃƒÆ’Ã‚Â©couvrez un conte inconnu. Piochez une nouvelle carte Conte, mÃƒÆ’Ã‚Âªme si vous ÃƒÆ’Ã‚Âªtes sur une case spÃƒÆ’Ã‚Â©ciale.`,
    },
    {
      id: 12,
      type: 'surprise',
      title: `Montre EnchantÃƒÆ’Ã‚Â©e`,
      text: `Relancez le dÃƒÆ’Ã‚Â©, puis reculez du nombre obtenu.`,
    },
    {
      id: 13,
      type: 'surprise',
      title: `Souhait ÃƒÆ’Ã¢â‚¬Â°phÃƒÆ’Ã‚Â©mÃƒÆ’Ã‚Â¨re`,
      text: `Faites un vÃƒâ€¦Ã¢â‚¬Å“u simple : avancer de 2 cases, ÃƒÆ’Ã‚Â©changer votre pion avec un autre joueur, ou tirer une carte Bonus (ÃƒÆ’Ã‚  vous de choisir).`,
    },
    {
      id: 14,
      type: 'surprise',
      title: `Filet Magique`,
      text: `Vous attrapez une carte Bonus ou Surprise d'un autre joueur de votre choix.`,
    },
    {
      id: 15,
      type: 'surprise',
      title: `Grimoire Voyageur`,
      text: `Vous lisez un conte venu d'ailleurs. ÃƒÆ’Ã¢â‚¬Â°changez votre place avec un autre joueur : vous restez sur place, et lui prend votre position puis avance d'une case.`,
    },
  ];

  const contes: ContesCard[] = [
    {
      id: 1,
      type: 'conte',
      title: `Conte - Japon : MomotarÃƒâ€¦Ã‚Â`,
      text: `Il ÃƒÆ’Ã‚Â©tait une fois, dans un petit village japonais bordÃƒÆ’Ã‚Â© de collines verdoyantes et de riviÃƒÆ’Ã‚Â¨res ÃƒÆ’Ã‚Â©tincelantes, un couple ÃƒÆ’Ã‚Â¢gÃƒÆ’Ã‚Â© qui vivait paisiblement.
Un jour, alors que la vieille dame lavait des vÃƒÆ’Ã‚Âªtements dans la riviÃƒÆ’Ã‚Â¨re, elle dÃƒÆ’Ã‚Â©couvrit une ÃƒÆ’Ã‚Â©norme pÃƒÆ’Ã‚Âªche flottant sur l'eau. Curieuse, elle la ramena chez elle. ÃƒÆ’Ã‚Â¬ leur grande surprise, en l'ouvrant, ils trouvÃƒÆ’Ã‚Â¨rent un petit garÃƒÆ’Ã‚Â§on robuste et joyeux ÃƒÆ’Ã‚  l'intÃƒÆ’Ã‚Â©rieur. Ils l'appelÃƒÆ’Ã‚Â¨rent MomotarÃƒâ€¦Ã‚Â, le garÃƒÆ’Ã‚Â§on-pÃƒÆ’Ã‚Âªche.
Grandissant avec force et courage, MomotarÃƒâ€¦Ã‚Â apprit qu'au loin, sur une ÃƒÆ’Ã‚Â®le mystÃƒÆ’Ã‚Â©rieuse, des oni (dÃƒÆ’Ã‚Â©mons malicieux) semaient la terreur parmi les habitants. DÃƒÆ’Ã‚Â©terminÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚  protÃƒÆ’Ã‚Â©ger son village, il partit ÃƒÆ’Ã‚  l'aventure, emportant avec lui des kibi dango (des petites boules de millet sucrÃƒÆ’Ã‚Â©es) pour convaincre des compagnons de le suivre.
Sur son chemin, il rencontra un chien fidÃƒÆ’Ã‚Â¨le, un singe polyvalent et un faisan majestueux. Chacun, sÃƒÆ’Ã‚Â©duit par les kibi dango et la dÃƒÆ’Ã‚Â©termination de l'enfant, devint son alliÃƒÆ’Ã‚Â© loyal. Ensemble, ils traversÃƒÆ’Ã‚Â¨rent les eaux tumultueuses et atteignirent l'ÃƒÆ’Ã‚Â®le des oni.
GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  leur courage, leur ruse et la force de l'amitiÃƒÆ’Ã‚Â©, ils vainquirent les dÃƒÆ’Ã‚Â©mons, rÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â©rÃƒÆ’Ã‚Â¨rent les trÃƒÆ’Ã‚Â©sors volÃƒÆ’Ã‚Â©s et ramenÃƒÆ’Ã‚Â¨rent la paix dans le village. MomotarÃƒâ€¦Ã‚Â, hÃƒÆ’Ã‚Â©ros humble et courageux, reÃƒÆ’Ã‚Â§ut la gratitude ÃƒÆ’Ã‚Â©ternelle de son peuple, et son histoire continua de se raconter au fil des gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©rations.`,
    },
    {
      id: 2,
      type: 'conte',
      title: `Conte - SÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©gal : Le liÃƒÆ’Ã‚Â¨vre et l'hyÃƒÆ’Ã‚Â¨ne`,
      text: `Dans les vastes savanes du SÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©gal, oÃƒÆ’Ã‚Â¹ les baobabs se dressent comme des gÃƒÆ’Ã‚Â©ants silencieux et oÃƒÆ’Ã‚Â¹ le soleil ÃƒÆ’Ã‚Â©claire la terre d'un ÃƒÆ’Ã‚Â©clat dorÃƒÆ’Ã‚Â©, vivait un liÃƒÆ’Ã‚Â¨vre malin et rusÃƒÆ’Ã‚Â©, connu pour ses tours et ses farces. Non loin de lÃƒÆ’Ã‚ , la hyÃƒÆ’Ã‚Â¨ne, grande et gourmande, rÃƒÆ’Ã‚Âªvait toujours de le piÃƒÆ’Ã‚Â©ger pour le manger.
Un jour, cette derniÃƒÆ’Ã‚Â¨re dÃƒÆ’Ã‚Â©cida de tendre un piÃƒÆ’Ã‚Â¨ge ingÃƒÆ’Ã‚Â©nieux au liÃƒÆ’Ã‚Â¨vre. Mais le petit animal, vif comme le vent sur la savane, devina la ruse. Avec son esprit rapide et ses pattes lÃƒÆ’Ã‚Â©gÃƒÆ’Ã‚Â¨res, il imagina un plan astucieux.
Il laissa derriÃƒÆ’Ã‚Â¨re lui des empreintes trompeuses, fit semblant de tomber dans un piÃƒÆ’Ã‚Â¨ge et conduisit la hyÃƒÆ’Ã‚Â¨ne ÃƒÆ’Ã‚  se coincer elle-mÃƒÆ’Ã‚Âªme dans un buisson ÃƒÆ’Ã‚Â©pineux. Chaque farce ÃƒÆ’Ã‚Â©tait plus drÃƒÆ’Ã‚Â´le et surprenante que la prÃƒÆ’Ã‚Â©cÃƒÆ’Ã‚Â©dente, et bientÃƒÆ’Ã‚Â´t, mÃƒÆ’Ã‚Âªme les autres animaux de la savane venaient applaudir les tours de ce dernier.
Mais le liÃƒÆ’Ã‚Â¨vre n'ÃƒÆ’Ã‚Â©tait pas cruel. Avec un sourire malicieux, il libÃƒÆ’Ã‚Â©ra la hyÃƒÆ’Ã‚Â¨ne, lui montrant que l'intelligence et la ruse pouvaient ÃƒÆ’Ã‚Âªtre plus fortes que la force brute.
Et depuis ce jour, tous les habitants de la savane racontent encore les exploits de la crÃƒÆ’Ã‚Â©ature ÃƒÆ’Ã‚  grandes oreilles, hÃƒÆ’Ã‚Â©ros petit mais redoutablement malin.`,
    },
    {
      id: 3,
      type: 'conte',
      title: `Conte - Russie : Vassilissa la trÃƒÆ’Ã‚Â¨s belle`,
      text: `Au coeur des forÃƒÆ’Ã‚Âªts enneigÃƒÆ’Ã‚Â©es de Russie, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ les pins s'ÃƒÆ’Ã‚Â©tiraient vers le ciel et oÃƒÆ’Ã‚Â¹ la neige crissait sous les pas, vivait Vassilissa, une jeune fille d'une beautÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚Â©clatante et d'un coeur pur. Elle portait toujours avec elle une poupÃƒÆ’Ã‚Â©e de chiffon, cadeau de sa mÃƒÆ’Ã‚Â¨re disparue, qui semblait parler et donner des conseils secrets ÃƒÆ’Ã‚  celle qui savait ÃƒÆ’Ã‚Â©couter.
Orpheline, elle vivait avec sa mÃƒÆ’Ã‚Â©chante belle-mÃƒÆ’Ã‚Â¨re et ses deux demi-soeurs jalouses, qui ne cessaient de lui imposer des tÃƒÆ’Ã‚Â¢ches impossibles. Mais la poupÃƒÆ’Ã‚Â©e, animÃƒÆ’Ã‚Â©e d'une magie subtile, guidait Vassilissa et l'aidait ÃƒÆ’Ã‚  accomplir ses corvÃƒÆ’Ã‚Â©es avec habiletÃƒÆ’Ã‚Â© et intelligence.
Un jour, la belle-mÃƒÆ’Ã‚Â¨re, avide de se dÃƒÆ’Ã‚Â©barrasser d'elle, l'envoya chercher du feu chez la redoutable sorciÃƒÆ’Ã‚Â¨re Baba Yaga, cachÃƒÆ’Ã‚Â©e au fond de la forÃƒÆ’Ã‚Âªt. Courageuse mais prudente, Vassilissa suivit les conseils de sa poupÃƒÆ’Ã‚Â©e, traversa ponts instables, riviÃƒÆ’Ã‚Â¨res glacÃƒÆ’Ã‚Â©es et crÃƒÆ’Ã‚Â©atures mystÃƒÆ’Ã‚Â©rieuses, et rÃƒÆ’Ã‚Â©ussit ÃƒÆ’Ã‚  accomplir les tÃƒÆ’Ã‚Â¢ches impossibles que la femme lui imposait.
GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  sa ruse, sa patience et l'aide de la poupÃƒÆ’Ã‚Â©e magique, l'enfant revint saine et sauve, portant le feu comme un triomphe de sa bontÃƒÆ’Ã‚Â© et de son courage.
Depuis ce jour, les contes russes parlent encore de Vassilissa, la jeune fille qui triomphait toujours des ÃƒÆ’Ã‚Â©preuves avec intelligence et coeur pur.`,
    },
    {
      id: 4,
      type: 'conte',
      title: `Conte - Canada : L'ours gÃƒÆ’Ã‚Â©ant et l'enfant`,
      text: `Dans les forÃƒÆ’Ã‚Âªts profondes du Canada, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ les riviÃƒÆ’Ã‚Â¨res scintillaient comme des rubans d'argent et oÃƒÆ’Ã‚Â¹ les montagnes se dressaient majestueusement, vivait un petit enfant curieux et courageux.
Un jour, alors qu'il explorait les bois en suivant le chant des oiseaux, il rencontra un ours gÃƒÆ’Ã‚Â©ant au pelage brun dorÃƒÆ’Ã‚Â©, imposant mais aux yeux d'une douceur surprenante.
L'animal, protecteur de la forÃƒÆ’Ã‚Âªt, ÃƒÆ’Ã‚Â©tait sage et puissant, et il connaissait tous les secrets de la faune et de la flore. Il mit l'enfant ÃƒÆ’Ã‚  l'ÃƒÆ’Ã‚Â©preuve : il dÃƒÆ’Ã‚Â» traverser une riviÃƒÆ’Ã‚Â¨re tumultueuse, escalader une colline escarpÃƒÆ’Ã‚Â©e et comprendre le langage des oiseaux et des arbres. Mais chaque ÃƒÆ’Ã‚Â©preuve ÃƒÆ’Ã‚Â©tait en rÃƒÆ’Ã‚Â©alitÃƒÆ’Ã‚Â© un enseignement sur le courage, la patience et le respect de la nature.
Avec chaque ÃƒÆ’Ã‚Â©tape, le jeune garÃƒÆ’Ã‚Â§on comprit que la force ne rÃƒÆ’Ã‚Â©sidait pas seulement dans la taille ou la puissance, mais dans l'intelligence, l'empathie et le respect de son environnement. L'ours gÃƒÆ’Ã‚Â©ant, impressionnÃƒÆ’Ã‚Â© par son coeur pur et sa dÃƒÆ’Ã‚Â©termination, devint son alliÃƒÆ’Ã‚Â© et compagnon, le guidant ÃƒÆ’Ã‚  travers la forÃƒÆ’Ã‚Âªt et lui transmettant les secrets anciens des crÃƒÆ’Ã‚Â©atures et de la terre.
Depuis ce jour, on raconte au Canada l'histoire de l'enfant qui marcha aux cÃƒÆ’Ã‚Â´tÃƒÆ’Ã‚Â©s de l'ours gÃƒÆ’Ã‚Â©ant, apprenant ÃƒÆ’Ã‚  ÃƒÆ’Ã‚Â©couter, ÃƒÆ’Ã‚  respecter et ÃƒÆ’Ã‚  devenir un vrai ami de la forÃƒÆ’Ã‚Âªt.`,
    },
    {
      id: 5,
      type: 'conte',
      title: `Conte - Maroc : Le figuier magique`,
      text: `Au coeur des ruelles animÃƒÆ’Ã‚Â©es du Maroc, sous un ciel azur oÃƒÆ’Ã‚Â¹ le soleil ÃƒÆ’Ã‚Â©clairait les mosaÃƒÆ’Ã‚Â¯ques colorÃƒÆ’Ã‚Â©es, se trouvait un figuier ancien, immense et mystÃƒÆ’Ã‚Â©rieux, dont les branches semblaient toucher les nuages. On racontait que cet arbre n'ÃƒÆ’Ã‚Â©tait pas ordinaire : ses figues dorÃƒÆ’Ã‚Â©es ÃƒÆ’Ã‚Â©taient enchantÃƒÆ’Ã‚Â©es, capables d'exaucer les souhaits les plus sincÃƒÆ’Ã‚Â¨res.
Un enfant curieux et intrÃƒÆ’Ã‚Â©pide s'approcha un matin, attirÃƒÆ’Ã‚Â© par l'odeur sucrÃƒÆ’Ã‚Â©e des fruits et le bruissement des feuilles. Alors qu'il tendait la main pour cueillir une figue, l'arbre se mit ÃƒÆ’Ã‚  parler dans un murmure doux et rassurant, rÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©lant que seul celui qui possÃƒÆ’Ã‚Â©dait un coeur pur pouvait goÃƒÆ’Ã‚Â»ter ÃƒÆ’Ã‚  sa magie.
Pour prouver sa valeur, il devait faire preuve de courage, de gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©rositÃƒÆ’Ã‚Â© et d'ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â© : partager ses trouvailles avec les habitants du village, aider les animaux de la place et rÃƒÆ’Ã‚Â©soudre des ÃƒÆ’Ã‚Â©nigmes laissÃƒÆ’Ã‚Â©es par les anciens du royaume. ÃƒÆ’Ã‚Â¬ chaque acte de bontÃƒÆ’Ã‚Â©, les figues du figuier brillaient plus fort, et l'enfant sentait une ÃƒÆ’Ã‚Â©nergie chaude et bienveillante parcourir ses doigts.
Finalement, ayant dÃƒÆ’Ã‚Â©montrÃƒÆ’Ã‚Â© sa sagesse et son coeur gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©reux, il put cueillir une figue magique. Cette derniÃƒÆ’Ã‚Â¨re ne donnait pas seulement la chance ou la richesse, mais rÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©lait les secrets pour comprendre et respecter les gens, la nature et la magie qui se cache dans chaque geste quotidien.`,
    },
    {
      id: 6,
      type: 'conte',
      title: `Conte - Chine : La princesse ÃƒÆ’Ã‚Â©ventail`,
      text: `Dans les jardins impÃƒÆ’Ã‚Â©riaux baignÃƒÆ’Ã‚Â©s de brume matinale, oÃƒÆ’Ã‚Â¹ les lotus flottaient sur les bassins et oÃƒÆ’Ã‚Â¹ les pavillons aux toits dorÃƒÆ’Ã‚Â©s reflÃƒÆ’Ã‚Â©taient la lumiÃƒÆ’Ã‚Â¨re du soleil, vivait une princesse renommÃƒÆ’Ã‚Â©e pour sa beautÃƒÆ’Ã‚Â© et sa sagesse. Mais ce qui la distinguait le plus ÃƒÆ’Ã‚Â©tait son ÃƒÆ’Ã‚Â©ventail en soie brodÃƒÆ’Ã‚Â©e d'or et de jade, capable de contrÃƒÆ’Ã‚Â´ler le vent et de murmurer les secrets du ciel.
Un jour, une grande sÃƒÆ’Ã‚Â©cheresse frappa le royaume. Les riviÃƒÆ’Ã‚Â¨res s'assÃƒÆ’Ã‚Â©chÃƒÆ’Ã‚Â¨rent et les arbres perdirent leurs feuilles. La princesse, connue pour son coeur gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©reux et sa dÃƒÆ’Ã‚Â©termination, prit son ÃƒÆ’Ã‚Â©ventail magique et s'avanÃƒÆ’Ã‚Â§a dans le jardin. Chaque mouvement de l'objet faisait danser la brise et onduler les nuages, et bientÃƒÆ’Ã‚Â´t, un vent doux et humide se leva, apportant la pluie salvatrice sur les champs dessÃƒÆ’Ã‚Â©chÃƒÆ’Ã‚Â©s.
Mais la princesse n'utilisait pas sa magie uniquement pour des miracles visibles : elle enseignait aux villageois l'importance de la patience, de la sagesse et du respect pour la nature, leur montrant que chaque geste, mÃƒÆ’Ã‚Âªme petit, pouvait faire naÃƒÆ’Ã‚Â®tre le changement.
GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  elle, les riviÃƒÆ’Ã‚Â¨res reprirent vie, les fleurs s'ÃƒÆ’Ã‚Â©panouirent et les enfants jouaient ÃƒÆ’Ã‚  l'ombre des cerisiers en fleurs, tout en ÃƒÆ’Ã‚Â©coutant les histoires que soufflait le vent de son ÃƒÆ’Ã‚Â©ventail.`,
    },
    {
      id: 7,
      type: 'conte',
      title: `Conte - Irlande : Le gÃƒÆ’Ã‚Â©ant Fionn et Benandonner`,
      text: `Dans les collines verdoyantes et brumeuses d'Irlande, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ les moutons paissaient paisiblement et oÃƒÆ’Ã‚Â¹ le vent portait le parfum de l'herbe fraÃƒÆ’Ã‚Â®che, vivait un jeune gÃƒÆ’Ã‚Â©ant nommÃƒÆ’Ã‚Â© Fionn. Curieux et courageux, il adorait explorer les landes et ÃƒÆ’Ã‚Â©couter les histoires des anciens, apprenant les lÃƒÆ’Ã‚Â©gendes des druides et des guerriers d'antan.
Un matin, il entendit parler d'un gÃƒÆ’Ã‚Â©ant colossal nommÃƒÆ’Ã‚Â© Benandonner, qui vivait de l'autre cÃƒÆ’Ã‚Â´tÃƒÆ’Ã‚Â© de la mer et terrorisait les villages de ses pas gigantesques. DÃƒÆ’Ã‚Â©terminÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚  protÃƒÆ’Ã‚Â©ger son pays et ÃƒÆ’Ã‚  prouver son courage, Fionn dÃƒÆ’Ã‚Â©cida de se rendre ÃƒÆ’Ã‚  la rencontre de ce dernier.
Mais Fionn ÃƒÆ’Ã‚Â©tait malin et rusÃƒÆ’Ã‚Â© : lorsqu'il le croisa, il remarqua que le gÃƒÆ’Ã‚Â©ant ÃƒÆ’Ã‚Â©tait ÃƒÆ’Ã‚Â©norme et redoutable, mais qu'il se moquait de sa propre force lorsqu'il rit de ses erreurs. Fionn usa alors de ruse et d'astuce. Il fit croire ÃƒÆ’Ã‚  Benandonner qu'il ÃƒÆ’Ã‚Â©tait un gÃƒÆ’Ã‚Â©ant encore plus puissant, et par une sÃƒÆ’Ã‚Â©rie de jeux d'ombres et de tromperies, il rÃƒÆ’Ã‚Â©ussit ÃƒÆ’Ã‚  faire fuir la crÃƒÆ’Ã‚Â©ature vers l'autre cÃƒÆ’Ã‚Â´tÃƒÆ’Ã‚Â© de la mer.
Depuis ce jour, Fionn devint le protecteur des collines irlandaises, et les villageois racontent encore comment un jeune gÃƒÆ’Ã‚Â©ant malin avait surpassÃƒÆ’Ã‚Â© un de ses congÃƒÆ’Ã‚Â©naires terrible, transformant la peur en lÃƒÆ’Ã‚Â©gende et le danger en histoire ÃƒÆ’Ã‚  raconter autour du feu.`,
    },
    {
      id: 8,
      type: 'conte',
      title: `Conte - PÃƒÆ’Ã‚Â©rou : Le colibri courageux`,
      text: `Dans les hauteurs vertigineuses des Andes pÃƒÆ’Ã‚Â©ruviennes, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ les sommets effleurent les nuages et oÃƒÆ’Ã‚Â¹ les torrents grondent dans les vallÃƒÆ’Ã‚Â©es, vivait un petit colibri au plumage ÃƒÆ’Ã‚Â©clatant. Bien que minuscule et fragile face aux montagnes imposantes et aux dangers qui rÃƒÆ’Ã‚Â´daient, ce colibri avait un courage qui dÃƒÆ’Ã‚Â©passait sa taille.
Un jour, un incendie ÃƒÆ’Ã‚Â©clata dans la forÃƒÆ’Ã‚Âªt qui nourrissait la faune et la flore des montagnes. Les grandes crÃƒÆ’Ã‚Â©atures s'effrayaient, et personne n'osait s'approcher des flammes. Mais le petit colibri, dÃƒÆ’Ã‚Â©terminÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚  protÃƒÆ’Ã‚Â©ger la vie autour de lui, vola droit vers le feu. Il transportait de minuscules gouttes d'eau dans son bec, tombant sans relÃƒÆ’Ã‚Â¢che sur les flammes.
MalgrÃƒÆ’Ã‚Â© la chaleur et la fatigue, le colibri ne cÃƒÆ’Ã‚Â©da jamais. Les autres animaux, inspirÃƒÆ’Ã‚Â©s par sa dÃƒÆ’Ã‚Â©termination et son courage, commencÃƒÆ’Ã‚Â¨rent ÃƒÆ’Ã‚  l'aider. Ensemble, ils parvinrent ÃƒÆ’Ã‚  ÃƒÆ’Ã‚Â©teindre l'incendie, sauvant ainsi la forÃƒÆ’Ã‚Âªt et tous ses habitants.
Depuis ce jour, le colibri est cÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©brÃƒÆ’Ã‚Â© dans les lÃƒÆ’Ã‚Â©gendes pÃƒÆ’Ã‚Â©ruviennes comme le symbole du courage et de la persÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©rance, prouvant que mÃƒÆ’Ã‚Âªme les plus petits peuvent accomplir de grands exploits si leur coeur est vaillant.`,
    },
    {
      id: 9,
      type: 'conte',
      title: `Conte - ÃƒÆ’Ã¢â‚¬Â°gypte : Le secret du Nil`,
      text: `Au coeur de l'ÃƒÆ’Ã¢â‚¬Â°gypte ancienne, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ le Nil serpentait comme un ruban bleu entre les sables dorÃƒÆ’Ã‚Â©s, se trouvait un village paisible dont les habitants vivaient en harmonie avec le fleuve sacrÃƒÆ’Ã‚Â©. On racontait qu'au crÃƒÆ’Ã‚Â©puscule, lorsque le soleil baignait les rives d'une lumiÃƒÆ’Ã‚Â¨re d'or, le Nil rÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©lait ses secrets aux coeurs courageux.
Un jeune garÃƒÆ’Ã‚Â§on du village, curieux et intrÃƒÆ’Ã‚Â©pide, rÃƒÆ’Ã‚Âªvait de dÃƒÆ’Ã‚Â©couvrir ce mystÃƒÆ’Ã‚Â¨re. Chaque soir, il s'asseyait au bord de l'eau, ÃƒÆ’Ã‚Â©coutant le murmure des vagues et observant les reflets dansants du soleil. Une nuit, le fleuve sembla s'animer, et une lumiÃƒÆ’Ã‚Â¨re scintillante surgit ÃƒÆ’Ã‚  la surface.
GuidÃƒÆ’Ã‚Â© par cette lueur, l'enfant navigua sur une petite barque, dÃƒÆ’Ã‚Â©couvrant une ÃƒÆ’Ã‚Â®le cachÃƒÆ’Ã‚Â©e oÃƒÆ’Ã‚Â¹ les plantes et les animaux semblaient parler entre eux. LÃƒÆ’Ã‚ , un ancien esprit du Nil lui confia que le secret de la vie rÃƒÆ’Ã‚Â©sidait dans l'ÃƒÆ’Ã‚Â©quilibre et le respect de la nature, dans la maniÃƒÆ’Ã‚Â¨re dont le fleuve nourrissait la terre et les hommes, jour aprÃƒÆ’Ã‚Â¨s jour.
De retour au village, le jeune homme partagea cette sagesse : il enseigna aux habitants ÃƒÆ’Ã‚  ÃƒÆ’Ã‚Â©couter le fleuve et ÃƒÆ’Ã‚  protÃƒÆ’Ã‚Â©ger ses eaux, et le village prospÃƒÆ’Ã‚Â©ra comme jamais.
Depuis ce temps, le Nil est cÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©brÃƒÆ’Ã‚Â© non seulement pour ses eaux fertiles, mais aussi pour les secrets qu'il murmure ÃƒÆ’Ã‚  ceux qui savent regarder et ÃƒÆ’Ã‚Â©couter.`,
    },
    {
      id: 10,
      type: 'conte',
      title: `Conte - Australie : Tiddalik, la grenouille`,
      text: `Dans les vastes ÃƒÆ’Ã‚Â©tendues rouges de l'Australie, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ les eucalyptus s'ÃƒÆ’Ã‚Â©lanÃƒÆ’Ã‚Â§aient vers le ciel et oÃƒÆ’Ã‚Â¹ le sable chaud crissait sous les pieds, vivait Tiddalik, une grenouille pas comme les autres. Sa particularitÃƒÆ’Ã‚Â© ? Il pouvait boire toute l'eau du pays, et lorsqu'il ÃƒÆ’Ã‚Â©tait gourmand, il ne laissait aucune goutte pour les autres.
Un jour, il eut une soif insatiable et avala tous les lacs, riviÃƒÆ’Ã‚Â¨res et mares de la rÃƒÆ’Ã‚Â©gion. Les kangourous, les wombats, les perruches et les lÃƒÆ’Ã‚Â©zards se retrouvÃƒÆ’Ã‚Â¨rent sans une seule goutte d'eau. Le dÃƒÆ’Ã‚Â©sert, dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚  chaud, devint impitoyable, et les animaux ÃƒÆ’Ã‚Â©taient au bord du dÃƒÆ’Ã‚Â©sespoir.
Alors, ils dÃƒÆ’Ã‚Â©cidÃƒÆ’Ã‚Â¨rent d'unir leurs forces. Chaque animal essaya de le faire rire, car selon la lÃƒÆ’Ã‚Â©gende, rire faisait relÃƒÆ’Ã‚Â¢cher l'eau avalÃƒÆ’Ã‚Â©e par Tiddalik. Les oiseaux chantÃƒÆ’Ã‚Â¨rent de folles mÃƒÆ’Ã‚Â©lodies, les kangourous sautÃƒÆ’Ã‚Â¨rent en cadence, et les wombats se roulÃƒÆ’Ã‚Â¨rent dans le sable jusqu'ÃƒÆ’Ã‚  ce que Tiddalik ÃƒÆ’Ã‚Â©clate de rire, et en un instant, toute l'eau revint dans les riviÃƒÆ’Ã‚Â¨res et les lacs, rendant la vie ÃƒÆ’Ã‚  la terre et ÃƒÆ’Ã‚  ses habitants.
Depuis ce jour, on raconte que la grenouille veille sur l'eau, rappelant ÃƒÆ’Ã‚  tous que la gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©rositÃƒÆ’Ã‚Â© et le partage sont essentiels ÃƒÆ’Ã‚  la survie de chacun.`,
    },
    {
      id: 11,
      type: 'conte',
      title: `Conte - Allemagne : Le joueur de flÃƒÆ’Ã‚Â»te de Hamelin`,
      text: `Dans la ville pittoresque d'Hamelin, aux maisons ÃƒÆ’Ã‚  colombages et aux ruelles pavÃƒÆ’Ã‚Â©es, un problÃƒÆ’Ã‚Â¨me inquiÃƒÆ’Ã‚Â©tant pesait sur les habitants : une invasion de rats qui dÃƒÆ’Ã‚Â©voraient les rÃƒÆ’Ã‚Â©coltes, envahissaient les maisons et troublaient le sommeil des habitants.
Un jour, un ÃƒÆ’Ã‚Â©trange joueur de flÃƒÆ’Ã‚Â»te fit son apparition. VÃƒÆ’Ã‚Âªtu d'un manteau colorÃƒÆ’Ã‚Â© et tenant une flÃƒÆ’Ã‚Â»te aux reflets dorÃƒÆ’Ã‚Â©s, il proposa son aide contre une promesse : ÃƒÆ’Ã‚Âªtre payÃƒÆ’Ã‚Â© gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©reusement pour se dÃƒÆ’Ã‚Â©barrasser des rongeurs. DÃƒÆ’Ã‚Â©sespÃƒÆ’Ã‚Â©rÃƒÆ’Ã‚Â©s, les habitants acceptÃƒÆ’Ã‚Â¨rent.
Le joueur de flÃƒÆ’Ã‚Â»te leva son instrument ÃƒÆ’Ã‚  ses lÃƒÆ’Ã‚Â¨vres et une mÃƒÆ’Ã‚Â©lodie envoÃƒÆ’Ã‚Â»tante s'ÃƒÆ’Ã‚Â©leva dans l'air. Les rats, charmÃƒÆ’Ã‚Â©s et hypnotisÃƒÆ’Ã‚Â©s, le suivirent sans un bruit. Ils sortirent de chaque maison, de chaque cave et de chaque recoin, marchant derriÃƒÆ’Ã‚Â¨re lui jusqu'ÃƒÆ’Ã‚  la riviÃƒÆ’Ã‚Â¨re, oÃƒÆ’Ã‚Â¹ ils disparurent ÃƒÆ’Ã‚  jamais.
Mais, hÃƒÆ’Ã‚Â©las, une fois sa mission accomplie, les habitants refusÃƒÆ’Ã‚Â¨rent de le payer comme convenu. Furieux, le joueur de flÃƒÆ’Ã‚Â»te joua de nouveau une mÃƒÆ’Ã‚Â©lodie magique, et cette fois-ci, les enfants d'Hamelin furent emportÃƒÆ’Ã‚Â©s par la musique, marchant derriÃƒÆ’Ã‚Â¨re lui hors de la ville, comme les rats autrefois, laissant derriÃƒÆ’Ã‚Â¨re eux une ville silencieuse et pleine de remords.`,
    },
    {
      id: 12,
      type: 'conte',
      title: `Conte - Inde : Le prince au cobra`,
      text: `Dans un royaume lointain d'Inde, aux palais aux dÃƒÆ’Ã‚Â´mes dorÃƒÆ’Ã‚Â©s et aux jardins luxuriants, vivait un jeune prince courageux. Sa curiositÃƒÆ’Ã‚Â© et son courage le poussaient souvent ÃƒÆ’Ã‚  explorer les forÃƒÆ’Ã‚Âªts et les riviÃƒÆ’Ã‚Â¨res qui entouraient son palais.
Un jour, alors qu'il se promenait prÃƒÆ’Ã‚Â¨s d'un ÃƒÆ’Ã‚Â©tang sacrÃƒÆ’Ã‚Â©, il rencontra un cobra majestueux, aux ÃƒÆ’Ã‚Â©cailles scintillantes et aux yeux perÃƒÆ’Ã‚Â§ants. Mais ce n'ÃƒÆ’Ã‚Â©tait pas un serpent ordinaire : il pouvait parler et possÃƒÆ’Ã‚Â©dait des pouvoirs magiques anciens. Ce dernier expliqua au prince qu'un grand danger menaÃƒÆ’Ã‚Â§ait le royaume, et que seul un coeur pur et courageux pourrait dÃƒÆ’Ã‚Â©jouer ce sort.
Le prince accepta la mission. GrÃƒÆ’Ã‚Â¢ce aux conseils du reptile et ÃƒÆ’Ã‚  son intelligence, il traversa des ÃƒÆ’Ã‚Â©preuves mystÃƒÆ’Ã‚Â©rieuses : rÃƒÆ’Ã‚Â©soudre des ÃƒÆ’Ã‚Â©nigmes, franchir des ponts invisibles et affronter des illusions trompeuses. ÃƒÆ’Ã‚Â¬ chaque dÃƒÆ’Ã‚Â©fi, le cobra l'accompagnait, enseignant la patience, la prudence et le respect de la nature.
Finalement, grÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  leur alliance, le prince rÃƒÆ’Ã‚Â©ussit ÃƒÆ’Ã‚  sauver le royaume et ÃƒÆ’Ã‚  ramener la paix et la prospÃƒÆ’Ã‚Â©ritÃƒÆ’Ã‚Â©. En signe de gratitude, le cobra se transforma en joyau magique, symbole de sagesse et de courage, que le prince porta toujours avec lui.`,
    },
    {
      id: 13,
      type: 'conte',
      title: `Conte - Groenland : L'ourse et la chasseuse`,
      text: `Au coeur des vastes glaces du Groenland, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ le vent hurlait et oÃƒÆ’Ã‚Â¹ la neige recouvrait tout, vivait une jeune chasseuse courageuse. Sa peau rosÃƒÆ’Ã‚Â©e par le froid et ses yeux perÃƒÆ’Ã‚Â§ants lui permettaient de repÃƒÆ’Ã‚Â©rer les moindres traces dans la neige immaculÃƒÆ’Ã‚Â©e.
Un matin, alors qu'elle suivait des empreintes mystÃƒÆ’Ã‚Â©rieuses, elle rencontra une grande ourse blanche, majestueuse et imposante, mais ÃƒÆ’Ã‚Â©tonnamment douce dans son regard. La crÃƒÆ’Ã‚Â©ature parlait un langage secret que seuls les habitants du Groenland pouvaient comprendre. Elle confia ÃƒÆ’Ã‚  la chasseuse une mission : protÃƒÆ’Ã‚Â©ger les animaux et les esprits de la glace d'un danger imminent.
La chasseuse accepta. Ensemble, elles traversÃƒÆ’Ã‚Â¨rent des fjords gelÃƒÆ’Ã‚Â©s, escaladÃƒÆ’Ã‚Â¨rent des montagnes couvertes de neige et affrontÃƒÆ’Ã‚Â¨rent les tempÃƒÆ’Ã‚Âªtes polaires. Chaque pas ÃƒÆ’Ã‚Â©tait un dÃƒÆ’Ã‚Â©fi, mais la prÃƒÆ’Ã‚Â©sence de l'ourse la guidait et la protÃƒÆ’Ã‚Â©geait. La chasseuse apprit ÃƒÆ’Ã‚  ÃƒÆ’Ã‚Â©couter la nature, ÃƒÆ’Ã‚  comprendre les murmures des vents et le chant des aurores borÃƒÆ’Ã‚Â©ales.
ÃƒÆ’Ã‚Â¬ la fin de leur pÃƒÆ’Ã‚Â©riple, la chasseuse avait non seulement sauvÃƒÆ’Ã‚Â© les crÃƒÆ’Ã‚Â©atures du Groenland, mais elle avait aussi tissÃƒÆ’Ã‚Â© un lien indestructible avec l'ourse, qui devint sa protectrice ÃƒÆ’Ã‚Â©ternelle.
Les habitants du village racontent encore que, lorsque la neige tombe doucement, on peut voir l'ourse et la chasseuse parcourir les ÃƒÆ’Ã‚Â©tendues glacÃƒÆ’Ã‚Â©es, unies par un courage et une amitiÃƒÆ’Ã‚Â© hors du commun.`,
    },
    {
      id: 14,
      type: 'conte',
      title: `Conte - Italie : GiufÃƒÆ’Ã‚  et l'ÃƒÆ’Ã‚Â¢ne`,
      text: `Dans un petit village ensoleillÃƒÆ’Ã‚Â© d'Italie, au pied des collines et entre les oliveraies, vivait GiufÃƒÆ’Ã‚ , un garÃƒÆ’Ã‚Â§on malin et plein de malice. Il possÃƒÆ’Ã‚Â©dait un ÃƒÆ’Ã‚Â¢ne tÃƒÆ’Ã‚Âªtu mais attachant, qui semblait parfois comprendre mieux que GiufÃƒÆ’Ã‚  lui-mÃƒÆ’Ã‚Âªme.
Un jour, le village organisa une fÃƒÆ’Ã‚Âªte et le jeune homme fut chargÃƒÆ’Ã‚Â© de conduire son animal au marchÃƒÆ’Ã‚Â© pour y vendre des produits. Mais l'ÃƒÆ’Ã‚Â¢ne, espiÃƒÆ’Ã‚Â¨gle et obstinÃƒÆ’Ã‚Â©, refusait d'avancer droit et se mit ÃƒÆ’Ã‚  zigzaguer entre les rues pavÃƒÆ’Ã‚Â©es. GiufÃƒÆ’Ã‚  dut user de toute son ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â© pour le guider : il chanta de drÃƒÆ’Ã‚Â´les de chansons, fit des tours de magie et mÃƒÆ’Ã‚Âªme des petites farces pour le distraire.
Finalement, grÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  son esprit vif et ÃƒÆ’Ã‚  sa patience, il rÃƒÆ’Ã‚Â©ussit ÃƒÆ’Ã‚  le mener au marchÃƒÆ’Ã‚Â©. Les villageois, ÃƒÆ’Ã‚Â©merveillÃƒÆ’Ã‚Â©s par son habiletÃƒÆ’Ã‚Â© et amusÃƒÆ’Ã‚Â©s par les facÃƒÆ’Ã‚Â©ties de l'ÃƒÆ’Ã‚Â¢ne, le fÃƒÆ’Ã‚Â©licitÃƒÆ’Ã‚Â¨rent et racontÃƒÆ’Ã‚Â¨rent cette aventure longtemps aprÃƒÆ’Ã‚Â¨s.
GiufÃƒÆ’Ã‚  et son ÃƒÆ’Ã‚Â¢ne devinrent un symbole de ruse, de courage et de joie de vivre dans tout le village, rappelant que mÃƒÆ’Ã‚Âªme face ÃƒÆ’Ã‚  des obstacles inattendus, l'intelligence et l'humour peuvent toujours triompher.`,
    },
    {
      id: 15,
      type: 'conte',
      title: `Conte - Kenya : Le feu volant`,
      text: `Dans les vastes plaines dorÃƒÆ’Ã‚Â©es du Kenya, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ le vent faisait onduler les hautes herbes et oÃƒÆ’Ã‚Â¹ les acacias dessinaient des ombres lÃƒÆ’Ã‚Â©gÃƒÆ’Ã‚Â¨res sur la terre chaude, vivait un jeune garÃƒÆ’Ã‚Â§on courageux nommÃƒÆ’Ã‚Â© Kibaru. Ses yeux noirs brillaient comme des braises et ses cheveux courts dansaient sous le soleil de midi.
Un soir, alors que le ciel se teintait d'orange et de pourpre, Kibaru aperÃƒÆ’Ã‚Â§ut un phÃƒÆ’Ã‚Â©nomÃƒÆ’Ã‚Â¨ne ÃƒÆ’Ã‚Â©trange : des flammes flottantes, comme des lucioles ardentes, qui s'ÃƒÆ’Ã‚Â©levaient dans les airs sans brÃƒÆ’Ã‚Â»ler les herbes ni les arbres. FascinÃƒÆ’Ã‚Â©, il dÃƒÆ’Ã‚Â©cida de les suivre. Chaque pas le menait plus loin, ÃƒÆ’Ã‚  travers riviÃƒÆ’Ã‚Â¨res et collines, guidÃƒÆ’Ã‚Â© par la lumiÃƒÆ’Ã‚Â¨re tremblante du feu volant.
Ces flammes, selon la lÃƒÆ’Ã‚Â©gende, ÃƒÆ’Ã‚Â©taient les esprits protecteurs de la savane, envoyÃƒÆ’Ã‚Â©s pour aider ceux qui montraient courage et bontÃƒÆ’Ã‚Â©. Kibaru dÃƒÆ’Ã‚Â©couvrit qu'en capturant leur lumiÃƒÆ’Ã‚Â¨re dans une petite calebasse, il pouvait transporter le feu d'un village ÃƒÆ’Ã‚  l'autre, permettant aux habitants de cuisiner, de s'ÃƒÆ’Ã‚Â©clairer et de se rÃƒÆ’Ã‚Â©chauffer, mÃƒÆ’Ã‚Âªme lors des nuits les plus sombres.
Mais il devait ÃƒÆ’Ã‚Âªtre prudent : le feu volant ÃƒÆ’Ã‚Â©tait capricieux. S'il devenait impatient, il s'envolait et disparaissait dans le ciel ÃƒÆ’Ã‚Â©toilÃƒÆ’Ã‚Â©.
GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  sa patience et son respect pour les esprits, Kibaru apprit ÃƒÆ’Ã‚  danser avec les flammes, ÃƒÆ’Ã‚  les guider sans jamais les contraindre, transformant ainsi chaque nuit en un spectacle lumineux fascinant.`,
    },
    {
      id: 16,
      type: 'conte',
      title: `Conte - Chili : La lune et le renard`,
      text: `Dans les montagnes arides et mystÃƒÆ’Ã‚Â©rieuses du Chili, lÃƒÆ’Ã‚  oÃƒÆ’Ã‚Â¹ les sommets s'ÃƒÆ’Ã‚Â©lancent vers le ciel et oÃƒÆ’Ã‚Â¹ le vent murmure aux pierres, vivait un renard rusÃƒÆ’Ã‚Â© et curieux nommÃƒÆ’Ã‚Â© Chai. Son pelage roux flamboyant se fondait parfois avec les roches, et ses yeux dorÃƒÆ’Ã‚Â©s reflÃƒÆ’Ã‚Â©taient les ÃƒÆ’Ã‚Â©clats de la lune qui baignait les vallÃƒÆ’Ã‚Â©es chaque nuit.
Un jour, alors que la lune brillait plus intensÃƒÆ’Ã‚Â©ment que jamais, Chai, la regarda descendre du ciel et parler dans un souffle lÃƒÆ’Ã‚Â©ger :
Renard, si tu veux comprendre les secrets de la nuit, suis mes rayons et observe avec attention.
FascinÃƒÆ’Ã‚Â© et prudent, l'animal suivit la lueur argentÃƒÆ’Ã‚Â©e ÃƒÆ’Ã‚  travers les rochers, les riviÃƒÆ’Ã‚Â¨res scintillantes et les forÃƒÆ’Ã‚Âªts clairsemÃƒÆ’Ã‚Â©es.
Au fil de son voyage nocturne, le renard comprit que la lune n'ÃƒÆ’Ã‚Â©clairait pas seulement la terre, mais rÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©lait ÃƒÆ’Ã‚Â©galement la vÃƒÆ’Ã‚Â©ritÃƒÆ’Ã‚Â© dans le coeur de ceux qui l'observaient. Chaque rayon lui enseignait la patience, l'humilitÃƒÆ’Ã‚Â© et la valeur de la curiositÃƒÆ’Ã‚Â© : apprendre ÃƒÆ’Ã‚  ÃƒÆ’Ã‚Â©couter le monde avant d'agir.
ÃƒÆ’Ã‚Â¬ la fin de son pÃƒÆ’Ã‚Â©riple, il rÃƒÆ’Ã‚Â©alisa que l'astre lui avait offert un cadeau invisible mais puissant : la sagesse de voir ce que les yeux seuls ne peuvent percevoir.
Depuis ce soir-lÃƒÆ’Ã‚ , il partageait sa ruse et sa connaissance avec les autres animaux, devenant un guide respectÃƒÆ’Ã‚Â© dans les montagnes chiliennes.`,
    },
    {
      id: 17,
      type: 'conte',
      title: `Conte - France : Le Petit Poucet`,
      text: `Dans une forÃƒÆ’Ã‚Âªt dense et mystÃƒÆ’Ã‚Â©rieuse de France, oÃƒÆ’Ã‚Â¹ les arbres s'ÃƒÆ’Ã‚Â©lanÃƒÆ’Ã‚Â§aient vers le ciel et oÃƒÆ’Ã‚Â¹ chaque ombre semblait abriter un secret, vivait un petit garÃƒÆ’Ã‚Â§on astucieux appelÃƒÆ’Ã‚Â© Poucet. Bien que minuscule de taille, son esprit ÃƒÆ’Ã‚Â©tait immense, et ses yeux pÃƒÆ’Ã‚Â©tillants d'intelligence brillaient ÃƒÆ’Ã‚  travers les feuilles des arbres comme deux ÃƒÆ’Ã‚Â©toiles dans la nuit.
Un soir, alors que la lune se glissait entre les branches, le petit bonhomme fut confrontÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚  un grand danger : ses frÃƒÆ’Ã‚Â¨res et lui avaient ÃƒÆ’Ã‚Â©tÃƒÆ’Ã‚Â© abandonnÃƒÆ’Ã‚Â©s par leurs parents, perdus au coeur de la forÃƒÆ’Ã‚Âªt. Mais Poucet, avec son courage et sa ruse, laissa tomber derriÃƒÆ’Ã‚Â¨re lui de petites pierres blanches qui brillaient sous la lune. Ainsi, ils purent retrouver leur chemin, pas ÃƒÆ’Ã‚  pas, guidÃƒÆ’Ã‚Â©s par le scintillement fragile mais constant des cailloux.
Plus tard, confrontÃƒÆ’Ã‚Â© au terrible ogre, l'enfant usa encore de son intelligence : il ÃƒÆ’Ã‚Â©changea les bonnets de ses frÃƒÆ’Ã‚Â¨res avec les siens, trompant l'ogre et sauvant sa famille grÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  son audace et son esprit vif.`,
    },
    {
      id: 18,
      type: 'conte',
      title: `Conte - CorÃƒÆ’Ã‚Â©e du Sud : La grue reconnaissante`,
      text: `Dans un village tranquille de CorÃƒÆ’Ã‚Â©e, nichÃƒÆ’Ã‚Â© entre des collines verdoyantes et des riviÃƒÆ’Ã‚Â¨res scintillantes, vivait un homme pauvre mais au coeur gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©reux. Un soir d'hiver, alors qu'il marchait seul sous le vent glacÃƒÆ’Ã‚Â©, il trouva une grue blessÃƒÆ’Ã‚Â©e, ses ailes froissÃƒÆ’Ã‚Â©es et ses plumes ÃƒÆ’Ã‚Â©bouriffÃƒÆ’Ã‚Â©es par la neige. PoussÃƒÆ’Ã‚Â© par la compassion, il la recueillit et prit soin d'elle avec patience et douceur, lui offrant chaleur et nourriture.
Quelques jours plus tard, l'oiseau disparut mystÃƒÆ’Ã‚Â©rieusement, mais bientÃƒÆ’Ã‚Â´t, une ÃƒÆ’Ã‚Â©trange femme silencieuse frappa ÃƒÆ’Ã‚  sa porte. Elle proposa de tisser pour lui de magnifiques ÃƒÆ’Ã‚Â©toffes, mais ÃƒÆ’Ã‚  une condition : il ne devait jamais regarder ce qu'elle faisait. Curieux mais respectueux, il accepta et bientÃƒÆ’Ã‚Â´t, il reÃƒÆ’Ã‚Â§ut des tissus d'une beautÃƒÆ’Ã‚Â© incroyable, faits de fil d'argent et de soie lumineuse.
Un soir, sa curiositÃƒÆ’Ã‚Â© le poussa ÃƒÆ’Ã‚  jeter un coup d'oeil, et il dÃƒÆ’Ã‚Â©couvrit que la femme n'ÃƒÆ’Ã‚Â©tait autre que la grue elle-mÃƒÆ’Ã‚Âªme, transformÃƒÆ’Ã‚Â©e par reconnaissance pour sa bontÃƒÆ’Ã‚Â©. ImpressionnÃƒÆ’Ã‚Â© par sa fidÃƒÆ’Ã‚Â©litÃƒÆ’Ã‚Â© et son coeur pur, il comprit alors que la gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©rositÃƒÆ’Ã‚Â© attirait toujours la magie et la reconnaissance sous des formes inattendues.`,
    },
    {
      id: 19,
      type: 'conte',
      title: `Conte - BrÃƒÆ’Ã‚Â©sil : La tortue et le jaguar`,
      text: `Au coeur de la forÃƒÆ’Ã‚Âªt amazonienne, dense et vibrante de vie, vivait une tortue rusÃƒÆ’Ã‚Â©e et rÃƒÆ’Ã‚Â©flÃƒÆ’Ã‚Â©chie, toujours attentive aux moindres bruits et mouvements de la jungle.
Un jour, alors qu'elle se promenait prÃƒÆ’Ã‚Â¨s de la riviÃƒÆ’Ã‚Â¨re, elle rencontra un jaguar affamÃƒÆ’Ã‚Â©, majestueux et redoutable, dont le regard perÃƒÆ’Ã‚Â§ant trahissait l'envie de la dÃƒÆ’Ã‚Â©vorer.
La tortue, au lieu de cÃƒÆ’Ã‚Â©der ÃƒÆ’Ã‚  la panique, eut une idÃƒÆ’Ã‚Â©e brillante. Elle l'invita ÃƒÆ’Ã‚  participer ÃƒÆ’Ã‚  un concours : qui pourrait atteindre le vieux figuier au sommet de la colline avant l'autre ? Celui-ci, sÃƒÆ’Ã‚Â»r de sa rapiditÃƒÆ’Ã‚Â© et de sa force, accepta sans hÃƒÆ’Ã‚Â©siter.
Tout le long du chemin, la tortue avanÃƒÆ’Ã‚Â§ait lentement mais avec une ruse astucieuse : elle laissait des indices trompeurs, faisait semblant de se perdre, et utilisait les racines et les troncs pour ralentir le jaguar. Finalement, il arriva ÃƒÆ’Ã‚Â©puisÃƒÆ’Ã‚Â© et confus, tandis qu'elle, sans hÃƒÆ’Ã‚Â¢te mais avec intelligence, atteignit le figuier en premier.
Le fÃƒÆ’Ã‚Â©lin, impressionnÃƒÆ’Ã‚Â© et respectueux de l'ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â© de la tortue, renonÃƒÆ’Ã‚Â§a ÃƒÆ’Ã‚  sa faim et devint un alliÃƒÆ’Ã‚Â© inattendu, partageant avec elle la richesse de la forÃƒÆ’Ã‚Âªt et les secrets des animaux.`,
    },
    {
      id: 20,
      type: 'conte',
      title: `Conte - Iran : Le tapis volant`,
      text: `Dans les bazars colorÃƒÆ’Ã‚Â©s et animÃƒÆ’Ã‚Â©s d'une ville ancienne de Perse, un jeune garÃƒÆ’Ã‚Â§on dÃƒÆ’Ã‚Â©couvrit un tapis ancien et poussiÃƒÆ’Ã‚Â©reux, cachÃƒÆ’Ã‚Â© derriÃƒÆ’Ã‚Â¨re des tissus et des lanternes scintillantes. Ce tapis n'ÃƒÆ’Ã‚Â©tait pas ordinaire : ses fils d'or et de soie s'animaient dÃƒÆ’Ã‚Â¨s qu'on posait un pied dessus, et il s'ÃƒÆ’Ã‚Â©levait dans les airs, prÃƒÆ’Ã‚Âªt ÃƒÆ’Ã‚  emporter son voyageur vers des horizons insoupÃƒÆ’Ã‚Â§onnÃƒÆ’Ã‚Â©s.
Le garÃƒÆ’Ã‚Â§on, ÃƒÆ’Ã‚Â©merveillÃƒÆ’Ã‚Â© et un peu craintif, s'installa au centre du tapis. AussitÃƒÆ’Ã‚Â´t, il senti le vent caresser son visage et vit les ruelles se rÃƒÆ’Ã‚Â©trÃƒÆ’Ã‚Â©cir sous lui alors qu'il s'ÃƒÆ’Ã‚Â©levait au-dessus de la commune. Le tapis vola entre les minarets et les jardins suspendus, passant au-dessus des marchÃƒÆ’Ã‚Â©s parfumÃƒÆ’Ã‚Â©s et des fontaines chantantes.
Chaque mouvement du tapis ÃƒÆ’Ã‚Â©tait magique et fluide, comme guidÃƒÆ’Ã‚Â© par l'air lui-mÃƒÆ’Ã‚Âªme. Il traversa des vallÃƒÆ’Ã‚Â©es dÃƒÆ’Ã‚Â©sertiques, survola des montagnes majestueuses, et emmena son passager dans des paysages merveilleusement variÃƒÆ’Ã‚Â©s, oÃƒÆ’Ã‚Â¹ les couleurs et les sons semblaient sortir d'un rÃƒÆ’Ã‚Âªve.`,
    },
    {
      id: 21,
      type: 'conte',
      title: `Conte - ThaÃƒÆ’Ã‚Â¯lande : La mangue du roi`,
      text: `Dans le royaume verdoyant de ThaÃƒÆ’Ã‚Â¯lande, au coeur de jardins luxuriants et parfumÃƒÆ’Ã‚Â©s, un jeune garÃƒÆ’Ã‚Â§on s'approcha d'un arbre majestueux, le manguier du roi, dont les fruits ÃƒÆ’Ã‚Â©taient rÃƒÆ’Ã‚Â©putÃƒÆ’Ã‚Â©s plus sucrÃƒÆ’Ã‚Â©s et juteux que tous les autres. On raconte que celui qui goÃƒÆ’Ã‚Â»te une de ces mangues ressent la magie du royaume et obtient la sagesse et la chance.
Ce dernier, curieux et ÃƒÆ’Ã‚Â©merveillÃƒÆ’Ã‚Â©, tendit la main vers un fruit dorÃƒÆ’Ã‚Â© suspendu haut dans les branches. DÃƒÆ’Ã‚Â¨s qu'il toucha la mangue, un doux parfum tropical envahit l'air, et une lumiÃƒÆ’Ã‚Â¨re chaleureuse enveloppa ses doigts, comme si le soleil lui-mÃƒÆ’Ã‚Âªme s'ÃƒÆ’Ã‚Â©tait glissÃƒÆ’Ã‚Â© dans l'arbre.
Soudain, le fruit se dÃƒÆ’Ã‚Â©tacha et descendit doucement, guidÃƒÆ’Ã‚Â© par un souffle magique, jusqu'ÃƒÆ’Ã‚  lui. En la goÃƒÆ’Ã‚Â»tant, il ressentit un ÃƒÆ’Ã‚Â©clat de bonheur et d'ÃƒÆ’Ã‚Â©nergie, voyant autour de lui les ÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©phants, les riziÃƒÆ’Ã‚Â¨res ÃƒÆ’Ã‚Â©tincelantes et les temples scintillants, tous baignÃƒÆ’Ã‚Â©s dans une lumiÃƒÆ’Ã‚Â¨re dorÃƒÆ’Ã‚Â©e.`,
    },
    {
      id: 22,
      type: 'conte',
      title: `Conte - Angleterre : Jack et le haricot magique`,
      text: `Dans un petit village anglais bordÃƒÆ’Ã‚Â© de collines verdoyantes, vivait Jack, un garÃƒÆ’Ã‚Â§on pauvre mais audacieux, qui partageait sa vie avec sa mÃƒÆ’Ã‚Â¨re dans une maisonnette en bois.
Un matin, la seule vache de la famille ne donna plus de lait. Sa mÃƒÆ’Ã‚Â¨re, inquiÃƒÆ’Ã‚Â¨te, demanda ÃƒÆ’Ã‚  son fils de la vendre au marchÃƒÆ’Ã‚Â© afin de survivre.
Sur le chemin, Jack rencontra un vieil homme mystÃƒÆ’Ã‚Â©rieux qui lui proposa d'ÃƒÆ’Ã‚Â©changer la vache contre quelques haricots extraordinaires, brillants et colorÃƒÆ’Ã‚Â©s, avec un ÃƒÆ’Ã‚Â©clat presque magique. L'enfant accepta, intriguÃƒÆ’Ã‚Â©. De retour ÃƒÆ’Ã‚  la maison, sa mÃƒÆ’Ã‚Â¨re, furieuse, jeta les haricots par la fenÃƒÆ’Ã‚Âªtre.
La nuit tomba, et sous l'ÃƒÆ’Ã‚Â©clat de la lune, un haricot poussa, grandit jusqu'au ciel ! Il devint un immense haricot magique qui s'ÃƒÆ’Ã‚Â©leva au-dessus des nuages, vers un monde inconnu. Jack, courageux et curieux, dÃƒÆ’Ã‚Â©cida de grimper le long de cette liane vertigineuse.
Au sommet, il dÃƒÆ’Ã‚Â©couvrit un palais fantastique, abritant un ogre immense et des trÃƒÆ’Ã‚Â©sors fabuleux. Les sons du chÃƒÆ’Ã‚Â¢teau rÃƒÆ’Ã‚Â©sonnaient dans le vent : le tintement de piÃƒÆ’Ã‚Â¨ces d'or, le rugissement de l'ogre et les chants des oiseaux du ciel.
L'enfant, rusÃƒÆ’Ã‚Â© et audacieux, utilisa son intelligence et son courage afin de rÃƒÆ’Ã‚Â©cupÃƒÆ’Ã‚Â©rer les trÃƒÆ’Ã‚Â©sors et retrouver le chemin vers la maison, en faisant preuve d'ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â© et de bravoure.`,
    },
    {
      id: 23,
      type: 'conte',
      title: `Conte - Vietnam : L'enfant des riziÃƒÆ’Ã‚Â¨res`,
      text: `Dans un petit village nichÃƒÆ’Ã‚Â© au coeur des riziÃƒÆ’Ã‚Â¨res verdoyantes du Vietnam, vivait un enfant nommÃƒÆ’Ã‚Â© Minh, curieux et dÃƒÆ’Ã‚Â©bordant d'ÃƒÆ’Ã‚Â©nergie. Chaque matin, il parcourait les sentiers ÃƒÆ’Ã‚Â©troits entre les champs inondÃƒÆ’Ã‚Â©s, observant les reflets du soleil sur l'eau et ÃƒÆ’Ã‚Â©coutant le doux murmure du vent dans les palmiers.
Un jour, alors qu'il jouait prÃƒÆ’Ã‚Â¨s d'un petit ruisseau, il dÃƒÆ’Ã‚Â©couvrit un canard blessÃƒÆ’Ã‚Â©. Avec douceur et patience, il le soigna, s'occupant de ses ailes et de ses plumes trempÃƒÆ’Ã‚Â©es. L'animal, reconnaissant, devint son compagnon fidÃƒÆ’Ã‚Â¨le, l'accompagnant dans toutes ses aventures ÃƒÆ’Ã‚  travers les riziÃƒÆ’Ã‚Â¨res.
Mais ces terres regorgeaient de mystÃƒÆ’Ã‚Â¨res. Entre les brumes matinales, Minh aperÃƒÆ’Ã‚Â§ut des crÃƒÆ’Ã‚Â©atures ÃƒÆ’Ã‚Â©tranges et bienveillantes, qui semblaient garder les secrets des champs et des cours d'eau. Il apprit ÃƒÆ’Ã‚  comprendre le langage des animaux, ÃƒÆ’Ã‚  ÃƒÆ’Ã‚Â©couter les lÃƒÆ’Ã‚Â©gendes transmises par les anciens, et ÃƒÆ’Ã‚  respecter la magie qui imprÃƒÆ’Ã‚Â©gnait chaque ÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©ment de la nature.
Un jour, une inondation menaÃƒÆ’Ã‚Â§a les riziÃƒÆ’Ã‚Â¨res du village. GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  son intelligence, son courage et l'aide de son fidÃƒÆ’Ã‚Â¨le canard, Minh parvint ÃƒÆ’Ã‚  guider les villageois et ÃƒÆ’Ã‚  protÃƒÆ’Ã‚Â©ger les champs. Sa bravoure devint une lÃƒÆ’Ã‚Â©gende locale, et l'enfant des riziÃƒÆ’Ã‚Â¨res fut cÃƒÆ’Ã‚Â©lÃƒÆ’Ã‚Â©brÃƒÆ’Ã‚Â© comme un hÃƒÆ’Ã‚Â©ros humble et sage, capable d'harmoniser le monde naturel et humain autour de lui.`,
    },
    {
      id: 24,
      type: 'conte',
      title: `Conte - Espagne : Le tambour enchantÃƒÆ’Ã‚Â©`,
      text: `Dans un petit village d'Espagne, nichÃƒÆ’Ã‚Â© entre les collines et les oliveraies, vivait un jeune garÃƒÆ’Ã‚Â§on nommÃƒÆ’Ã‚Â© Diego, passionnÃƒÆ’Ã‚Â© par la musique et les fÃƒÆ’Ã‚Âªtes traditionnelles. Son instrument prÃƒÆ’Ã‚Â©fÃƒÆ’Ã‚Â©rÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚Â©tait un vieux tambour en bois, transmis de gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©ration en gÃƒÆ’Ã‚Â©nÃƒÆ’Ã‚Â©ration dans sa famille, dont les battements rÃƒÆ’Ã‚Â©sonnaient comme un coeur vibrant de vie et de lÃƒÆ’Ã‚Â©gendes.
Un soir, alors que le soleil se couchait derriÃƒÆ’Ã‚Â¨re les collines, Diego dÃƒÆ’Ã‚Â©couvrit que le tambour possÃƒÆ’Ã‚Â©dait des pouvoirs magiques : chaque rythme qu'il jouait faisait danser les animaux, les villageois, et mÃƒÆ’Ã‚Âªme les ÃƒÆ’Ã‚Â©toiles dans le ciel. ÃƒÆ’Ã¢â‚¬Â°merveillÃƒÆ’Ã‚Â©, il dÃƒÆ’Ã‚Â©cida de partager cette magie avec tout le village, et bientÃƒÆ’Ã‚Â´t, une fÃƒÆ’Ã‚Âªte improvisÃƒÆ’Ã‚Â©e ÃƒÆ’Ã‚Â©clata, oÃƒÆ’Ã‚Â¹ chacun dansait et chantait, portÃƒÆ’Ã‚Â© par la musique enchantÃƒÆ’Ã‚Â©e du tambour.
Mais la magie n'ÃƒÆ’Ã‚Â©tait pas sans dÃƒÆ’Ã‚Â©fis. Les sons du tambour attirÃƒÆ’Ã‚Â¨rent ÃƒÆ’Ã‚Â©galement des esprits farceurs, qui cherchaient ÃƒÆ’Ã‚  troubler l'harmonie du village. Avec courage et ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â©, Diego apprit ÃƒÆ’Ã‚  jouer de douces mÃƒÆ’Ã‚Â©lodies, apaisant les esprits, ce qui renforÃƒÆ’Ã‚Â§a le lien entre les habitants, la faune et la flore.
GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  son tambour enchantÃƒÆ’Ã‚Â©, Diego devint le gardien de la joie et des traditions, rappelant ÃƒÆ’Ã‚  tous que la musique pouvait unir les coeurs et transformer chaque journÃƒÆ’Ã‚Â©e en un moment extraordinaire.`,
    },
    {
      id: 25,
      type: 'conte',
      title: `Conte - HaÃƒÆ’Ã‚Â¯ti : Ti-Jean et le diable`,
      text: `Dans un village colorÃƒÆ’Ã‚Â© d'HaÃƒÆ’Ã‚Â¯ti, bordÃƒÆ’Ã‚Â© par des champs de canne ÃƒÆ’Ã‚  sucre et des collines verdoyantes, vivait un petit garÃƒÆ’Ã‚Â§on nommÃƒÆ’Ã‚Â© Ti-Jean, vif et malin, connu pour son esprit rusÃƒÆ’Ã‚Â© et son sourire espiÃƒÆ’Ã‚Â¨gle.
Un jour, alors qu'il cueillait des fruits prÃƒÆ’Ã‚Â¨s de la riviÃƒÆ’Ã‚Â¨re, le diable apparut, dÃƒÆ’Ã‚Â©cidÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚  tester l'ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â© des humains et ÃƒÆ’Ã‚  attirer les ÃƒÆ’Ã‚Â¢mes naÃƒÆ’Ã‚Â¯ves dans ses tours diaboliques.
Mais Ti-Jean n'ÃƒÆ’Ã‚Â©tait pas un enfant ordinaire. Avec son intelligence, son courage et une bonne dose d'audace, il rÃƒÆ’Ã‚Â©ussit ÃƒÆ’Ã‚  tromper le diable ÃƒÆ’Ã‚  chaque ÃƒÆ’Ã‚Â©preuve. Que ce soit en ÃƒÆ’Ã‚Â©changeant des objets, en crÃƒÆ’Ã‚Â©ant des illusions ou en racontant des histoires confuses, ce dernier dÃƒÆ’Ã‚Â©joua les piÃƒÆ’Ã‚Â¨ges avec humour et ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â©.
ÃƒÆ’Ã‚Â¬ chaque dÃƒÆ’Ã‚Â©fi relevÃƒÆ’Ã‚Â©, il montrait que la ruse et la crÃƒÆ’Ã‚Â©ativitÃƒÆ’Ã‚Â© pouvaient vaincre mÃƒÆ’Ã‚Âªme les plus grandes forces. Les villageois, ÃƒÆ’Ã‚Â©merveillÃƒÆ’Ã‚Â©s par ses exploits, racontaient ses aventures autour des feux de camp, et Ti-Jean devint un symbole de courage et de vivacitÃƒÆ’Ã‚Â©.`,
    },
    {
      id: 26,
      type: 'conte',
      title: `Conte - Turquie : Nasreddine et l'ÃƒÆ’Ã‚Â¢ne`,
      text: `Dans un petit village turc baignÃƒÆ’Ã‚Â© de soleil, aux ruelles ÃƒÆ’Ã‚Â©troites et aux marchÃƒÆ’Ã‚Â©s animÃƒÆ’Ã‚Â©s, vivait Nasreddine, un homme sage et espiÃƒÆ’Ã‚Â¨gle, connu pour son humour et ses rÃƒÆ’Ã‚Â©ponses pleines de bon sens. Un jour, alors qu'il chevauchait son fidÃƒÆ’Ã‚Â¨le ÃƒÆ’Ã‚Â¢ne, il croisa des villageois qui se moquaient de lui, le jugeant toujours un peu bizarre.
Mais Nasreddine ne se laissa jamais dÃƒÆ’Ã‚Â©stabiliser. Avec un sourire malicieux et une logique inattendue, il transforma chaque situation ridicule en une leÃƒÆ’Ã‚Â§on pleine d'esprit. Que ce soit en discutant avec les marchands, en rÃƒÆ’Ã‚Â©solvant des querelles ou en improvisant de drÃƒÆ’Ã‚Â´les d'histoires, il montrait que l'intelligence et l'humour ÃƒÆ’Ã‚Â©taient des armes plus puissantes que la force.
L'ÃƒÆ’Ã‚Â¢ne, fidÃƒÆ’Ã‚Â¨le compagnon de ses aventures, participait souvent involontairement aux tours et aux situations comiques, ajoutant encore plus de charme et de rires ÃƒÆ’Ã‚  chaque anecdote. Les villageois racontaient ensuite ses exploits dans les cafÃƒÆ’Ã‚Â©s et sous les arbres, riant des situations absurdes et admirant la sagacitÃƒÆ’Ã‚Â© de l'homme.`,
    },
    {
      id: 27,
      type: 'conte',
      title: `Conte - Nouvelle-ZÃƒÆ’Ã‚Â©lande : Maui ralentit le soleil`,
      text: `Dans les terres vertes et mystÃƒÆ’Ã‚Â©rieuses de la Nouvelle-ZÃƒÆ’Ã‚Â©lande, entre montagnes majestueuses et forÃƒÆ’Ã‚Âªts denses, vivait Maui, un demi-dieu espiÃƒÆ’Ã‚Â¨gle aux exploits lÃƒÆ’Ã‚Â©gendaires. Un jour, voyant que les journÃƒÆ’Ã‚Â©es ÃƒÆ’Ã‚Â©taient trop courtes pour permettre aux hommes et aux femmes de finir leur travail, il dÃƒÆ’Ã‚Â©cida de ralentir le soleil.
Avec courage et ruse, il grimpa sur le sommet d'une montagne et lanÃƒÆ’Ã‚Â§a un lasso magique, fabriquÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚  partir des cheveux de sa grand-mÃƒÆ’Ã‚Â¨re. Il attrapa le soleil, qui se dÃƒÆ’Ã‚Â©battait avec force, illuminant le ciel de sa lumiÃƒÆ’Ã‚Â¨re ÃƒÆ’Ã‚Â©clatante. GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  son ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â© et sa dÃƒÆ’Ã‚Â©termination, Maui rÃƒÆ’Ã‚Â©ussit ÃƒÆ’Ã‚  ralentir sa course, offrant aux humains de longues journÃƒÆ’Ã‚Â©es pour pÃƒÆ’Ã‚Âªcher, cultiver et profiter de la vie.
Ce geste hÃƒÆ’Ã‚Â©roÃƒÆ’Ã‚Â¯que n'ÃƒÆ’Ã‚Â©tait pas seulement un exploit physique, mais un acte plein de malice et d'ingÃƒÆ’Ã‚Â©niositÃƒÆ’Ã‚Â©, car l'homme savait que l'intelligence et la crÃƒÆ’Ã‚Â©ativitÃƒÆ’Ã‚Â© ÃƒÆ’Ã‚Â©taient des forces aussi puissantes que le courage.
Les habitants racontÃƒÆ’Ã‚Â¨rent encore et encore cette aventure, admirant le demi-dieu qui avait su apprivoiser le soleil lui-mÃƒÆ’Ã‚Âªme.`,
    },
    {
      id: 28,
      type: 'conte',
      title: `Conte - Mali : L'hippopotame et les ÃƒÆ’Ã‚Â©toiles`,
      text: `Au bord du grand fleuve Niger, sous le ciel ÃƒÆ’Ã‚Â©toilÃƒÆ’Ã‚Â© du Mali, vivait un hippopotame curieux et rÃƒÆ’Ã‚Âªveur. Chaque nuit, il regardait les ÃƒÆ’Ã‚Â©toiles briller et se demandait pourquoi elles semblaient si loin et inaccessibles. Les autres animaux riaient de ses rÃƒÆ’Ã‚Âªveries, mais lui savait qu'un jour, il trouverait un moyen de toucher ces points lumineux qui scintillaient au-dessus de sa tÃƒÆ’Ã‚Âªte.
Une nuit, guidÃƒÆ’Ã‚Â© par la lueur des astres, il entreprit un voyage extraordinaire, traversant riviÃƒÆ’Ã‚Â¨res et marÃƒÆ’Ã‚Â©cages, parlant aux lucioles et aux hiboux qui l'accompagnaient. Avec patience et courage, il construisit un bÃƒÆ’Ã‚Â¢ton magique, gravÃƒÆ’Ã‚Â© de symboles anciens et lumineux, qui lui permit de capturer un fragment d'ÃƒÆ’Ã‚Â©toile.
GrÃƒÆ’Ã‚Â¢ce ÃƒÆ’Ã‚  sa persÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©rance, l'hippopotame rÃƒÆ’Ã‚Â©alisa que mÃƒÆ’Ã‚Âªme les rÃƒÆ’Ã‚Âªves les plus grands pouvaient ÃƒÆ’Ã‚Âªtre atteints si l'on osait avancer avec le coeur ouvert et l'esprit attentif.
Les ÃƒÆ’Ã‚Â©toiles, touchÃƒÆ’Ã‚Â©es par sa dÃƒÆ’Ã‚Â©termination, continuÃƒÆ’Ã‚Â¨rent de briller plus fort, illuminant le fleuve et inspirant tous les animaux et les humains qui vivaient autour de lui.`,
    },
    {
      id: 29,
      type: 'conte',
      title: `Conte - Pologne : Le roi grenouille`,
      text: `Dans une forÃƒÆ’Ã‚Âªt ancienne et mystÃƒÆ’Ã‚Â©rieuse de Pologne, vivait un roi transformÃƒÆ’Ã‚Â© en grenouille, enfermÃƒÆ’Ã‚Â© par un sortilÃƒÆ’Ã‚Â¨ge mystÃƒÆ’Ã‚Â©rieux. Jadis noble et courageux, il passait ses journÃƒÆ’Ã‚Â©es sur les berges d'un ÃƒÆ’Ã‚Â©tang scintillant, regardant les nuages se reflÃƒÆ’Ã‚Â©ter dans l'eau et rÃƒÆ’Ã‚Âªvant de retrouver sa forme humaine.
Un jour, une petite princesse curieuse s'aventura prÃƒÆ’Ã‚Â¨s de l'ÃƒÆ’Ã‚Â©tang. Elle avait entendu parler de la lÃƒÆ’Ã‚Â©gende du roi grenouille, mais elle ne craignait pas les apparences. Avec douceur et courage, elle engagea la conversation avec le prince transformÃƒÆ’Ã‚Â©, ÃƒÆ’Ã‚Â©coutant ses histoires de royaumes lointains, de chÃƒÆ’Ã‚Â¢teaux majestueux et de crÃƒÆ’Ã‚Â©atures fantastiques.
En ÃƒÆ’Ã‚Â©change de sa gentillesse et de sa patience, le roi grenouille offrit une promesse : quiconque oserait l'aider avec un coeur pur pourrait briser le sort et voir le royaume s'illuminer d'une magie ancienne. La princesse accepta le dÃƒÆ’Ã‚Â©fi, rÃƒÆ’Ã‚Â©alisant que la confiance, le respect et le courage ÃƒÆ’Ã‚Â©taient souvent les clÃƒÆ’Ã‚Â©s pour libÃƒÆ’Ã‚Â©rer la magie cachÃƒÆ’Ã‚Â©e derriÃƒÆ’Ã‚Â¨re les apparences.`,
    },
  ];

  return {
    bonus,
    malus,
    surprise,
    contes,
    discardBonus: [],
    discardMalus: [],
    discardSurprise: [],
    discardContes: [],
  };
}










