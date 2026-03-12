import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';

import { getSafePlayers } from '../../../../setup/setup-service.helper';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { fixMojibakeDeep } from '../../../../../common/utils/mojibake';
import type {
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesCard,
} from '../model/contes-et-cacahuetes-state.entity';
import { CONTES_PAWNS } from '../model/contes-et-cacahuetes-pawns.data';

type ContesRuntimeMetadata = ContesCacahuetesMetadata & Record<string, unknown>;
@Injectable()
export class ContesCacahuetesSetupService {
  constructor(
    _core: GameCoreService,
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

    const metaBase: ContesCacahuetesMetadata = {
      pawns,
      tiles: buildNarratedCanonicalTiles(),
      positions,
      setupStarterId,
      decks: buildDecks(),
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
        keyOfGold: {},
      },
      winnerId: null,
    };
    const pendingInfo = this.setupFlow.createSequentialPawnPending({
      players: updatedPlayers,
      startPlayerId: setupStarterId,
      isAssigned: (playerId) => {
        const player = updatedPlayers.find((p) => p.id === playerId);
        return toText(player?.pawn).trim().length > 0;
      },
      pawns: pawns
        .filter((pawn) => {
          const used = new Set(
            updatedPlayers
              .map((p) => toText(p.pawn).trim())
              .filter((v) => v.length > 0),
          );
          return !used.has(pawn.id);
        })
        .map((pawn) => ({
          id: pawn.id,
          label: pawn.label,
          description: pawn.description,
        })),
      choiceLabelBuilder: (pawn) =>
        toText(pawn.description).trim().length > 0
          ? `${toText(pawn.label).trim()}: ${toText(pawn.description).trim()}`
          : toText(pawn.label).trim(),
      pawnDataMapper: (choice) => ({
        id: toText(choice.id).trim(),
        label: toText(choice.label).trim(),
        description: toText(choice.description).trim(),
      }),
    });
    const next: GameStateEntity = {
      ...baseState,
      players: updatedPlayers,
      phase: 'playing',
      pending: pendingInfo?.pending ?? null,
      turnIndex:
        pendingInfo?.turnIndex != null
          ? pendingInfo.turnIndex
          : baseState.turnIndex,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: pendingInfo?.playerId ?? setupStarterId,
        direction: 1,
      },
      metadata: {
        ...(baseState.metadata ?? {}),
        ...starterPick.meta,
        ...metaBase,
      },
    };
    return fixMojibakeDeep(next);
  }

  private getRuntimeMeta(state: GameStateEntity): ContesRuntimeMetadata {
    return (state.metadata ?? {}) as ContesRuntimeMetadata;
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

function buildNarratedCanonicalTiles(): ContesCacahuetesTile[] {
  const base = buildCanonicalTiles();
  const descriptions = [
    "Vous ouvrez le grand livre des contes, et un vent de magie emporte vos feuilles volantes Chaque pas vous rapproche d'histoires fantastiques, de surprises et de rires ÃƒÂ  profusion. L'aventure commence maintenant !",
    'Un coup de pouce magique ! La chance vous sourit, profitez-en.',
    null,
    'Le conte rÃƒÂ©serve toujours des rebondissements.',
    null,
    'Oups le conte vous joue un vilain tour.',
    null,
    'Une bonne fÃƒÂ©e passait par lÃƒÂ  et elle ÃƒÂ©tait de bonne humeur !',
    null,
    "Personne ne s'y attendait pas mÃƒÂªme vous !",
    null,
    'Tout ne se passe pas comme prÃƒÂ©vu dans les histoires',
    null,
    'Le vent tourne en votre faveur, avancez avec le sourire.',
    null,
    'Un ÃƒÂ©vÃƒÂ©nement ÃƒÂ©trange surgit de nulle part.',
    null,
    'Une pÃƒÂ©ripÃƒÂ©tie inattendue freine votre avancÃƒÂ©e.',
    null,
    'Une histoire bien racontÃƒÂ©e porte toujours chance.',
    null,
    'Tout peut arriver quand on tourne la page.',
    null,
    'MÃƒÂªme les hÃƒÂ©ros trÃƒÂ©buchent parfois.',
    null,
    'Vous trouvez un trÃƒÂ¨fle ÃƒÂ  quatre feuilles, ÃƒÂ©videmment !',
    null,
    'Le hasard adore se mÃƒÂªler aux histoires.',
    null,
    "Le sort s'emmÃƒÂªle et vous avec.",
    null,
    'Le conte vous applaudit. Ãƒâ‚¬ vous la rÃƒÂ©compense !',
    null,
    'Une surprise se cache entre les lignes.',
    null,
    'Le conte prend un tournant un peu grinÃƒÂ§ant.',
    null,
    'Les esprits du rÃƒÂ©cit vous encouragent chaleureusement.',
    null,
    'Le conte vous observe et agit !',
    null,
    'Une mauvaise surprise surgit entre deux pages.',
    null,
    'Un hÃƒÂ©ros bien prÃƒÂ©parÃƒÂ© mÃƒÂ©rite toujours un avantage.',
    null,
    "Rien n'est jamais figÃƒÂ© dans un bon rÃƒÂ©cit.",
    null,
    'Les chemins des lÃƒÂ©gendes ne sont pas toujours droits.',
    null,
    "La chance vous fait un clin d'oeil malicieux.",
    null,
    'Une surprise tombe pile au bon, ou, mauvais moment.',
    null,
    'Le destin vous teste courage !',
    null,
    'Un moment de gloire savourez-le !',
    null,
    'MÃƒÂªme ÃƒÂ  la fin, le conte aime faire durer le suspense.',
    null,
    "Vous atteignez le majestueux livre magique, ses pages scintillent et s'animent autour de vous... Les contes du monde entier vous saluent et vous couronnent MaÃƒÂ®tre ou MaÃƒÂ®tresse des histoires, hÃƒÂ©ros de cette aventure mÃƒÂ©morable !",
  ];
  const labels = [
    'Case DÃƒÂ©part',
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Surprise',
    null,
    'Case Malus',
    null,
    'Case Bonus',
    null,
    'Case Malus',
    null,
    'Case ArrivÃƒÂ©e',
  ];

  return base.map((tile, index) => {
    const label = labels[index];
    const description = descriptions[index];
    if (!label) {
      return tile;
    }
    return {
      ...tile,
      label,
      description: description ?? tile.description,
    };
  });
}

function buildDecks(): ContesCacahuetesMetadata['decks'] {
  const bonus: ContesCard[] = [
    {
      id: 1,
      type: 'bonus',
      title: `Bottes de sept lieues`,
      text: `Avancez de 2 cases supplÃƒÂ©mentaires. Ces bottes magiques vous font bondir loin devant !`,
    },
    {
      id: 2,
      type: 'bonus',
      title: `Parchemin EnchantÃƒÂ©`,
      text: `Si le rÃƒÂ©sultat ne vous plaÃƒÂ®t pas, vous pouvez relancer qu'une seule fois le dÃƒÂ©. Le vieux grimoire vous montre une autre possibilitÃƒÂ©.`,
    },
    {
      id: 3,
      type: 'bonus',
      title: `Amulette Protectrice`,
      text: `Gardez cette carte dans votre main. Elle vous protÃƒÂ¨ge d'un malus (valable une fois). Elle se dÃƒÂ©fausse aprÃƒÂ¨s usage.`,
    },
    {
      id: 4,
      type: 'bonus',
      title: `Cape d'InvisibilitÃƒÂ©`,
      text: `Si vous arrivez sur une case Malus, son effet est automatiquement ignorÃƒÂ© et vous avancez d'une case supplÃƒÂ©mentaire.`,
    },
    {
      id: 5,
      type: 'bonus',
      title: `PoussiÃƒÂ¨re de FÃƒÂ©e`,
      text: `Vous pouvez faire avancer un autre joueur de votre choix de 2 cases. Un geste d'amitiÃƒÂ© qui crÃƒÂ©e la magie.`,
    },
    {
      id: 6,
      type: 'bonus',
      title: `Haricot Magique`,
      text: `Un haricot magique vous propulse dans les airs ! Lancez le dÃƒÂ© maintenant : le rÃƒÂ©sultat obtenu est automatiquement doublÃƒÂ©.`,
    },
    {
      id: 7,
      type: 'bonus',
      title: `ClÃƒÂ© d'Or Universelle`,
      text: `Si vous tombez sur une case Conte, choisissez l'effet (bonus ou malus) pour un autre joueur de votre choix. La clÃƒÂ© vous donne le pouvoir de dÃƒÂ©cider.`,
    },
    {
      id: 8,
      type: 'bonus',
      title: `Ami LÃƒÂ©gendaire`,
      text: `Vous ÃƒÂªtes aidÃƒÂ© par un personnage magique ! Avancez de 3 cases.`,
    },
    {
      id: 9,
      type: 'bonus',
      title: `Pont Arc-en-ciel`,
      text: `Un pont magique apparaÃƒÂ®t ! Piochez une carte Bonus puis une carte Surprise, et appliquez leurs effets.`,
    },
    {
      id: 10,
      type: 'bonus',
      title: `Formule Magique`,
      text: `Choisissez un joueur et ÃƒÂ©changez votre prochain tour avec le sien (vous avancez ÃƒÂ  sa place, et inversement). Surprise garantie !`,
    },
    {
      id: 11,
      type: 'bonus',
      title: `FlÃƒÂ»te EnchantÃƒÂ©e`,
      text: `Tous les autres joueurs vous applaudissent : pendant leur prochain tour, ils avancent de 1 case seulement, mÃƒÂªme avec un grand dÃƒÂ©.`,
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
      text: `Un animal lÃƒÂ©gendaire vous emmÃƒÂ¨ne loin. Avancez de 5 cases, mais passez un tour au prochain lancÃƒÂ© de dÃƒÂ©.`,
    },
    {
      id: 14,
      type: 'bonus',
      title: `Feuille Magique`,
      text: `Gardez cette carte dans votre main : la prochaine fois que vous faites 1 au dÃƒÂ©, avancer de 4 cases ÃƒÂ  la place. Comme un coup de vent !`,
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
      title: `SortilÃƒÂ¨ge de Sommeil`,
      text: `Vous vous endormez comme la Belle au bois dormant. Passez un tour.`,
    },
    {
      id: 2,
      type: 'malus',
      title: `Ronce EnchevÃƒÂªtrÃƒÂ©e`,
      text: `Vous ÃƒÂªtes coincÃƒÂ© dans une forÃƒÂªt de ronces... Reculez de 2 cases.`,
    },
    {
      id: 3,
      type: 'malus',
      title: `Grimoire Capricieux`,
      text: `Vous lisez une formule ÃƒÂ  l'envers : ÃƒÂ©changez votre place avec le joueur le plus proche derriÃƒÂ¨re vous !`,
    },
    {
      id: 4,
      type: 'malus',
      title: `Pluie de Mots OubliÃƒÂ©s`,
      text: `Vous oubliez un passage de votre histoire. Lancez le dÃƒÂ© et avancez seulement de la moitiÃƒÂ© du chiffre obtenu.`,
    },
    {
      id: 5,
      type: 'malus',
      title: `Loup dans la ForÃƒÂªt`,
      text: `Un grand mÃƒÂ©chant loup surgit ! Vous devez attendre qu'un autre joueur atteigne ou dÃƒÂ©passe votre case pour pouvoir rejouer.`,
    },
    {
      id: 6,
      type: 'malus',
      title: `Sable Mouvant Magique`,
      text: `Vous vous enfoncez dans une ÃƒÂ©trange plage mouvante. Passez deux tours.`,
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
      text: `Les histoires s'emmÃƒÂªlent ! Avancez de 3 cases... puis reculez de 4. Zut, ce n'ÃƒÂ©tait pas dans cet ordre-lÃƒÂ  !`,
    },
    {
      id: 9,
      type: 'malus',
      title: `Maladresse de Sorcier`,
      text: `Vous cassez votre baguette magique. Piochez une carte Bonus puis donnez-la ÃƒÂ  un autre joueur de votre choix.`,
    },
    {
      id: 10,
      type: 'malus',
      title: `Ombre Farceuse`,
      text: `Une crÃƒÂ©ature invisible vous embÃƒÂªte... Relancez votre dÃƒÂ©, mais cette fois, reculez au lieu d'avancer.`,
    },
    {
      id: 11,
      type: 'malus',
      title: `Ãƒâ€°nigme Infernale`,
      text: `Vous ÃƒÂªtes bloquÃƒÂ© par un sphinx rusÃƒÂ© ! Pour continuer, lancez le dÃƒÂ© : si vous obtenez un 4 ou plus, avancez normalement. Sinon, passez un tour.`,
    },
    {
      id: 12,
      type: 'malus',
      title: `Passage Obscur`,
      text: `Vous entrez dans un tunnel sombre. Retournez ÃƒÂ  la case Malus prÃƒÂ©cÃƒÂ©dente et revivez son effet.`,
    },
    {
      id: 13,
      type: 'malus',
      title: `Chaussures EnchantÃƒÂ©es... mais trop petites`,
      text: `Reculez de deux cases pour changer de chaussures. AÃƒÂ¯e !`,
    },
    {
      id: 14,
      type: 'malus',
      title: `Miroir BrisÃƒÂ©`,
      text: `Un miroir magique vous renvoie ÃƒÂ  votre passÃƒÂ©. Retournez ÃƒÂ  la case dÃƒÂ©part.`,
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
      text: `Un personnage cÃƒÂ©lÃƒÂ¨bre d'un autre conte apparaÃƒÂ®t ! Piochez une carte Bonus.`,
    },
    {
      id: 4,
      type: 'surprise',
      title: `Coffre aux Merveilles`,
      text: `Vous ouvrez un vieux coffre enchantÃƒÂ©. Tirez deux cartes au hasard (Bonus, Malus ou Surprise) et appliquez-les toutes les deux.`,
    },
    {
      id: 5,
      type: 'surprise',
      title: `PoussiÃƒÂ¨re de Rire`,
      text: `Un nuage de poussiÃƒÂ¨re de rire se rÃƒÂ©pand ! Chaque joueur lance un petit dÃƒÂ© de 1 ÃƒÂ  3. Celui qui a le plus grand avance d'une case. Remarque : s'il y a execo, au chiffre trois, ils avancent ensemble.`,
    },
    {
      id: 6,
      type: 'surprise',
      title: `TempÃƒÂªte de Pages`,
      text: `Un vent magique emporte les histoires ! Choisissez un autre joueur et ÃƒÂ©changez vos positions sur le plateau.`,
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
      title: `Livre ÃƒÂ  l'Envers`,
      text: `Vous lisez une histoire ÃƒÂ  l'envers. Votre prochain tour se fait en reculant.`,
    },
    {
      id: 9,
      type: 'surprise',
      title: `Chanson EnchantÃƒÂ©e`,
      text: `Une mÃƒÂ©lodie magique rÃƒÂ©sonne ! Choisissez : avancer de 3 cases ou prendre une carte Bonus ÃƒÂ  un autre joueur.`,
    },
    {
      id: 10,
      type: 'surprise',
      title: `Dragon de Papier`,
      text: `Un mini-dragon apparaÃƒÂ®t dans votre livre ! Il vous protÃƒÂ¨ge automatiquement de la prochaine carte Malus.`,
    },
    {
      id: 11,
      type: 'surprise',
      title: `Conte Perdu`,
      text: `Vous dÃƒÂ©couvrez un conte inconnu. Piochez une nouvelle carte Conte, mÃƒÂªme si vous ÃƒÂªtes sur une case spÃƒÂ©ciale.`,
    },
    {
      id: 12,
      type: 'surprise',
      title: `Montre EnchantÃƒÂ©e`,
      text: `Relancez le dÃƒÂ©, puis reculez du nombre obtenu.`,
    },
    {
      id: 13,
      type: 'surprise',
      title: `Souhait Ãƒâ€°phÃƒÂ©mÃƒÂ¨re`,
      text: `Faites un vÃ…â€œu simple : avancer de 2 cases, ÃƒÂ©changer votre pion avec un autre joueur, ou tirer une carte Bonus (ÃƒÂ  vous de choisir).`,
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
      text: `Vous lisez un conte venu d'ailleurs. Ãƒâ€°changez votre place avec un autre joueur : vous restez sur place, et lui prend votre position puis avance d'une case.`,
    },
  ];

  const contes: ContesCard[] = [
    {
      id: 1,
      type: 'conte',
      title: `Conte - Japon : MomotarÃ…Â`,
      text: `Il ÃƒÂ©tait une fois, dans un petit village japonais bordÃƒÂ© de collines verdoyantes et de riviÃƒÂ¨res ÃƒÂ©tincelantes, un couple ÃƒÂ¢gÃƒÂ© qui vivait paisiblement.
Un jour, alors que la vieille dame lavait des vÃƒÂªtements dans la riviÃƒÂ¨re, elle dÃƒÂ©couvrit une ÃƒÂ©norme pÃƒÂªche flottant sur l'eau. Curieuse, elle la ramena chez elle. ÃƒÂ¬ leur grande surprise, en l'ouvrant, ils trouvÃƒÂ¨rent un petit garÃƒÂ§on robuste et joyeux ÃƒÂ  l'intÃƒÂ©rieur. Ils l'appelÃƒÂ¨rent MomotarÃ…Â, le garÃƒÂ§on-pÃƒÂªche.
Grandissant avec force et courage, MomotarÃ…Â apprit qu'au loin, sur une ÃƒÂ®le mystÃƒÂ©rieuse, des oni (dÃƒÂ©mons malicieux) semaient la terreur parmi les habitants. DÃƒÂ©terminÃƒÂ© ÃƒÂ  protÃƒÂ©ger son village, il partit ÃƒÂ  l'aventure, emportant avec lui des kibi dango (des petites boules de millet sucrÃƒÂ©es) pour convaincre des compagnons de le suivre.
Sur son chemin, il rencontra un chien fidÃƒÂ¨le, un singe polyvalent et un faisan majestueux. Chacun, sÃƒÂ©duit par les kibi dango et la dÃƒÂ©termination de l'enfant, devint son alliÃƒÂ© loyal. Ensemble, ils traversÃƒÂ¨rent les eaux tumultueuses et atteignirent l'ÃƒÂ®le des oni.
GrÃƒÂ¢ce ÃƒÂ  leur courage, leur ruse et la force de l'amitiÃƒÂ©, ils vainquirent les dÃƒÂ©mons, rÃƒÂ©cupÃƒÂ©rÃƒÂ¨rent les trÃƒÂ©sors volÃƒÂ©s et ramenÃƒÂ¨rent la paix dans le village. MomotarÃ…Â, hÃƒÂ©ros humble et courageux, reÃƒÂ§ut la gratitude ÃƒÂ©ternelle de son peuple, et son histoire continua de se raconter au fil des gÃƒÂ©nÃƒÂ©rations.`,
    },
    {
      id: 2,
      type: 'conte',
      title: `Conte - SÃƒÂ©nÃƒÂ©gal : Le liÃƒÂ¨vre et l'hyÃƒÂ¨ne`,
      text: `Dans les vastes savanes du SÃƒÂ©nÃƒÂ©gal, oÃƒÂ¹ les baobabs se dressent comme des gÃƒÂ©ants silencieux et oÃƒÂ¹ le soleil ÃƒÂ©claire la terre d'un ÃƒÂ©clat dorÃƒÂ©, vivait un liÃƒÂ¨vre malin et rusÃƒÂ©, connu pour ses tours et ses farces. Non loin de lÃƒÂ , la hyÃƒÂ¨ne, grande et gourmande, rÃƒÂªvait toujours de le piÃƒÂ©ger pour le manger.
Un jour, cette derniÃƒÂ¨re dÃƒÂ©cida de tendre un piÃƒÂ¨ge ingÃƒÂ©nieux au liÃƒÂ¨vre. Mais le petit animal, vif comme le vent sur la savane, devina la ruse. Avec son esprit rapide et ses pattes lÃƒÂ©gÃƒÂ¨res, il imagina un plan astucieux.
Il laissa derriÃƒÂ¨re lui des empreintes trompeuses, fit semblant de tomber dans un piÃƒÂ¨ge et conduisit la hyÃƒÂ¨ne ÃƒÂ  se coincer elle-mÃƒÂªme dans un buisson ÃƒÂ©pineux. Chaque farce ÃƒÂ©tait plus drÃƒÂ´le et surprenante que la prÃƒÂ©cÃƒÂ©dente, et bientÃƒÂ´t, mÃƒÂªme les autres animaux de la savane venaient applaudir les tours de ce dernier.
Mais le liÃƒÂ¨vre n'ÃƒÂ©tait pas cruel. Avec un sourire malicieux, il libÃƒÂ©ra la hyÃƒÂ¨ne, lui montrant que l'intelligence et la ruse pouvaient ÃƒÂªtre plus fortes que la force brute.
Et depuis ce jour, tous les habitants de la savane racontent encore les exploits de la crÃƒÂ©ature ÃƒÂ  grandes oreilles, hÃƒÂ©ros petit mais redoutablement malin.`,
    },
    {
      id: 3,
      type: 'conte',
      title: `Conte - Russie : Vassilissa la trÃƒÂ¨s belle`,
      text: `Au coeur des forÃƒÂªts enneigÃƒÂ©es de Russie, lÃƒÂ  oÃƒÂ¹ les pins s'ÃƒÂ©tiraient vers le ciel et oÃƒÂ¹ la neige crissait sous les pas, vivait Vassilissa, une jeune fille d'une beautÃƒÂ© ÃƒÂ©clatante et d'un coeur pur. Elle portait toujours avec elle une poupÃƒÂ©e de chiffon, cadeau de sa mÃƒÂ¨re disparue, qui semblait parler et donner des conseils secrets ÃƒÂ  celle qui savait ÃƒÂ©couter.
Orpheline, elle vivait avec sa mÃƒÂ©chante belle-mÃƒÂ¨re et ses deux demi-soeurs jalouses, qui ne cessaient de lui imposer des tÃƒÂ¢ches impossibles. Mais la poupÃƒÂ©e, animÃƒÂ©e d'une magie subtile, guidait Vassilissa et l'aidait ÃƒÂ  accomplir ses corvÃƒÂ©es avec habiletÃƒÂ© et intelligence.
Un jour, la belle-mÃƒÂ¨re, avide de se dÃƒÂ©barrasser d'elle, l'envoya chercher du feu chez la redoutable sorciÃƒÂ¨re Baba Yaga, cachÃƒÂ©e au fond de la forÃƒÂªt. Courageuse mais prudente, Vassilissa suivit les conseils de sa poupÃƒÂ©e, traversa ponts instables, riviÃƒÂ¨res glacÃƒÂ©es et crÃƒÂ©atures mystÃƒÂ©rieuses, et rÃƒÂ©ussit ÃƒÂ  accomplir les tÃƒÂ¢ches impossibles que la femme lui imposait.
GrÃƒÂ¢ce ÃƒÂ  sa ruse, sa patience et l'aide de la poupÃƒÂ©e magique, l'enfant revint saine et sauve, portant le feu comme un triomphe de sa bontÃƒÂ© et de son courage.
Depuis ce jour, les contes russes parlent encore de Vassilissa, la jeune fille qui triomphait toujours des ÃƒÂ©preuves avec intelligence et coeur pur.`,
    },
    {
      id: 4,
      type: 'conte',
      title: `Conte - Canada : L'ours gÃƒÂ©ant et l'enfant`,
      text: `Dans les forÃƒÂªts profondes du Canada, lÃƒÂ  oÃƒÂ¹ les riviÃƒÂ¨res scintillaient comme des rubans d'argent et oÃƒÂ¹ les montagnes se dressaient majestueusement, vivait un petit enfant curieux et courageux.
Un jour, alors qu'il explorait les bois en suivant le chant des oiseaux, il rencontra un ours gÃƒÂ©ant au pelage brun dorÃƒÂ©, imposant mais aux yeux d'une douceur surprenante.
L'animal, protecteur de la forÃƒÂªt, ÃƒÂ©tait sage et puissant, et il connaissait tous les secrets de la faune et de la flore. Il mit l'enfant ÃƒÂ  l'ÃƒÂ©preuve : il dÃƒÂ» traverser une riviÃƒÂ¨re tumultueuse, escalader une colline escarpÃƒÂ©e et comprendre le langage des oiseaux et des arbres. Mais chaque ÃƒÂ©preuve ÃƒÂ©tait en rÃƒÂ©alitÃƒÂ© un enseignement sur le courage, la patience et le respect de la nature.
Avec chaque ÃƒÂ©tape, le jeune garÃƒÂ§on comprit que la force ne rÃƒÂ©sidait pas seulement dans la taille ou la puissance, mais dans l'intelligence, l'empathie et le respect de son environnement. L'ours gÃƒÂ©ant, impressionnÃƒÂ© par son coeur pur et sa dÃƒÂ©termination, devint son alliÃƒÂ© et compagnon, le guidant ÃƒÂ  travers la forÃƒÂªt et lui transmettant les secrets anciens des crÃƒÂ©atures et de la terre.
Depuis ce jour, on raconte au Canada l'histoire de l'enfant qui marcha aux cÃƒÂ´tÃƒÂ©s de l'ours gÃƒÂ©ant, apprenant ÃƒÂ  ÃƒÂ©couter, ÃƒÂ  respecter et ÃƒÂ  devenir un vrai ami de la forÃƒÂªt.`,
    },
    {
      id: 5,
      type: 'conte',
      title: `Conte - Maroc : Le figuier magique`,
      text: `Au coeur des ruelles animÃƒÂ©es du Maroc, sous un ciel azur oÃƒÂ¹ le soleil ÃƒÂ©clairait les mosaÃƒÂ¯ques colorÃƒÂ©es, se trouvait un figuier ancien, immense et mystÃƒÂ©rieux, dont les branches semblaient toucher les nuages. On racontait que cet arbre n'ÃƒÂ©tait pas ordinaire : ses figues dorÃƒÂ©es ÃƒÂ©taient enchantÃƒÂ©es, capables d'exaucer les souhaits les plus sincÃƒÂ¨res.
Un enfant curieux et intrÃƒÂ©pide s'approcha un matin, attirÃƒÂ© par l'odeur sucrÃƒÂ©e des fruits et le bruissement des feuilles. Alors qu'il tendait la main pour cueillir une figue, l'arbre se mit ÃƒÂ  parler dans un murmure doux et rassurant, rÃƒÂ©vÃƒÂ©lant que seul celui qui possÃƒÂ©dait un coeur pur pouvait goÃƒÂ»ter ÃƒÂ  sa magie.
Pour prouver sa valeur, il devait faire preuve de courage, de gÃƒÂ©nÃƒÂ©rositÃƒÂ© et d'ingÃƒÂ©niositÃƒÂ© : partager ses trouvailles avec les habitants du village, aider les animaux de la place et rÃƒÂ©soudre des ÃƒÂ©nigmes laissÃƒÂ©es par les anciens du royaume. ÃƒÂ¬ chaque acte de bontÃƒÂ©, les figues du figuier brillaient plus fort, et l'enfant sentait une ÃƒÂ©nergie chaude et bienveillante parcourir ses doigts.
Finalement, ayant dÃƒÂ©montrÃƒÂ© sa sagesse et son coeur gÃƒÂ©nÃƒÂ©reux, il put cueillir une figue magique. Cette derniÃƒÂ¨re ne donnait pas seulement la chance ou la richesse, mais rÃƒÂ©vÃƒÂ©lait les secrets pour comprendre et respecter les gens, la nature et la magie qui se cache dans chaque geste quotidien.`,
    },
    {
      id: 6,
      type: 'conte',
      title: `Conte - Chine : La princesse ÃƒÂ©ventail`,
      text: `Dans les jardins impÃƒÂ©riaux baignÃƒÂ©s de brume matinale, oÃƒÂ¹ les lotus flottaient sur les bassins et oÃƒÂ¹ les pavillons aux toits dorÃƒÂ©s reflÃƒÂ©taient la lumiÃƒÂ¨re du soleil, vivait une princesse renommÃƒÂ©e pour sa beautÃƒÂ© et sa sagesse. Mais ce qui la distinguait le plus ÃƒÂ©tait son ÃƒÂ©ventail en soie brodÃƒÂ©e d'or et de jade, capable de contrÃƒÂ´ler le vent et de murmurer les secrets du ciel.
Un jour, une grande sÃƒÂ©cheresse frappa le royaume. Les riviÃƒÂ¨res s'assÃƒÂ©chÃƒÂ¨rent et les arbres perdirent leurs feuilles. La princesse, connue pour son coeur gÃƒÂ©nÃƒÂ©reux et sa dÃƒÂ©termination, prit son ÃƒÂ©ventail magique et s'avanÃƒÂ§a dans le jardin. Chaque mouvement de l'objet faisait danser la brise et onduler les nuages, et bientÃƒÂ´t, un vent doux et humide se leva, apportant la pluie salvatrice sur les champs dessÃƒÂ©chÃƒÂ©s.
Mais la princesse n'utilisait pas sa magie uniquement pour des miracles visibles : elle enseignait aux villageois l'importance de la patience, de la sagesse et du respect pour la nature, leur montrant que chaque geste, mÃƒÂªme petit, pouvait faire naÃƒÂ®tre le changement.
GrÃƒÂ¢ce ÃƒÂ  elle, les riviÃƒÂ¨res reprirent vie, les fleurs s'ÃƒÂ©panouirent et les enfants jouaient ÃƒÂ  l'ombre des cerisiers en fleurs, tout en ÃƒÂ©coutant les histoires que soufflait le vent de son ÃƒÂ©ventail.`,
    },
    {
      id: 7,
      type: 'conte',
      title: `Conte - Irlande : Le gÃƒÂ©ant Fionn et Benandonner`,
      text: `Dans les collines verdoyantes et brumeuses d'Irlande, lÃƒÂ  oÃƒÂ¹ les moutons paissaient paisiblement et oÃƒÂ¹ le vent portait le parfum de l'herbe fraÃƒÂ®che, vivait un jeune gÃƒÂ©ant nommÃƒÂ© Fionn. Curieux et courageux, il adorait explorer les landes et ÃƒÂ©couter les histoires des anciens, apprenant les lÃƒÂ©gendes des druides et des guerriers d'antan.
Un matin, il entendit parler d'un gÃƒÂ©ant colossal nommÃƒÂ© Benandonner, qui vivait de l'autre cÃƒÂ´tÃƒÂ© de la mer et terrorisait les villages de ses pas gigantesques. DÃƒÂ©terminÃƒÂ© ÃƒÂ  protÃƒÂ©ger son pays et ÃƒÂ  prouver son courage, Fionn dÃƒÂ©cida de se rendre ÃƒÂ  la rencontre de ce dernier.
Mais Fionn ÃƒÂ©tait malin et rusÃƒÂ© : lorsqu'il le croisa, il remarqua que le gÃƒÂ©ant ÃƒÂ©tait ÃƒÂ©norme et redoutable, mais qu'il se moquait de sa propre force lorsqu'il rit de ses erreurs. Fionn usa alors de ruse et d'astuce. Il fit croire ÃƒÂ  Benandonner qu'il ÃƒÂ©tait un gÃƒÂ©ant encore plus puissant, et par une sÃƒÂ©rie de jeux d'ombres et de tromperies, il rÃƒÂ©ussit ÃƒÂ  faire fuir la crÃƒÂ©ature vers l'autre cÃƒÂ´tÃƒÂ© de la mer.
Depuis ce jour, Fionn devint le protecteur des collines irlandaises, et les villageois racontent encore comment un jeune gÃƒÂ©ant malin avait surpassÃƒÂ© un de ses congÃƒÂ©naires terrible, transformant la peur en lÃƒÂ©gende et le danger en histoire ÃƒÂ  raconter autour du feu.`,
    },
    {
      id: 8,
      type: 'conte',
      title: `Conte - PÃƒÂ©rou : Le colibri courageux`,
      text: `Dans les hauteurs vertigineuses des Andes pÃƒÂ©ruviennes, lÃƒÂ  oÃƒÂ¹ les sommets effleurent les nuages et oÃƒÂ¹ les torrents grondent dans les vallÃƒÂ©es, vivait un petit colibri au plumage ÃƒÂ©clatant. Bien que minuscule et fragile face aux montagnes imposantes et aux dangers qui rÃƒÂ´daient, ce colibri avait un courage qui dÃƒÂ©passait sa taille.
Un jour, un incendie ÃƒÂ©clata dans la forÃƒÂªt qui nourrissait la faune et la flore des montagnes. Les grandes crÃƒÂ©atures s'effrayaient, et personne n'osait s'approcher des flammes. Mais le petit colibri, dÃƒÂ©terminÃƒÂ© ÃƒÂ  protÃƒÂ©ger la vie autour de lui, vola droit vers le feu. Il transportait de minuscules gouttes d'eau dans son bec, tombant sans relÃƒÂ¢che sur les flammes.
MalgrÃƒÂ© la chaleur et la fatigue, le colibri ne cÃƒÂ©da jamais. Les autres animaux, inspirÃƒÂ©s par sa dÃƒÂ©termination et son courage, commencÃƒÂ¨rent ÃƒÂ  l'aider. Ensemble, ils parvinrent ÃƒÂ  ÃƒÂ©teindre l'incendie, sauvant ainsi la forÃƒÂªt et tous ses habitants.
Depuis ce jour, le colibri est cÃƒÂ©lÃƒÂ©brÃƒÂ© dans les lÃƒÂ©gendes pÃƒÂ©ruviennes comme le symbole du courage et de la persÃƒÂ©vÃƒÂ©rance, prouvant que mÃƒÂªme les plus petits peuvent accomplir de grands exploits si leur coeur est vaillant.`,
    },
    {
      id: 9,
      type: 'conte',
      title: `Conte - Ãƒâ€°gypte : Le secret du Nil`,
      text: `Au coeur de l'Ãƒâ€°gypte ancienne, lÃƒÂ  oÃƒÂ¹ le Nil serpentait comme un ruban bleu entre les sables dorÃƒÂ©s, se trouvait un village paisible dont les habitants vivaient en harmonie avec le fleuve sacrÃƒÂ©. On racontait qu'au crÃƒÂ©puscule, lorsque le soleil baignait les rives d'une lumiÃƒÂ¨re d'or, le Nil rÃƒÂ©vÃƒÂ©lait ses secrets aux coeurs courageux.
Un jeune garÃƒÂ§on du village, curieux et intrÃƒÂ©pide, rÃƒÂªvait de dÃƒÂ©couvrir ce mystÃƒÂ¨re. Chaque soir, il s'asseyait au bord de l'eau, ÃƒÂ©coutant le murmure des vagues et observant les reflets dansants du soleil. Une nuit, le fleuve sembla s'animer, et une lumiÃƒÂ¨re scintillante surgit ÃƒÂ  la surface.
GuidÃƒÂ© par cette lueur, l'enfant navigua sur une petite barque, dÃƒÂ©couvrant une ÃƒÂ®le cachÃƒÂ©e oÃƒÂ¹ les plantes et les animaux semblaient parler entre eux. LÃƒÂ , un ancien esprit du Nil lui confia que le secret de la vie rÃƒÂ©sidait dans l'ÃƒÂ©quilibre et le respect de la nature, dans la maniÃƒÂ¨re dont le fleuve nourrissait la terre et les hommes, jour aprÃƒÂ¨s jour.
De retour au village, le jeune homme partagea cette sagesse : il enseigna aux habitants ÃƒÂ  ÃƒÂ©couter le fleuve et ÃƒÂ  protÃƒÂ©ger ses eaux, et le village prospÃƒÂ©ra comme jamais.
Depuis ce temps, le Nil est cÃƒÂ©lÃƒÂ©brÃƒÂ© non seulement pour ses eaux fertiles, mais aussi pour les secrets qu'il murmure ÃƒÂ  ceux qui savent regarder et ÃƒÂ©couter.`,
    },
    {
      id: 10,
      type: 'conte',
      title: `Conte - Australie : Tiddalik, la grenouille`,
      text: `Dans les vastes ÃƒÂ©tendues rouges de l'Australie, lÃƒÂ  oÃƒÂ¹ les eucalyptus s'ÃƒÂ©lanÃƒÂ§aient vers le ciel et oÃƒÂ¹ le sable chaud crissait sous les pieds, vivait Tiddalik, une grenouille pas comme les autres. Sa particularitÃƒÂ© ? Il pouvait boire toute l'eau du pays, et lorsqu'il ÃƒÂ©tait gourmand, il ne laissait aucune goutte pour les autres.
Un jour, il eut une soif insatiable et avala tous les lacs, riviÃƒÂ¨res et mares de la rÃƒÂ©gion. Les kangourous, les wombats, les perruches et les lÃƒÂ©zards se retrouvÃƒÂ¨rent sans une seule goutte d'eau. Le dÃƒÂ©sert, dÃƒÂ©jÃƒÂ  chaud, devint impitoyable, et les animaux ÃƒÂ©taient au bord du dÃƒÂ©sespoir.
Alors, ils dÃƒÂ©cidÃƒÂ¨rent d'unir leurs forces. Chaque animal essaya de le faire rire, car selon la lÃƒÂ©gende, rire faisait relÃƒÂ¢cher l'eau avalÃƒÂ©e par Tiddalik. Les oiseaux chantÃƒÂ¨rent de folles mÃƒÂ©lodies, les kangourous sautÃƒÂ¨rent en cadence, et les wombats se roulÃƒÂ¨rent dans le sable jusqu'ÃƒÂ  ce que Tiddalik ÃƒÂ©clate de rire, et en un instant, toute l'eau revint dans les riviÃƒÂ¨res et les lacs, rendant la vie ÃƒÂ  la terre et ÃƒÂ  ses habitants.
Depuis ce jour, on raconte que la grenouille veille sur l'eau, rappelant ÃƒÂ  tous que la gÃƒÂ©nÃƒÂ©rositÃƒÂ© et le partage sont essentiels ÃƒÂ  la survie de chacun.`,
    },
    {
      id: 11,
      type: 'conte',
      title: `Conte - Allemagne : Le joueur de flÃƒÂ»te de Hamelin`,
      text: `Dans la ville pittoresque d'Hamelin, aux maisons ÃƒÂ  colombages et aux ruelles pavÃƒÂ©es, un problÃƒÂ¨me inquiÃƒÂ©tant pesait sur les habitants : une invasion de rats qui dÃƒÂ©voraient les rÃƒÂ©coltes, envahissaient les maisons et troublaient le sommeil des habitants.
Un jour, un ÃƒÂ©trange joueur de flÃƒÂ»te fit son apparition. VÃƒÂªtu d'un manteau colorÃƒÂ© et tenant une flÃƒÂ»te aux reflets dorÃƒÂ©s, il proposa son aide contre une promesse : ÃƒÂªtre payÃƒÂ© gÃƒÂ©nÃƒÂ©reusement pour se dÃƒÂ©barrasser des rongeurs. DÃƒÂ©sespÃƒÂ©rÃƒÂ©s, les habitants acceptÃƒÂ¨rent.
Le joueur de flÃƒÂ»te leva son instrument ÃƒÂ  ses lÃƒÂ¨vres et une mÃƒÂ©lodie envoÃƒÂ»tante s'ÃƒÂ©leva dans l'air. Les rats, charmÃƒÂ©s et hypnotisÃƒÂ©s, le suivirent sans un bruit. Ils sortirent de chaque maison, de chaque cave et de chaque recoin, marchant derriÃƒÂ¨re lui jusqu'ÃƒÂ  la riviÃƒÂ¨re, oÃƒÂ¹ ils disparurent ÃƒÂ  jamais.
Mais, hÃƒÂ©las, une fois sa mission accomplie, les habitants refusÃƒÂ¨rent de le payer comme convenu. Furieux, le joueur de flÃƒÂ»te joua de nouveau une mÃƒÂ©lodie magique, et cette fois-ci, les enfants d'Hamelin furent emportÃƒÂ©s par la musique, marchant derriÃƒÂ¨re lui hors de la ville, comme les rats autrefois, laissant derriÃƒÂ¨re eux une ville silencieuse et pleine de remords.`,
    },
    {
      id: 12,
      type: 'conte',
      title: `Conte - Inde : Le prince au cobra`,
      text: `Dans un royaume lointain d'Inde, aux palais aux dÃƒÂ´mes dorÃƒÂ©s et aux jardins luxuriants, vivait un jeune prince courageux. Sa curiositÃƒÂ© et son courage le poussaient souvent ÃƒÂ  explorer les forÃƒÂªts et les riviÃƒÂ¨res qui entouraient son palais.
Un jour, alors qu'il se promenait prÃƒÂ¨s d'un ÃƒÂ©tang sacrÃƒÂ©, il rencontra un cobra majestueux, aux ÃƒÂ©cailles scintillantes et aux yeux perÃƒÂ§ants. Mais ce n'ÃƒÂ©tait pas un serpent ordinaire : il pouvait parler et possÃƒÂ©dait des pouvoirs magiques anciens. Ce dernier expliqua au prince qu'un grand danger menaÃƒÂ§ait le royaume, et que seul un coeur pur et courageux pourrait dÃƒÂ©jouer ce sort.
Le prince accepta la mission. GrÃƒÂ¢ce aux conseils du reptile et ÃƒÂ  son intelligence, il traversa des ÃƒÂ©preuves mystÃƒÂ©rieuses : rÃƒÂ©soudre des ÃƒÂ©nigmes, franchir des ponts invisibles et affronter des illusions trompeuses. ÃƒÂ¬ chaque dÃƒÂ©fi, le cobra l'accompagnait, enseignant la patience, la prudence et le respect de la nature.
Finalement, grÃƒÂ¢ce ÃƒÂ  leur alliance, le prince rÃƒÂ©ussit ÃƒÂ  sauver le royaume et ÃƒÂ  ramener la paix et la prospÃƒÂ©ritÃƒÂ©. En signe de gratitude, le cobra se transforma en joyau magique, symbole de sagesse et de courage, que le prince porta toujours avec lui.`,
    },
    {
      id: 13,
      type: 'conte',
      title: `Conte - Groenland : L'ourse et la chasseuse`,
      text: `Au coeur des vastes glaces du Groenland, lÃƒÂ  oÃƒÂ¹ le vent hurlait et oÃƒÂ¹ la neige recouvrait tout, vivait une jeune chasseuse courageuse. Sa peau rosÃƒÂ©e par le froid et ses yeux perÃƒÂ§ants lui permettaient de repÃƒÂ©rer les moindres traces dans la neige immaculÃƒÂ©e.
Un matin, alors qu'elle suivait des empreintes mystÃƒÂ©rieuses, elle rencontra une grande ourse blanche, majestueuse et imposante, mais ÃƒÂ©tonnamment douce dans son regard. La crÃƒÂ©ature parlait un langage secret que seuls les habitants du Groenland pouvaient comprendre. Elle confia ÃƒÂ  la chasseuse une mission : protÃƒÂ©ger les animaux et les esprits de la glace d'un danger imminent.
La chasseuse accepta. Ensemble, elles traversÃƒÂ¨rent des fjords gelÃƒÂ©s, escaladÃƒÂ¨rent des montagnes couvertes de neige et affrontÃƒÂ¨rent les tempÃƒÂªtes polaires. Chaque pas ÃƒÂ©tait un dÃƒÂ©fi, mais la prÃƒÂ©sence de l'ourse la guidait et la protÃƒÂ©geait. La chasseuse apprit ÃƒÂ  ÃƒÂ©couter la nature, ÃƒÂ  comprendre les murmures des vents et le chant des aurores borÃƒÂ©ales.
ÃƒÂ¬ la fin de leur pÃƒÂ©riple, la chasseuse avait non seulement sauvÃƒÂ© les crÃƒÂ©atures du Groenland, mais elle avait aussi tissÃƒÂ© un lien indestructible avec l'ourse, qui devint sa protectrice ÃƒÂ©ternelle.
Les habitants du village racontent encore que, lorsque la neige tombe doucement, on peut voir l'ourse et la chasseuse parcourir les ÃƒÂ©tendues glacÃƒÂ©es, unies par un courage et une amitiÃƒÂ© hors du commun.`,
    },
    {
      id: 14,
      type: 'conte',
      title: `Conte - Italie : GiufÃƒÂ  et l'ÃƒÂ¢ne`,
      text: `Dans un petit village ensoleillÃƒÂ© d'Italie, au pied des collines et entre les oliveraies, vivait GiufÃƒÂ , un garÃƒÂ§on malin et plein de malice. Il possÃƒÂ©dait un ÃƒÂ¢ne tÃƒÂªtu mais attachant, qui semblait parfois comprendre mieux que GiufÃƒÂ  lui-mÃƒÂªme.
Un jour, le village organisa une fÃƒÂªte et le jeune homme fut chargÃƒÂ© de conduire son animal au marchÃƒÂ© pour y vendre des produits. Mais l'ÃƒÂ¢ne, espiÃƒÂ¨gle et obstinÃƒÂ©, refusait d'avancer droit et se mit ÃƒÂ  zigzaguer entre les rues pavÃƒÂ©es. GiufÃƒÂ  dut user de toute son ingÃƒÂ©niositÃƒÂ© pour le guider : il chanta de drÃƒÂ´les de chansons, fit des tours de magie et mÃƒÂªme des petites farces pour le distraire.
Finalement, grÃƒÂ¢ce ÃƒÂ  son esprit vif et ÃƒÂ  sa patience, il rÃƒÂ©ussit ÃƒÂ  le mener au marchÃƒÂ©. Les villageois, ÃƒÂ©merveillÃƒÂ©s par son habiletÃƒÂ© et amusÃƒÂ©s par les facÃƒÂ©ties de l'ÃƒÂ¢ne, le fÃƒÂ©licitÃƒÂ¨rent et racontÃƒÂ¨rent cette aventure longtemps aprÃƒÂ¨s.
GiufÃƒÂ  et son ÃƒÂ¢ne devinrent un symbole de ruse, de courage et de joie de vivre dans tout le village, rappelant que mÃƒÂªme face ÃƒÂ  des obstacles inattendus, l'intelligence et l'humour peuvent toujours triompher.`,
    },
    {
      id: 15,
      type: 'conte',
      title: `Conte - Kenya : Le feu volant`,
      text: `Dans les vastes plaines dorÃƒÂ©es du Kenya, lÃƒÂ  oÃƒÂ¹ le vent faisait onduler les hautes herbes et oÃƒÂ¹ les acacias dessinaient des ombres lÃƒÂ©gÃƒÂ¨res sur la terre chaude, vivait un jeune garÃƒÂ§on courageux nommÃƒÂ© Kibaru. Ses yeux noirs brillaient comme des braises et ses cheveux courts dansaient sous le soleil de midi.
Un soir, alors que le ciel se teintait d'orange et de pourpre, Kibaru aperÃƒÂ§ut un phÃƒÂ©nomÃƒÂ¨ne ÃƒÂ©trange : des flammes flottantes, comme des lucioles ardentes, qui s'ÃƒÂ©levaient dans les airs sans brÃƒÂ»ler les herbes ni les arbres. FascinÃƒÂ©, il dÃƒÂ©cida de les suivre. Chaque pas le menait plus loin, ÃƒÂ  travers riviÃƒÂ¨res et collines, guidÃƒÂ© par la lumiÃƒÂ¨re tremblante du feu volant.
Ces flammes, selon la lÃƒÂ©gende, ÃƒÂ©taient les esprits protecteurs de la savane, envoyÃƒÂ©s pour aider ceux qui montraient courage et bontÃƒÂ©. Kibaru dÃƒÂ©couvrit qu'en capturant leur lumiÃƒÂ¨re dans une petite calebasse, il pouvait transporter le feu d'un village ÃƒÂ  l'autre, permettant aux habitants de cuisiner, de s'ÃƒÂ©clairer et de se rÃƒÂ©chauffer, mÃƒÂªme lors des nuits les plus sombres.
Mais il devait ÃƒÂªtre prudent : le feu volant ÃƒÂ©tait capricieux. S'il devenait impatient, il s'envolait et disparaissait dans le ciel ÃƒÂ©toilÃƒÂ©.
GrÃƒÂ¢ce ÃƒÂ  sa patience et son respect pour les esprits, Kibaru apprit ÃƒÂ  danser avec les flammes, ÃƒÂ  les guider sans jamais les contraindre, transformant ainsi chaque nuit en un spectacle lumineux fascinant.`,
    },
    {
      id: 16,
      type: 'conte',
      title: `Conte - Chili : La lune et le renard`,
      text: `Dans les montagnes arides et mystÃƒÂ©rieuses du Chili, lÃƒÂ  oÃƒÂ¹ les sommets s'ÃƒÂ©lancent vers le ciel et oÃƒÂ¹ le vent murmure aux pierres, vivait un renard rusÃƒÂ© et curieux nommÃƒÂ© Chai. Son pelage roux flamboyant se fondait parfois avec les roches, et ses yeux dorÃƒÂ©s reflÃƒÂ©taient les ÃƒÂ©clats de la lune qui baignait les vallÃƒÂ©es chaque nuit.
Un jour, alors que la lune brillait plus intensÃƒÂ©ment que jamais, Chai, la regarda descendre du ciel et parler dans un souffle lÃƒÂ©ger :
Renard, si tu veux comprendre les secrets de la nuit, suis mes rayons et observe avec attention.
FascinÃƒÂ© et prudent, l'animal suivit la lueur argentÃƒÂ©e ÃƒÂ  travers les rochers, les riviÃƒÂ¨res scintillantes et les forÃƒÂªts clairsemÃƒÂ©es.
Au fil de son voyage nocturne, le renard comprit que la lune n'ÃƒÂ©clairait pas seulement la terre, mais rÃƒÂ©vÃƒÂ©lait ÃƒÂ©galement la vÃƒÂ©ritÃƒÂ© dans le coeur de ceux qui l'observaient. Chaque rayon lui enseignait la patience, l'humilitÃƒÂ© et la valeur de la curiositÃƒÂ© : apprendre ÃƒÂ  ÃƒÂ©couter le monde avant d'agir.
ÃƒÂ¬ la fin de son pÃƒÂ©riple, il rÃƒÂ©alisa que l'astre lui avait offert un cadeau invisible mais puissant : la sagesse de voir ce que les yeux seuls ne peuvent percevoir.
Depuis ce soir-lÃƒÂ , il partageait sa ruse et sa connaissance avec les autres animaux, devenant un guide respectÃƒÂ© dans les montagnes chiliennes.`,
    },
    {
      id: 17,
      type: 'conte',
      title: `Conte - France : Le Petit Poucet`,
      text: `Dans une forÃƒÂªt dense et mystÃƒÂ©rieuse de France, oÃƒÂ¹ les arbres s'ÃƒÂ©lanÃƒÂ§aient vers le ciel et oÃƒÂ¹ chaque ombre semblait abriter un secret, vivait un petit garÃƒÂ§on astucieux appelÃƒÂ© Poucet. Bien que minuscule de taille, son esprit ÃƒÂ©tait immense, et ses yeux pÃƒÂ©tillants d'intelligence brillaient ÃƒÂ  travers les feuilles des arbres comme deux ÃƒÂ©toiles dans la nuit.
Un soir, alors que la lune se glissait entre les branches, le petit bonhomme fut confrontÃƒÂ© ÃƒÂ  un grand danger : ses frÃƒÂ¨res et lui avaient ÃƒÂ©tÃƒÂ© abandonnÃƒÂ©s par leurs parents, perdus au coeur de la forÃƒÂªt. Mais Poucet, avec son courage et sa ruse, laissa tomber derriÃƒÂ¨re lui de petites pierres blanches qui brillaient sous la lune. Ainsi, ils purent retrouver leur chemin, pas ÃƒÂ  pas, guidÃƒÂ©s par le scintillement fragile mais constant des cailloux.
Plus tard, confrontÃƒÂ© au terrible ogre, l'enfant usa encore de son intelligence : il ÃƒÂ©changea les bonnets de ses frÃƒÂ¨res avec les siens, trompant l'ogre et sauvant sa famille grÃƒÂ¢ce ÃƒÂ  son audace et son esprit vif.`,
    },
    {
      id: 18,
      type: 'conte',
      title: `Conte - CorÃƒÂ©e du Sud : La grue reconnaissante`,
      text: `Dans un village tranquille de CorÃƒÂ©e, nichÃƒÂ© entre des collines verdoyantes et des riviÃƒÂ¨res scintillantes, vivait un homme pauvre mais au coeur gÃƒÂ©nÃƒÂ©reux. Un soir d'hiver, alors qu'il marchait seul sous le vent glacÃƒÂ©, il trouva une grue blessÃƒÂ©e, ses ailes froissÃƒÂ©es et ses plumes ÃƒÂ©bouriffÃƒÂ©es par la neige. PoussÃƒÂ© par la compassion, il la recueillit et prit soin d'elle avec patience et douceur, lui offrant chaleur et nourriture.
Quelques jours plus tard, l'oiseau disparut mystÃƒÂ©rieusement, mais bientÃƒÂ´t, une ÃƒÂ©trange femme silencieuse frappa ÃƒÂ  sa porte. Elle proposa de tisser pour lui de magnifiques ÃƒÂ©toffes, mais ÃƒÂ  une condition : il ne devait jamais regarder ce qu'elle faisait. Curieux mais respectueux, il accepta et bientÃƒÂ´t, il reÃƒÂ§ut des tissus d'une beautÃƒÂ© incroyable, faits de fil d'argent et de soie lumineuse.
Un soir, sa curiositÃƒÂ© le poussa ÃƒÂ  jeter un coup d'oeil, et il dÃƒÂ©couvrit que la femme n'ÃƒÂ©tait autre que la grue elle-mÃƒÂªme, transformÃƒÂ©e par reconnaissance pour sa bontÃƒÂ©. ImpressionnÃƒÂ© par sa fidÃƒÂ©litÃƒÂ© et son coeur pur, il comprit alors que la gÃƒÂ©nÃƒÂ©rositÃƒÂ© attirait toujours la magie et la reconnaissance sous des formes inattendues.`,
    },
    {
      id: 19,
      type: 'conte',
      title: `Conte - BrÃƒÂ©sil : La tortue et le jaguar`,
      text: `Au coeur de la forÃƒÂªt amazonienne, dense et vibrante de vie, vivait une tortue rusÃƒÂ©e et rÃƒÂ©flÃƒÂ©chie, toujours attentive aux moindres bruits et mouvements de la jungle.
Un jour, alors qu'elle se promenait prÃƒÂ¨s de la riviÃƒÂ¨re, elle rencontra un jaguar affamÃƒÂ©, majestueux et redoutable, dont le regard perÃƒÂ§ant trahissait l'envie de la dÃƒÂ©vorer.
La tortue, au lieu de cÃƒÂ©der ÃƒÂ  la panique, eut une idÃƒÂ©e brillante. Elle l'invita ÃƒÂ  participer ÃƒÂ  un concours : qui pourrait atteindre le vieux figuier au sommet de la colline avant l'autre ? Celui-ci, sÃƒÂ»r de sa rapiditÃƒÂ© et de sa force, accepta sans hÃƒÂ©siter.
Tout le long du chemin, la tortue avanÃƒÂ§ait lentement mais avec une ruse astucieuse : elle laissait des indices trompeurs, faisait semblant de se perdre, et utilisait les racines et les troncs pour ralentir le jaguar. Finalement, il arriva ÃƒÂ©puisÃƒÂ© et confus, tandis qu'elle, sans hÃƒÂ¢te mais avec intelligence, atteignit le figuier en premier.
Le fÃƒÂ©lin, impressionnÃƒÂ© et respectueux de l'ingÃƒÂ©niositÃƒÂ© de la tortue, renonÃƒÂ§a ÃƒÂ  sa faim et devint un alliÃƒÂ© inattendu, partageant avec elle la richesse de la forÃƒÂªt et les secrets des animaux.`,
    },
    {
      id: 20,
      type: 'conte',
      title: `Conte - Iran : Le tapis volant`,
      text: `Dans les bazars colorÃƒÂ©s et animÃƒÂ©s d'une ville ancienne de Perse, un jeune garÃƒÂ§on dÃƒÂ©couvrit un tapis ancien et poussiÃƒÂ©reux, cachÃƒÂ© derriÃƒÂ¨re des tissus et des lanternes scintillantes. Ce tapis n'ÃƒÂ©tait pas ordinaire : ses fils d'or et de soie s'animaient dÃƒÂ¨s qu'on posait un pied dessus, et il s'ÃƒÂ©levait dans les airs, prÃƒÂªt ÃƒÂ  emporter son voyageur vers des horizons insoupÃƒÂ§onnÃƒÂ©s.
Le garÃƒÂ§on, ÃƒÂ©merveillÃƒÂ© et un peu craintif, s'installa au centre du tapis. AussitÃƒÂ´t, il senti le vent caresser son visage et vit les ruelles se rÃƒÂ©trÃƒÂ©cir sous lui alors qu'il s'ÃƒÂ©levait au-dessus de la commune. Le tapis vola entre les minarets et les jardins suspendus, passant au-dessus des marchÃƒÂ©s parfumÃƒÂ©s et des fontaines chantantes.
Chaque mouvement du tapis ÃƒÂ©tait magique et fluide, comme guidÃƒÂ© par l'air lui-mÃƒÂªme. Il traversa des vallÃƒÂ©es dÃƒÂ©sertiques, survola des montagnes majestueuses, et emmena son passager dans des paysages merveilleusement variÃƒÂ©s, oÃƒÂ¹ les couleurs et les sons semblaient sortir d'un rÃƒÂªve.`,
    },
    {
      id: 21,
      type: 'conte',
      title: `Conte - ThaÃƒÂ¯lande : La mangue du roi`,
      text: `Dans le royaume verdoyant de ThaÃƒÂ¯lande, au coeur de jardins luxuriants et parfumÃƒÂ©s, un jeune garÃƒÂ§on s'approcha d'un arbre majestueux, le manguier du roi, dont les fruits ÃƒÂ©taient rÃƒÂ©putÃƒÂ©s plus sucrÃƒÂ©s et juteux que tous les autres. On raconte que celui qui goÃƒÂ»te une de ces mangues ressent la magie du royaume et obtient la sagesse et la chance.
Ce dernier, curieux et ÃƒÂ©merveillÃƒÂ©, tendit la main vers un fruit dorÃƒÂ© suspendu haut dans les branches. DÃƒÂ¨s qu'il toucha la mangue, un doux parfum tropical envahit l'air, et une lumiÃƒÂ¨re chaleureuse enveloppa ses doigts, comme si le soleil lui-mÃƒÂªme s'ÃƒÂ©tait glissÃƒÂ© dans l'arbre.
Soudain, le fruit se dÃƒÂ©tacha et descendit doucement, guidÃƒÂ© par un souffle magique, jusqu'ÃƒÂ  lui. En la goÃƒÂ»tant, il ressentit un ÃƒÂ©clat de bonheur et d'ÃƒÂ©nergie, voyant autour de lui les ÃƒÂ©lÃƒÂ©phants, les riziÃƒÂ¨res ÃƒÂ©tincelantes et les temples scintillants, tous baignÃƒÂ©s dans une lumiÃƒÂ¨re dorÃƒÂ©e.`,
    },
    {
      id: 22,
      type: 'conte',
      title: `Conte - Angleterre : Jack et le haricot magique`,
      text: `Dans un petit village anglais bordÃƒÂ© de collines verdoyantes, vivait Jack, un garÃƒÂ§on pauvre mais audacieux, qui partageait sa vie avec sa mÃƒÂ¨re dans une maisonnette en bois.
Un matin, la seule vache de la famille ne donna plus de lait. Sa mÃƒÂ¨re, inquiÃƒÂ¨te, demanda ÃƒÂ  son fils de la vendre au marchÃƒÂ© afin de survivre.
Sur le chemin, Jack rencontra un vieil homme mystÃƒÂ©rieux qui lui proposa d'ÃƒÂ©changer la vache contre quelques haricots extraordinaires, brillants et colorÃƒÂ©s, avec un ÃƒÂ©clat presque magique. L'enfant accepta, intriguÃƒÂ©. De retour ÃƒÂ  la maison, sa mÃƒÂ¨re, furieuse, jeta les haricots par la fenÃƒÂªtre.
La nuit tomba, et sous l'ÃƒÂ©clat de la lune, un haricot poussa, grandit jusqu'au ciel ! Il devint un immense haricot magique qui s'ÃƒÂ©leva au-dessus des nuages, vers un monde inconnu. Jack, courageux et curieux, dÃƒÂ©cida de grimper le long de cette liane vertigineuse.
Au sommet, il dÃƒÂ©couvrit un palais fantastique, abritant un ogre immense et des trÃƒÂ©sors fabuleux. Les sons du chÃƒÂ¢teau rÃƒÂ©sonnaient dans le vent : le tintement de piÃƒÂ¨ces d'or, le rugissement de l'ogre et les chants des oiseaux du ciel.
L'enfant, rusÃƒÂ© et audacieux, utilisa son intelligence et son courage afin de rÃƒÂ©cupÃƒÂ©rer les trÃƒÂ©sors et retrouver le chemin vers la maison, en faisant preuve d'ingÃƒÂ©niositÃƒÂ© et de bravoure.`,
    },
    {
      id: 23,
      type: 'conte',
      title: `Conte - Vietnam : L'enfant des riziÃƒÂ¨res`,
      text: `Dans un petit village nichÃƒÂ© au coeur des riziÃƒÂ¨res verdoyantes du Vietnam, vivait un enfant nommÃƒÂ© Minh, curieux et dÃƒÂ©bordant d'ÃƒÂ©nergie. Chaque matin, il parcourait les sentiers ÃƒÂ©troits entre les champs inondÃƒÂ©s, observant les reflets du soleil sur l'eau et ÃƒÂ©coutant le doux murmure du vent dans les palmiers.
Un jour, alors qu'il jouait prÃƒÂ¨s d'un petit ruisseau, il dÃƒÂ©couvrit un canard blessÃƒÂ©. Avec douceur et patience, il le soigna, s'occupant de ses ailes et de ses plumes trempÃƒÂ©es. L'animal, reconnaissant, devint son compagnon fidÃƒÂ¨le, l'accompagnant dans toutes ses aventures ÃƒÂ  travers les riziÃƒÂ¨res.
Mais ces terres regorgeaient de mystÃƒÂ¨res. Entre les brumes matinales, Minh aperÃƒÂ§ut des crÃƒÂ©atures ÃƒÂ©tranges et bienveillantes, qui semblaient garder les secrets des champs et des cours d'eau. Il apprit ÃƒÂ  comprendre le langage des animaux, ÃƒÂ  ÃƒÂ©couter les lÃƒÂ©gendes transmises par les anciens, et ÃƒÂ  respecter la magie qui imprÃƒÂ©gnait chaque ÃƒÂ©lÃƒÂ©ment de la nature.
Un jour, une inondation menaÃƒÂ§a les riziÃƒÂ¨res du village. GrÃƒÂ¢ce ÃƒÂ  son intelligence, son courage et l'aide de son fidÃƒÂ¨le canard, Minh parvint ÃƒÂ  guider les villageois et ÃƒÂ  protÃƒÂ©ger les champs. Sa bravoure devint une lÃƒÂ©gende locale, et l'enfant des riziÃƒÂ¨res fut cÃƒÂ©lÃƒÂ©brÃƒÂ© comme un hÃƒÂ©ros humble et sage, capable d'harmoniser le monde naturel et humain autour de lui.`,
    },
    {
      id: 24,
      type: 'conte',
      title: `Conte - Espagne : Le tambour enchantÃƒÂ©`,
      text: `Dans un petit village d'Espagne, nichÃƒÂ© entre les collines et les oliveraies, vivait un jeune garÃƒÂ§on nommÃƒÂ© Diego, passionnÃƒÂ© par la musique et les fÃƒÂªtes traditionnelles. Son instrument prÃƒÂ©fÃƒÂ©rÃƒÂ© ÃƒÂ©tait un vieux tambour en bois, transmis de gÃƒÂ©nÃƒÂ©ration en gÃƒÂ©nÃƒÂ©ration dans sa famille, dont les battements rÃƒÂ©sonnaient comme un coeur vibrant de vie et de lÃƒÂ©gendes.
Un soir, alors que le soleil se couchait derriÃƒÂ¨re les collines, Diego dÃƒÂ©couvrit que le tambour possÃƒÂ©dait des pouvoirs magiques : chaque rythme qu'il jouait faisait danser les animaux, les villageois, et mÃƒÂªme les ÃƒÂ©toiles dans le ciel. Ãƒâ€°merveillÃƒÂ©, il dÃƒÂ©cida de partager cette magie avec tout le village, et bientÃƒÂ´t, une fÃƒÂªte improvisÃƒÂ©e ÃƒÂ©clata, oÃƒÂ¹ chacun dansait et chantait, portÃƒÂ© par la musique enchantÃƒÂ©e du tambour.
Mais la magie n'ÃƒÂ©tait pas sans dÃƒÂ©fis. Les sons du tambour attirÃƒÂ¨rent ÃƒÂ©galement des esprits farceurs, qui cherchaient ÃƒÂ  troubler l'harmonie du village. Avec courage et ingÃƒÂ©niositÃƒÂ©, Diego apprit ÃƒÂ  jouer de douces mÃƒÂ©lodies, apaisant les esprits, ce qui renforÃƒÂ§a le lien entre les habitants, la faune et la flore.
GrÃƒÂ¢ce ÃƒÂ  son tambour enchantÃƒÂ©, Diego devint le gardien de la joie et des traditions, rappelant ÃƒÂ  tous que la musique pouvait unir les coeurs et transformer chaque journÃƒÂ©e en un moment extraordinaire.`,
    },
    {
      id: 25,
      type: 'conte',
      title: `Conte - HaÃƒÂ¯ti : Ti-Jean et le diable`,
      text: `Dans un village colorÃƒÂ© d'HaÃƒÂ¯ti, bordÃƒÂ© par des champs de canne ÃƒÂ  sucre et des collines verdoyantes, vivait un petit garÃƒÂ§on nommÃƒÂ© Ti-Jean, vif et malin, connu pour son esprit rusÃƒÂ© et son sourire espiÃƒÂ¨gle.
Un jour, alors qu'il cueillait des fruits prÃƒÂ¨s de la riviÃƒÂ¨re, le diable apparut, dÃƒÂ©cidÃƒÂ© ÃƒÂ  tester l'ingÃƒÂ©niositÃƒÂ© des humains et ÃƒÂ  attirer les ÃƒÂ¢mes naÃƒÂ¯ves dans ses tours diaboliques.
Mais Ti-Jean n'ÃƒÂ©tait pas un enfant ordinaire. Avec son intelligence, son courage et une bonne dose d'audace, il rÃƒÂ©ussit ÃƒÂ  tromper le diable ÃƒÂ  chaque ÃƒÂ©preuve. Que ce soit en ÃƒÂ©changeant des objets, en crÃƒÂ©ant des illusions ou en racontant des histoires confuses, ce dernier dÃƒÂ©joua les piÃƒÂ¨ges avec humour et ingÃƒÂ©niositÃƒÂ©.
ÃƒÂ¬ chaque dÃƒÂ©fi relevÃƒÂ©, il montrait que la ruse et la crÃƒÂ©ativitÃƒÂ© pouvaient vaincre mÃƒÂªme les plus grandes forces. Les villageois, ÃƒÂ©merveillÃƒÂ©s par ses exploits, racontaient ses aventures autour des feux de camp, et Ti-Jean devint un symbole de courage et de vivacitÃƒÂ©.`,
    },
    {
      id: 26,
      type: 'conte',
      title: `Conte - Turquie : Nasreddine et l'ÃƒÂ¢ne`,
      text: `Dans un petit village turc baignÃƒÂ© de soleil, aux ruelles ÃƒÂ©troites et aux marchÃƒÂ©s animÃƒÂ©s, vivait Nasreddine, un homme sage et espiÃƒÂ¨gle, connu pour son humour et ses rÃƒÂ©ponses pleines de bon sens. Un jour, alors qu'il chevauchait son fidÃƒÂ¨le ÃƒÂ¢ne, il croisa des villageois qui se moquaient de lui, le jugeant toujours un peu bizarre.
Mais Nasreddine ne se laissa jamais dÃƒÂ©stabiliser. Avec un sourire malicieux et une logique inattendue, il transforma chaque situation ridicule en une leÃƒÂ§on pleine d'esprit. Que ce soit en discutant avec les marchands, en rÃƒÂ©solvant des querelles ou en improvisant de drÃƒÂ´les d'histoires, il montrait que l'intelligence et l'humour ÃƒÂ©taient des armes plus puissantes que la force.
L'ÃƒÂ¢ne, fidÃƒÂ¨le compagnon de ses aventures, participait souvent involontairement aux tours et aux situations comiques, ajoutant encore plus de charme et de rires ÃƒÂ  chaque anecdote. Les villageois racontaient ensuite ses exploits dans les cafÃƒÂ©s et sous les arbres, riant des situations absurdes et admirant la sagacitÃƒÂ© de l'homme.`,
    },
    {
      id: 27,
      type: 'conte',
      title: `Conte - Nouvelle-ZÃƒÂ©lande : Maui ralentit le soleil`,
      text: `Dans les terres vertes et mystÃƒÂ©rieuses de la Nouvelle-ZÃƒÂ©lande, entre montagnes majestueuses et forÃƒÂªts denses, vivait Maui, un demi-dieu espiÃƒÂ¨gle aux exploits lÃƒÂ©gendaires. Un jour, voyant que les journÃƒÂ©es ÃƒÂ©taient trop courtes pour permettre aux hommes et aux femmes de finir leur travail, il dÃƒÂ©cida de ralentir le soleil.
Avec courage et ruse, il grimpa sur le sommet d'une montagne et lanÃƒÂ§a un lasso magique, fabriquÃƒÂ© ÃƒÂ  partir des cheveux de sa grand-mÃƒÂ¨re. Il attrapa le soleil, qui se dÃƒÂ©battait avec force, illuminant le ciel de sa lumiÃƒÂ¨re ÃƒÂ©clatante. GrÃƒÂ¢ce ÃƒÂ  son ingÃƒÂ©niositÃƒÂ© et sa dÃƒÂ©termination, Maui rÃƒÂ©ussit ÃƒÂ  ralentir sa course, offrant aux humains de longues journÃƒÂ©es pour pÃƒÂªcher, cultiver et profiter de la vie.
Ce geste hÃƒÂ©roÃƒÂ¯que n'ÃƒÂ©tait pas seulement un exploit physique, mais un acte plein de malice et d'ingÃƒÂ©niositÃƒÂ©, car l'homme savait que l'intelligence et la crÃƒÂ©ativitÃƒÂ© ÃƒÂ©taient des forces aussi puissantes que le courage.
Les habitants racontÃƒÂ¨rent encore et encore cette aventure, admirant le demi-dieu qui avait su apprivoiser le soleil lui-mÃƒÂªme.`,
    },
    {
      id: 28,
      type: 'conte',
      title: `Conte - Mali : L'hippopotame et les ÃƒÂ©toiles`,
      text: `Au bord du grand fleuve Niger, sous le ciel ÃƒÂ©toilÃƒÂ© du Mali, vivait un hippopotame curieux et rÃƒÂªveur. Chaque nuit, il regardait les ÃƒÂ©toiles briller et se demandait pourquoi elles semblaient si loin et inaccessibles. Les autres animaux riaient de ses rÃƒÂªveries, mais lui savait qu'un jour, il trouverait un moyen de toucher ces points lumineux qui scintillaient au-dessus de sa tÃƒÂªte.
Une nuit, guidÃƒÂ© par la lueur des astres, il entreprit un voyage extraordinaire, traversant riviÃƒÂ¨res et marÃƒÂ©cages, parlant aux lucioles et aux hiboux qui l'accompagnaient. Avec patience et courage, il construisit un bÃƒÂ¢ton magique, gravÃƒÂ© de symboles anciens et lumineux, qui lui permit de capturer un fragment d'ÃƒÂ©toile.
GrÃƒÂ¢ce ÃƒÂ  sa persÃƒÂ©vÃƒÂ©rance, l'hippopotame rÃƒÂ©alisa que mÃƒÂªme les rÃƒÂªves les plus grands pouvaient ÃƒÂªtre atteints si l'on osait avancer avec le coeur ouvert et l'esprit attentif.
Les ÃƒÂ©toiles, touchÃƒÂ©es par sa dÃƒÂ©termination, continuÃƒÂ¨rent de briller plus fort, illuminant le fleuve et inspirant tous les animaux et les humains qui vivaient autour de lui.`,
    },
    {
      id: 29,
      type: 'conte',
      title: `Conte - Pologne : Le roi grenouille`,
      text: `Dans une forÃƒÂªt ancienne et mystÃƒÂ©rieuse de Pologne, vivait un roi transformÃƒÂ© en grenouille, enfermÃƒÂ© par un sortilÃƒÂ¨ge mystÃƒÂ©rieux. Jadis noble et courageux, il passait ses journÃƒÂ©es sur les berges d'un ÃƒÂ©tang scintillant, regardant les nuages se reflÃƒÂ©ter dans l'eau et rÃƒÂªvant de retrouver sa forme humaine.
Un jour, une petite princesse curieuse s'aventura prÃƒÂ¨s de l'ÃƒÂ©tang. Elle avait entendu parler de la lÃƒÂ©gende du roi grenouille, mais elle ne craignait pas les apparences. Avec douceur et courage, elle engagea la conversation avec le prince transformÃƒÂ©, ÃƒÂ©coutant ses histoires de royaumes lointains, de chÃƒÂ¢teaux majestueux et de crÃƒÂ©atures fantastiques.
En ÃƒÂ©change de sa gentillesse et de sa patience, le roi grenouille offrit une promesse : quiconque oserait l'aider avec un coeur pur pourrait briser le sort et voir le royaume s'illuminer d'une magie ancienne. La princesse accepta le dÃƒÂ©fi, rÃƒÂ©alisant que la confiance, le respect et le courage ÃƒÂ©taient souvent les clÃƒÂ©s pour libÃƒÂ©rer la magie cachÃƒÂ©e derriÃƒÂ¨re les apparences.`,
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
