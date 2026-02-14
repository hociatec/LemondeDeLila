import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import type {
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesCard,
} from '../model/contes-et-cacahuetes-state.entity';

@Injectable()
export class ContesCacahuetesSetupService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly setupFlow: SetupFlowService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const pawnNames = [
      'Aika - Mongolie',
      'Freja - SuÃ¨de',
      'Lani - ÃŽles Marshall',
      'Niko - GÃ©orgie',
      'Tavi - Fidji',
      'Arman - ArmÃ©nie',
    ];
    const updatedPlayers = players.map((p) => {
      if (!p) return p as any;
      const pawn = typeof (p as any).pawn === 'string' ? String((p as any).pawn).trim() : '';
      return { ...p, pawn: pawn || '' };
    });
    const positions: Record<number, number> = {};
    for (const p of updatedPlayers) positions[p.id] = 0;
    const seedMeta = (baseState.metadata ?? {}) as any;
    const starterPick =
      updatedPlayers.length > 0
        ? this.random.nextInt(seedMeta, updatedPlayers.length)
        : { value: 0, meta: seedMeta };
    const setupStarterId =
      updatedPlayers.length > 0
        ? updatedPlayers[
            Math.max(0, Math.min(updatedPlayers.length - 1, starterPick.value))
          ]?.id ?? null
        : null;

    const metaBase: ContesCacahuetesMetadata = {
      tiles: buildTiles(),
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
    const pendingInfo = this.buildPawnPending(
      updatedPlayers as Array<{ id: number; username?: string; pawn?: string }>,
      pawnNames,
      setupStarterId,
    );
    let next: GameStateEntity = {
      ...baseState,
      players: updatedPlayers,
      phase: 'playing',
      pending: pendingInfo?.pending ?? null,
      turnIndex:
        pendingInfo?.turnIndex != null ? pendingInfo.turnIndex : baseState.turnIndex,
      turn: {
        ...(baseState.turn ?? { direction: 1 }),
        currentPlayerId: pendingInfo?.playerId ?? setupStarterId,
        direction: 1,
      },
      metadata: { ...(baseState.metadata ?? {}), ...starterPick.meta, ...metaBase },
    };
    if (pendingInfo?.playerId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, pendingInfo.playerId)} doit choisir un pion.`,
      );
    }
    return next;
  }

  private buildPawnPending(
    players: Array<{ id: number; username?: string; pawn?: string }>,
    pawnNames: string[],
    startId: number | null,
  ): { pending: any; playerId: number; turnIndex: number } | null {
    if (!players.length) return null;
    const used = new Set(
      players
        .map((p) => String(p?.pawn ?? '').trim())
        .filter((p) => p.length > 0),
    );
    const choices = pawnNames.filter((name) => !used.has(name));
    return this.setupFlow.createSequentialChoicePending({
      players,
      startPlayerId: startId,
      isAssigned: (playerId) => {
        const player = players.find((p) => p?.id === playerId);
        return String(player?.pawn ?? '').trim().length > 0;
      },
      pendingType: 'choose_pawn',
      choices: choices.map((name) => ({ id: name, label: name })),
      labelForPlayer: (playerLabel) => `C'est à ${playerLabel} de choisir son pion.`,
      dataBuilder: (availableChoices) => ({
        pawns: availableChoices.map((choice) => ({
          id: String(choice.id ?? '').trim(),
          label: String(choice.label ?? '').trim(),
        })),
      }),
    });
  }

  private playerName(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x: any) => x?.id === id);
    return this.playerNameFromEntry(p as any, id);
  }

  private playerNameFromEntry(
    player: { username?: string } | undefined,
    id: number,
  ): string {
    const name = String(player?.username ?? '').trim();
    return name || `Joueur ${id}`;
  }
}

function buildTiles(): ContesCacahuetesTile[] {
  return [
    {
      type: 'start',
      label:
        `Case DÃ©part - Vous ouvrez le grand livre des contes, et un vent de magie emporte vos feuilles volantesâ€¦ Chaque pas vous rapproche d'histoires fantastiques, de surprises et de rires Ã  profusion. L'aventure commence maintenant !`,
    },
    {
      type: 'bonus',
      label: `Case Bonus - Un coup de pouce magique ! La chance vous sourit, profitez-en.`,
    },
    { type: 'conte', label: `Case Conte - Japon : MomotarÅ` },
    { type: 'surprise', label: `Case Surprise - Le conte rÃ©serve toujours des rebondissements.` },
    { type: 'conte', label: `Case Conte - SÃ©nÃ©gal : Le liÃ¨vre et la hyÃ¨ne` },
    { type: 'malus', label: `Case Malus - Oupsâ€¦ le conte vous joue un vilain tour.` },
    { type: 'conte', label: `Case Conte - Russie : Vassilissa la trÃ¨s belle` },
    {
      type: 'bonus',
      label: `Case Bonus - Une bonne fÃ©e passait par lÃ â€¦ et elle Ã©tait de bonne humeur !`,
    },
    { type: 'conte', label: `Case Conte - Canada : L'ours gÃ©ant et l'enfant` },
    { type: 'surprise', label: `Case Surprise - Personne ne s'y attendaitâ€¦ pas mÃªme vous !` },
    { type: 'conte', label: `Case Conte - Maroc : Le figuier magique` },
    { type: 'malus', label: `Case Malus - Tout ne se passe pas comme prÃ©vu dans les histoiresâ€¦` },
    { type: 'conte', label: `Case Conte - Chine : La princesse Ã©ventail` },
    { type: 'bonus', label: `Case Bonus - Le vent tourne en votre faveur, avancez avec le sourire.` },
    { type: 'conte', label: `Case Conte - Irlande : Le gÃ©ant Fionn et Benandonner` },
    { type: 'surprise', label: `Case Surprise - Un Ã©vÃ©nement Ã©trange surgit de nulle part.` },
    { type: 'conte', label: `Case Conte - PÃ©rou : Le colibri courageux` },
    { type: 'malus', label: `Case Malus - Une pÃ©ripÃ©tie inattendue freine votre avancÃ©e.` },
    { type: 'conte', label: `Case Conte - Ã‰gypte : Le secret du Nil` },
    { type: 'bonus', label: `Case Bonus - Une histoire bien racontÃ©e porte toujours chance.` },
    { type: 'conte', label: `Case Conte - Australie : Tiddalik, la grenouille` },
    { type: 'surprise', label: `Case Surprise - Tout peut arriver quand on tourne la page.` },
    { type: 'conte', label: `Case Conte - Allemagne : Le joueur de flÃ»te d'Hamelin` },
    { type: 'malus', label: `Case Malus - MÃªme les hÃ©ros trÃ©buchent parfois.` },
    { type: 'conte', label: `Case Conte - Inde : Le prince au cobra` },
    { type: 'bonus', label: `Case Bonus - Vous trouvez un trÃ¨fleâ€¦ Ã  quatre feuilles, Ã©videmment !` },
    { type: 'conte', label: `Case Conte - Groenland : L'ourse et la chasseuse` },
    { type: 'surprise', label: `Case Surprise - Le hasard adore se mÃªler aux histoires.` },
    { type: 'conte', label: `Case Conte - Italie : GiufÃ  et l'Ã¢ne` },
    { type: 'malus', label: `Case Malus - Le sort s'emmÃªleâ€¦ et vous avec.` },
    { type: 'conte', label: `Case Conte - Kenya : Le feu volant` },
    { type: 'bonus', label: `Case Bonus - Le conte vous applaudit. Ã€ vous la rÃ©compense !` },
    { type: 'conte', label: `Case Conte - Chili : La lune et le renard` },
    { type: 'surprise', label: `Case Surprise - Une surprise se cache entre les lignes.` },
    { type: 'conte', label: `Case Conte - France : Le Petit Poucet` },
    { type: 'malus', label: `Case Malus - Le conte prend un tournant un peu grinÃ§ant.` },
    { type: 'conte', label: `Case Conte - CorÃ©e du Sud : La grue reconnaissante` },
    { type: 'bonus', label: `Case Bonus - Les esprits du rÃ©cit vous encouragent chaleureusement.` },
    { type: 'conte', label: `Case Conte - BrÃ©sil : La tortue et le jaguar` },
    { type: 'surprise', label: `Case Surprise - Le conte vous observeâ€¦ et agit !` },
    { type: 'conte', label: `Case Conte - Iran : Le tapis volant` },
    { type: 'malus', label: `Case Malus - Une mauvaise surprise surgit entre deux pages.` },
    { type: 'conte', label: `Case Conte - ThaÃ¯lande : La mangue du roi` },
    { type: 'bonus', label: `Case Bonus - Un hÃ©ros bien prÃ©parÃ© mÃ©rite toujours un avantage.` },
    { type: 'conte', label: `Case Conte - Angleterre : Jack et le haricot magique` },
    { type: 'surprise', label: `Case Surprise - Rien n'est jamais figÃ© dans un bon rÃ©cit.` },
    { type: 'conte', label: `Case Conte - Vietnam : L'enfant des riziÃ¨res` },
    { type: 'malus', label: `Case Malus - Les chemins des lÃ©gendes ne sont pas toujours droits.` },
    { type: 'conte', label: `Case Conte - Espagne : Le tambour enchantÃ©` },
    { type: 'bonus', label: `Case Bonus - La chance vous fait un clin d'oeil malicieux.` },
    { type: 'conte', label: `Case Conte - HaÃ¯ti : Ti-Jean et le diable` },
    { type: 'surprise', label: `Case Surprise - Une surprise tombe pile au bon, ou, mauvais moment.` },
    { type: 'conte', label: `Case Conte - Turquie : Nasreddine et l'Ã¢ne` },
    { type: 'malus', label: `Case Malus - Le destin vous testeâ€¦ courage !` },
    { type: 'conte', label: `Case Conte - Nouvelle-ZÃ©lande : Maui ralentit le soleil` },
    { type: 'bonus', label: `Case Bonus - Un moment de gloireâ€¦ savourez-le !` },
    { type: 'conte', label: `Case Conte - Mali : L'hippopotame et les Ã©toiles` },
    { type: 'malus', label: `Case Malus - MÃªme Ã  la fin, le conte aime faire durer le suspense.` },
    { type: 'conte', label: `Case Conte - Pologne : Le roi grenouille` },
    {
      type: 'finish',
      label:
        `Case ArrivÃ©e - Vous atteignez le majestueux livre magique, ses pages scintillent et s'animent autour de vous... Les contes du monde entier vous saluent et vous couronnent MaÃ®tre ou MaÃ®tresse des histoires, hÃ©ros de cette aventure mÃ©morable !`,
    },
  ];
}


function buildDecks(): ContesCacahuetesMetadata['decks'] {
  const bonus: ContesCard[] = [
    {
      id: 1,
      type: 'bonus',
      title: `Bottes de sept lieues`,
      text: `Avancez de 2 cases supplÃ©mentaires. Ces bottes magiques vous font bondir loin devant !`,
    },
    {
      id: 2,
      type: 'bonus',
      title: `Parchemin EnchantÃ©`,
      text: `Si le rÃ©sultat ne vous plaÃ®t pas, vous pouvez relancer quâ€™une seule fois le dÃ©. Le vieux grimoire vous montre une autre possibilitÃ©.`,
    },
    {
      id: 3,
      type: 'bonus',
      title: `Amulette Protectrice`,
      text: `Gardez cette carte dans votre main. Elle vous protÃ¨ge dâ€™un malus (valable une fois). Elle se dÃ©fausse aprÃ¨s usage.`,
    },
    {
      id: 4,
      type: 'bonus',
      title: `Cape dâ€™InvisibilitÃ©`,
      text: `Si vous arrivez sur une case Malus, son effet est automatiquement ignorÃ© et vous avancez dâ€™une case supplÃ©mentaire.`,
    },
    {
      id: 5,
      type: 'bonus',
      title: `PoussiÃ¨re de FÃ©e`,
      text: `Vous pouvez faire avancer un autre joueur de votre choix de 2 cases. Un geste dâ€™amitiÃ© qui crÃ©e la magie.`,
    },
    {
      id: 6,
      type: 'bonus',
      title: `Haricot Magique`,
      text: `Un haricot magique vous propulse dans les airs ! Lancez le dÃ© maintenant : le rÃ©sultat obtenu est automatiquement doublÃ©.`,
    },
    {
      id: 7,
      type: 'bonus',
      title: `ClÃ© dâ€™Or Universelle`,
      text: `Si vous tombez sur une case Conte, choisissez lâ€™effet (bonus ou malus) pour un autre joueur de votre choix. La clÃ© vous donne le pouvoir de dÃ©cider.`,
    },
    {
      id: 8,
      type: 'bonus',
      title: `Ami LÃ©gendaire`,
      text: `Vous Ãªtes aidÃ© par un personnage magique ! Avancez de 3 cases.`,
    },
    {
      id: 9,
      type: 'bonus',
      title: `Pont Arc-en-ciel`,
      text: `Un pont magique apparaÃ®t ! Piochez une carte Bonus puis une carte Surprise, et appliquez leurs effets.`,
    },
    {
      id: 10,
      type: 'bonus',
      title: `Formule Magique`,
      text: `Choisissez un joueur et Ã©changez votre prochain tour avec le sien (vous avancez Ã  sa place, et inversement). Surprise garantie !`,
    },
    {
      id: 11,
      type: 'bonus',
      title: `FlÃ»te EnchantÃ©e`,
      text: `Tous les autres joueurs vous applaudissent : pendant leur prochain tour, ils avancent de 1 case seulement, mÃªme avec un grand dÃ©.`,
    },
    {
      id: 12,
      type: 'bonus',
      title: `Corne dâ€™Abondance`,
      text: `Piocher deux cartes Bonus mais gardez-en quâ€™une, la plus avantageuse. Un coup de chance rare !`,
    },
    {
      id: 13,
      type: 'bonus',
      title: `Monture Mystique`,
      text: `Un animal lÃ©gendaire vous emmÃ¨ne loin. Avancez de 5 cases, mais passez un tour au prochain lancÃ© de dÃ©.`,
    },
    {
      id: 14,
      type: 'bonus',
      title: `Feuille Magique`,
      text: `Gardez cette carte dans votre main : la prochaine fois que vous faites 1 au dÃ©, avancer de 4 cases Ã  la place. Comme un coup de vent !`,
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
      title: `SortilÃ¨ge de Sommeil`,
      text: `Vous vous endormez comme la Belle au bois dormant. Passez un tour.`,
    },
    {
      id: 2,
      type: 'malus',
      title: `Ronce EnchevÃªtrÃ©e`,
      text: `Vous Ãªtes coincÃ© dans une forÃªt de roncesâ€¦ Reculez de 2 cases.`,
    },
    {
      id: 3,
      type: 'malus',
      title: `Grimoire Capricieux`,
      text: `Vous lisez une formule Ã  lâ€™envers : Ã©changez votre place avec le joueur le plus proche derriÃ¨re vous !`,
    },
    {
      id: 4,
      type: 'malus',
      title: `Pluie de Mots OubliÃ©s`,
      text: `Vous oubliez un passage de votre histoire. Lancez le dÃ© et avancez seulement de la moitiÃ© du chiffre obtenu.`,
    },
    {
      id: 5,
      type: 'malus',
      title: `Loup dans la ForÃªt`,
      text: `Un grand mÃ©chant loup surgit ! Vous devez attendre quâ€™un autre joueur atteigne ou dÃ©passe votre case pour pouvoir rejouer.`,
    },
    {
      id: 6,
      type: 'malus',
      title: `Sable Mouvant Magique`,
      text: `Vous vous enfoncez dans une Ã©trange plage mouvante. Passez deux tours.`,
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
      text: `Les histoires sâ€™emmÃªlent ! Avancez de 3 casesâ€¦ puis reculez de 4. Zut, ce nâ€™Ã©tait pas dans cet ordre-lÃ  !`,
    },
    {
      id: 9,
      type: 'malus',
      title: `Maladresse de Sorcier`,
      text: `Vous cassez votre baguette magique. Piochez une carte Bonus puis donnez-la Ã  un autre joueur de votre choix.`,
    },
    {
      id: 10,
      type: 'malus',
      title: `Ombre Farceuse`,
      text: `Une crÃ©ature invisible vous embÃªteâ€¦ Relancez votre dÃ©, mais cette fois, reculez au lieu dâ€™avancer.`,
    },
    {
      id: 11,
      type: 'malus',
      title: `Ã‰nigme Infernale`,
      text: `Vous Ãªtes bloquÃ© par un sphinx rusÃ© ! Pour continuer, lancez le dÃ© : si vous obtenez un 4 ou plus, avancez normalement. Sinon, passez un tour.`,
    },
    {
      id: 12,
      type: 'malus',
      title: `Passage Obscur`,
      text: `Vous entrez dans un tunnel sombre. Retournez Ã  la case Malus prÃ©cÃ©dente et revivez son effet.`,
    },
    {
      id: 13,
      type: 'malus',
      title: `Chaussures EnchantÃ©esâ€¦ mais trop petites`,
      text: `Reculez de deux cases pour changer de chaussures. AÃ¯e !`,
    },
    {
      id: 14,
      type: 'malus',
      title: `Miroir BrisÃ©`,
      text: `Un miroir magique vous renvoie Ã  votre passÃ©. Retournez Ã  la case dÃ©part.`,
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
      text: `Une baguette magique sâ€™agite toute seule ! Avancez dâ€™une caseâ€¦ puis reculez de deux.`,
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
      text: `Un personnage cÃ©lÃ¨bre dâ€™un autre conte apparaÃ®t ! Piochez une carte Bonus.`,
    },
    {
      id: 4,
      type: 'surprise',
      title: `Coffre aux Merveilles`,
      text: `Vous ouvrez un vieux coffre enchantÃ©. Tirez deux cartes au hasard (Bonus, Malus ou Surprise) et appliquez-les toutes les deux.`,
    },
    {
      id: 5,
      type: 'surprise',
      title: `PoussiÃ¨re de Rire`,
      text: `Un nuage de poussiÃ¨re de rire se rÃ©pand ! Chaque joueur lance un petit dÃ© de 1 Ã  3. Celui qui a le plus grand avance dâ€™une case. Remarque : sâ€™il y a execo, au chiffre trois, ils avancent ensemble.`,
    },
    {
      id: 6,
      type: 'surprise',
      title: `TempÃªte de Pages`,
      text: `Un vent magique emporte les histoires ! Choisissez un autre joueur et Ã©changez vos positions sur le plateau.`,
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
      title: `Livre Ã  lâ€™Envers`,
      text: `Vous lisez une histoire Ã  lâ€™envers. Votre prochain tour se fait en reculant.`,
    },
    {
      id: 9,
      type: 'surprise',
      title: `Chanson EnchantÃ©e`,
      text: `Une mÃ©lodie magique rÃ©sonne ! Choisissez : avancer de 3 cases ou prendre une carte Bonus Ã  un autre joueur.`,
    },
    {
      id: 10,
      type: 'surprise',
      title: `Dragon de Papier`,
      text: `Un mini-dragon apparaÃ®t dans votre livre ! Il vous protÃ¨ge automatiquement de la prochaine carte Malus.`,
    },
    {
      id: 11,
      type: 'surprise',
      title: `Conte Perdu`,
      text: `Vous dÃ©couvrez un conte inconnu. Piochez une nouvelle carte Conte, mÃªme si vous Ãªtes sur une case spÃ©ciale.`,
    },
    {
      id: 12,
      type: 'surprise',
      title: `Montre EnchantÃ©e`,
      text: `Relancez le dÃ©, puis reculez du nombre obtenu.`,
    },
    {
      id: 13,
      type: 'surprise',
      title: `Souhait Ã‰phÃ©mÃ¨re`,
      text: `Faites un vÅ“u simple : avancer de 2 cases, Ã©changer votre pion avec un autre joueur, ou tirer une carte Bonus (Ã  vous de choisir).`,
    },
    {
      id: 14,
      type: 'surprise',
      title: `Filet Magique`,
      text: `Vous attrapez une carte Bonus ou Surprise dâ€™un autre joueur de votre choix.`,
    },
    {
      id: 15,
      type: 'surprise',
      title: `Grimoire Voyageur`,
      text: `Vous lisez un conte venu dâ€™ailleurs. Ã‰changez votre place avec un autre joueur : vous restez sur place, et lui prend votre position puis avance dâ€™une case.`,
    },
  ];

  const contes: ContesCard[] = [
    {
      id: 1,
      type: 'conte',
      title: `Conte - Japon : MomotarÅ`,
      text: `Il Ã©tait une fois, dans un petit village japonais bordÃ© de collines verdoyantes et de riviÃ¨res Ã©tincelantes, un couple Ã¢gÃ© qui vivait paisiblement.
Un jour, alors que la vieille dame lavait des vÃªtements dans la riviÃ¨re, elle dÃ©couvrit une Ã©norme pÃªche flottant sur l'eau. Curieuse, elle la ramena chez elle. Ã€ leur grande surprise, en l'ouvrant, ils trouvÃ¨rent un petit garÃ§on robuste et joyeux Ã  l'intÃ©rieur. Ils l'appelÃ¨rent MomotarÅ, le garÃ§on-pÃªche.
Grandissant avec force et courage, MomotarÅ apprit qu'au loin, sur une Ã®le mystÃ©rieuse, des oni (dÃ©mons malicieux) semaient la terreur parmi les habitants. DÃ©terminÃ© Ã  protÃ©ger son village, il partit Ã  l'aventure, emportant avec lui des kibi dango (des petites boules de millet sucrÃ©es) pour convaincre des compagnons de le suivre.
Sur son chemin, il rencontra un chien fidÃ¨le, un singe polyvalent et un faisan majestueux. Chacun, sÃ©duit par les kibi dango et la dÃ©termination de l'enfant, devint son alliÃ© loyal. Ensemble, ils traversÃ¨rent les eaux tumultueuses et atteignirent l'Ã®le des oni.
GrÃ¢ce Ã  leur courage, leur ruse et la force de l'amitiÃ©, ils vainquirent les dÃ©mons, rÃ©cupÃ©rÃ¨rent les trÃ©sors volÃ©s et ramenÃ¨rent la paix dans le village. MomotarÅ, hÃ©ros humble et courageux, reÃ§ut la gratitude Ã©ternelle de son peuple, et son histoire continua de se raconter au fil des gÃ©nÃ©rations.`,
    },
    {
      id: 2,
      type: 'conte',
      title: `Conte - SÃ©nÃ©gal : Le liÃ¨vre et lâ€™hyÃ¨ne`,
      text: `Dans les vastes savanes du SÃ©nÃ©gal, oÃ¹ les baobabs se dressent comme des gÃ©ants silencieux et oÃ¹ le soleil Ã©claire la terre d'un Ã©clat dorÃ©, vivait un liÃ¨vre malin et rusÃ©, connu pour ses tours et ses farces. Non loin de lÃ , la hyÃ¨ne, grande et gourmande, rÃªvait toujours de le piÃ©ger pour le manger.
Un jour, cette derniÃ¨re dÃ©cida de tendre un piÃ¨ge ingÃ©nieux au liÃ¨vre. Mais le petit animal, vif comme le vent sur la savane, devina la ruse. Avec son esprit rapide et ses pattes lÃ©gÃ¨res, il imagina un plan astucieux.
Il laissa derriÃ¨re lui des empreintes trompeuses, fit semblant de tomber dans un piÃ¨ge et conduisit la hyÃ¨ne Ã  se coincer elle-mÃªme dans un buisson Ã©pineux. Chaque farce Ã©tait plus drÃ´le et surprenante que la prÃ©cÃ©dente, et bientÃ´t, mÃªme les autres animaux de la savane venaient applaudir les tours de ce dernier.
Mais le liÃ¨vre n'Ã©tait pas cruel. Avec un sourire malicieux, il libÃ©ra la hyÃ¨ne, lui montrant que l'intelligence et la ruse pouvaient Ãªtre plus fortes que la force brute.
Et depuis ce jour, tous les habitants de la savane racontent encore les exploits de la crÃ©ature Ã  grandes oreilles, hÃ©ros petit mais redoutablement malin.`,
    },
    {
      id: 3,
      type: 'conte',
      title: `Conte - Russie : Vassilissa la trÃ¨s belle`,
      text: `Au coeur des forÃªts enneigÃ©es de Russie, lÃ  oÃ¹ les pins s'Ã©tiraient vers le ciel et oÃ¹ la neige crissait sous les pas, vivait Vassilissa, une jeune fille d'une beautÃ© Ã©clatante et d'un coeur pur. Elle portait toujours avec elle une poupÃ©e de chiffon, cadeau de sa mÃ¨re disparue, qui semblait parler et donner des conseils secrets Ã  celle qui savait Ã©couter.
Orpheline, elle vivait avec sa mÃ©chante belle-mÃ¨re et ses deux demi-soeurs jalouses, qui ne cessaient de lui imposer des tÃ¢ches impossibles. Mais la poupÃ©e, animÃ©e d'une magie subtile, guidait Vassilissa et l'aidait Ã  accomplir ses corvÃ©es avec habiletÃ© et intelligence.
Un jour, la belle-mÃ¨re, avide de se dÃ©barrasser d'elle, l'envoya chercher du feu chez la redoutable sorciÃ¨re Baba Yaga, cachÃ©e au fond de la forÃªt. Courageuse mais prudente, Vassilissa suivit les conseils de sa poupÃ©e, traversa ponts instables, riviÃ¨res glacÃ©es et crÃ©atures mystÃ©rieuses, et rÃ©ussit Ã  accomplir les tÃ¢ches impossibles que la femme lui imposait.
GrÃ¢ce Ã  sa ruse, sa patience et l'aide de la poupÃ©e magique, l'enfant revint saine et sauve, portant le feu comme un triomphe de sa bontÃ© et de son courage.
Depuis ce jour, les contes russes parlent encore de Vassilissa, la jeune fille qui triomphait toujours des Ã©preuves avec intelligence et coeur pur.`,
    },
    {
      id: 4,
      type: 'conte',
      title: `Conte - Canada : Lâ€™ours gÃ©ant et lâ€™enfant`,
      text: `Dans les forÃªts profondes du Canada, lÃ  oÃ¹ les riviÃ¨res scintillaient comme des rubans d'argent et oÃ¹ les montagnes se dressaient majestueusement, vivait un petit enfant curieux et courageux.
Un jour, alors qu'il explorait les bois en suivant le chant des oiseaux, il rencontra un ours gÃ©ant au pelage brun dorÃ©, imposant mais aux yeux d'une douceur surprenante.
L'animal, protecteur de la forÃªt, Ã©tait sage et puissant, et il connaissait tous les secrets de la faune et de la flore. Il mit l'enfant Ã  l'Ã©preuve : il dÃ» traverser une riviÃ¨re tumultueuse, escalader une colline escarpÃ©e et comprendre le langage des oiseaux et des arbres. Mais chaque Ã©preuve Ã©tait en rÃ©alitÃ© un enseignement sur le courage, la patience et le respect de la nature.
Avec chaque Ã©tape, le jeune garÃ§on comprit que la force ne rÃ©sidait pas seulement dans la taille ou la puissance, mais dans l'intelligence, l'empathie et le respect de son environnement. L'ours gÃ©ant, impressionnÃ© par son coeur pur et sa dÃ©termination, devint son alliÃ© et compagnon, le guidant Ã  travers la forÃªt et lui transmettant les secrets anciens des crÃ©atures et de la terre.
Depuis ce jour, on raconte au Canada l'histoire de l'enfant qui marcha aux cÃ´tÃ©s de l'ours gÃ©ant, apprenant Ã  Ã©couter, Ã  respecter et Ã  devenir un vrai ami de la forÃªt.`,
    },
    {
      id: 5,
      type: 'conte',
      title: `Conte - Maroc : Le figuier magique`,
      text: `Au coeur des ruelles animÃ©es du Maroc, sous un ciel azur oÃ¹ le soleil Ã©clairait les mosaÃ¯ques colorÃ©es, se trouvait un figuier ancien, immense et mystÃ©rieux, dont les branches semblaient toucher les nuages. On racontait que cet arbre n'Ã©tait pas ordinaire : ses figues dorÃ©es Ã©taient enchantÃ©es, capables d'exaucer les souhaits les plus sincÃ¨res.
Un enfant curieux et intrÃ©pide s'approcha un matin, attirÃ© par l'odeur sucrÃ©e des fruits et le bruissement des feuilles. Alors qu'il tendait la main pour cueillir une figue, l'arbre se mit Ã  parler dans un murmure doux et rassurant, rÃ©vÃ©lant que seul celui qui possÃ©dait un coeur pur pouvait goÃ»ter Ã  sa magie.
Pour prouver sa valeur, il devait faire preuve de courage, de gÃ©nÃ©rositÃ© et d'ingÃ©niositÃ© : partager ses trouvailles avec les habitants du village, aider les animaux de la place et rÃ©soudre des Ã©nigmes laissÃ©es par les anciens du royaume. Ã€ chaque acte de bontÃ©, les figues du figuier brillaient plus fort, et l'enfant sentait une Ã©nergie chaude et bienveillante parcourir ses doigts.
Finalement, ayant dÃ©montrÃ© sa sagesse et son coeur gÃ©nÃ©reux, il put cueillir une figue magique. Cette derniÃ¨re ne donnait pas seulement la chance ou la richesse, mais rÃ©vÃ©lait les secrets pour comprendre et respecter les gens, la nature et la magie qui se cache dans chaque geste quotidien.`,
    },
    {
      id: 6,
      type: 'conte',
      title: `Conte - Chine : La princesse Ã©ventail`,
      text: `Dans les jardins impÃ©riaux baignÃ©s de brume matinale, oÃ¹ les lotus flottaient sur les bassins et oÃ¹ les pavillons aux toits dorÃ©s reflÃ©taient la lumiÃ¨re du soleil, vivait une princesse renommÃ©e pour sa beautÃ© et sa sagesse. Mais ce qui la distinguait le plus Ã©tait son Ã©ventail en soie brodÃ©e d'or et de jade, capable de contrÃ´ler le vent et de murmurer les secrets du ciel.
Un jour, une grande sÃ©cheresse frappa le royaume. Les riviÃ¨res s'assÃ©chÃ¨rent et les arbres perdirent leurs feuilles. La princesse, connue pour son coeur gÃ©nÃ©reux et sa dÃ©termination, prit son Ã©ventail magique et s'avanÃ§a dans le jardin. Chaque mouvement de l'objet faisait danser la brise et onduler les nuages, et bientÃ´t, un vent doux et humide se leva, apportant la pluie salvatrice sur les champs dessÃ©chÃ©s.
Mais la princesse n'utilisait pas sa magie uniquement pour des miracles visibles : elle enseignait aux villageois l'importance de la patience, de la sagesse et du respect pour la nature, leur montrant que chaque geste, mÃªme petit, pouvait faire naÃ®tre le changement.
GrÃ¢ce Ã  elle, les riviÃ¨res reprirent vie, les fleurs s'Ã©panouirent et les enfants jouaient Ã  l'ombre des cerisiers en fleurs, tout en Ã©coutant les histoires que soufflait le vent de son Ã©ventail.`,
    },
    {
      id: 7,
      type: 'conte',
      title: `Conte - Irlande : Le gÃ©ant Fionn et Benandonner`,
      text: `Dans les collines verdoyantes et brumeuses d'Irlande, lÃ  oÃ¹ les moutons paissaient paisiblement et oÃ¹ le vent portait le parfum de l'herbe fraÃ®che, vivait un jeune gÃ©ant nommÃ© Fionn. Curieux et courageux, il adorait explorer les landes et Ã©couter les histoires des anciens, apprenant les lÃ©gendes des druides et des guerriers d'antan.
Un matin, il entendit parler d'un gÃ©ant colossal nommÃ© Benandonner, qui vivait de l'autre cÃ´tÃ© de la mer et terrorisait les villages de ses pas gigantesques. DÃ©terminÃ© Ã  protÃ©ger son pays et Ã  prouver son courage, Fionn dÃ©cida de se rendre Ã  la rencontre de ce dernier.
Mais Fionn Ã©tait malin et rusÃ© : lorsqu'il le croisa, il remarqua que le gÃ©ant Ã©tait Ã©norme et redoutable, mais qu'il se moquait de sa propre force lorsqu'il rit de ses erreurs. Fionn usa alors de ruse et d'astuce. Il fit croire Ã  Benandonner qu'il Ã©tait un gÃ©ant encore plus puissant, et par une sÃ©rie de jeux d'ombres et de tromperies, il rÃ©ussit Ã  faire fuir la crÃ©ature vers l'autre cÃ´tÃ© de la mer.
Depuis ce jour, Fionn devint le protecteur des collines irlandaises, et les villageois racontent encore comment un jeune gÃ©ant malin avait surpassÃ© un de ses congÃ©naires terrible, transformant la peur en lÃ©gende et le danger en histoire Ã  raconter autour du feu.`,
    },
    {
      id: 8,
      type: 'conte',
      title: `Conte - PÃ©rou : Le colibri courageux`,
      text: `Dans les hauteurs vertigineuses des Andes pÃ©ruviennes, lÃ  oÃ¹ les sommets effleurent les nuages et oÃ¹ les torrents grondent dans les vallÃ©es, vivait un petit colibri au plumage Ã©clatant. Bien que minuscule et fragile face aux montagnes imposantes et aux dangers qui rÃ´daient, ce colibri avait un courage qui dÃ©passait sa taille.
Un jour, un incendie Ã©clata dans la forÃªt qui nourrissait la faune et la flore des montagnes. Les grandes crÃ©atures s'effrayaient, et personne n'osait s'approcher des flammes. Mais le petit colibri, dÃ©terminÃ© Ã  protÃ©ger la vie autour de lui, vola droit vers le feu. Il transportait de minuscules gouttes d'eau dans son bec, tombant sans relÃ¢che sur les flammes.
MalgrÃ© la chaleur et la fatigue, le colibri ne cÃ©da jamais. Les autres animaux, inspirÃ©s par sa dÃ©termination et son courage, commencÃ¨rent Ã  l'aider. Ensemble, ils parvinrent Ã  Ã©teindre l'incendie, sauvant ainsi la forÃªt et tous ses habitants.
Depuis ce jour, le colibri est cÃ©lÃ©brÃ© dans les lÃ©gendes pÃ©ruviennes comme le symbole du courage et de la persÃ©vÃ©rance, prouvant que mÃªme les plus petits peuvent accomplir de grands exploits si leur coeur est vaillant.`,
    },
    {
      id: 9,
      type: 'conte',
      title: `Conte - Ã‰gypte : Le secret du Nil`,
      text: `Au coeur de l'Ã‰gypte ancienne, lÃ  oÃ¹ le Nil serpentait comme un ruban bleu entre les sables dorÃ©s, se trouvait un village paisible dont les habitants vivaient en harmonie avec le fleuve sacrÃ©. On racontait qu'au crÃ©puscule, lorsque le soleil baignait les rives d'une lumiÃ¨re d'or, le Nil rÃ©vÃ©lait ses secrets aux coeurs courageux.
Un jeune garÃ§on du village, curieux et intrÃ©pide, rÃªvait de dÃ©couvrir ce mystÃ¨re. Chaque soir, il s'asseyait au bord de l'eau, Ã©coutant le murmure des vagues et observant les reflets dansants du soleil. Une nuit, le fleuve sembla s'animer, et une lumiÃ¨re scintillante surgit Ã  la surface.
GuidÃ© par cette lueur, l'enfant navigua sur une petite barque, dÃ©couvrant une Ã®le cachÃ©e oÃ¹ les plantes et les animaux semblaient parler entre eux. LÃ , un ancien esprit du Nil lui confia que le secret de la vie rÃ©sidait dans l'Ã©quilibre et le respect de la nature, dans la maniÃ¨re dont le fleuve nourrissait la terre et les hommes, jour aprÃ¨s jour.
De retour au village, le jeune homme partagea cette sagesse : il enseigna aux habitants Ã  Ã©couter le fleuve et Ã  protÃ©ger ses eaux, et le village prospÃ©ra comme jamais.
Depuis ce temps, le Nil est cÃ©lÃ©brÃ© non seulement pour ses eaux fertiles, mais aussi pour les secrets qu'il murmure Ã  ceux qui savent regarder et Ã©couter.`,
    },
    {
      id: 10,
      type: 'conte',
      title: `Conte - Australie : Tiddalik, la grenouille`,
      text: `Dans les vastes Ã©tendues rouges de l'Australie, lÃ  oÃ¹ les eucalyptus s'Ã©lanÃ§aient vers le ciel et oÃ¹ le sable chaud crissait sous les pieds, vivait Tiddalik, une grenouille pas comme les autres. Sa particularitÃ© ? Il pouvait boire toute l'eau du pays, et lorsqu'il Ã©tait gourmand, il ne laissait aucune goutte pour les autres.
Un jour, il eut une soif insatiable et avala tous les lacs, riviÃ¨res et mares de la rÃ©gion. Les kangourous, les wombats, les perruches et les lÃ©zards se retrouvÃ¨rent sans une seule goutte d'eau. Le dÃ©sert, dÃ©jÃ  chaud, devint impitoyable, et les animaux Ã©taient au bord du dÃ©sespoir.
Alors, ils dÃ©cidÃ¨rent d'unir leurs forces. Chaque animal essaya de le faire rire, car selon la lÃ©gende, rire faisait relÃ¢cher l'eau avalÃ©e par Tiddalik. Les oiseaux chantÃ¨rent de folles mÃ©lodies, les kangourous sautÃ¨rent en cadence, et les wombats se roulÃ¨rent dans le sable jusqu'Ã  ce que Tiddalik Ã©clate de rire, et en un instant, toute l'eau revint dans les riviÃ¨res et les lacs, rendant la vie Ã  la terre et Ã  ses habitants.
Depuis ce jour, on raconte que la grenouille veille sur l'eau, rappelant Ã  tous que la gÃ©nÃ©rositÃ© et le partage sont essentiels Ã  la survie de chacun.`,
    },
    {
      id: 11,
      type: 'conte',
      title: `Conte - Allemagne : Le joueur de flÃ»te de Hamelin`,
      text: `Dans la ville pittoresque d'Hamelin, aux maisons Ã  colombages et aux ruelles pavÃ©es, un problÃ¨me inquiÃ©tant pesait sur les habitants : une invasion de rats qui dÃ©voraient les rÃ©coltes, envahissaient les maisons et troublaient le sommeil des habitants.
Un jour, un Ã©trange joueur de flÃ»te fit son apparition. VÃªtu d'un manteau colorÃ© et tenant une flÃ»te aux reflets dorÃ©s, il proposa son aide contre une promesse : Ãªtre payÃ© gÃ©nÃ©reusement pour se dÃ©barrasser des rongeurs. DÃ©sespÃ©rÃ©s, les habitants acceptÃ¨rent.
Le joueur de flÃ»te leva son instrument Ã  ses lÃ¨vres et une mÃ©lodie envoÃ»tante s'Ã©leva dans l'air. Les rats, charmÃ©s et hypnotisÃ©s, le suivirent sans un bruit. Ils sortirent de chaque maison, de chaque cave et de chaque recoin, marchant derriÃ¨re lui jusqu'Ã  la riviÃ¨re, oÃ¹ ils disparurent Ã  jamais.
Mais, hÃ©las, une fois sa mission accomplie, les habitants refusÃ¨rent de le payer comme convenu. Furieux, le joueur de flÃ»te joua de nouveau une mÃ©lodie magique, et cette fois-ci, les enfants d'Hamelin furent emportÃ©s par la musique, marchant derriÃ¨re lui hors de la ville, comme les rats autrefois, laissant derriÃ¨re eux une ville silencieuse et pleine de remords.`,
    },
    {
      id: 12,
      type: 'conte',
      title: `Conte - Inde : Le prince au cobra`,
      text: `Dans un royaume lointain d'Inde, aux palais aux dÃ´mes dorÃ©s et aux jardins luxuriants, vivait un jeune prince courageux. Sa curiositÃ© et son courage le poussaient souvent Ã  explorer les forÃªts et les riviÃ¨res qui entouraient son palais.
Un jour, alors qu'il se promenait prÃ¨s d'un Ã©tang sacrÃ©, il rencontra un cobra majestueux, aux Ã©cailles scintillantes et aux yeux perÃ§ants. Mais ce n'Ã©tait pas un serpent ordinaire : il pouvait parler et possÃ©dait des pouvoirs magiques anciens. Ce dernier expliqua au prince qu'un grand danger menaÃ§ait le royaume, et que seul un coeur pur et courageux pourrait dÃ©jouer ce sort.
Le prince accepta la mission. GrÃ¢ce aux conseils du reptile et Ã  son intelligence, il traversa des Ã©preuves mystÃ©rieuses : rÃ©soudre des Ã©nigmes, franchir des ponts invisibles et affronter des illusions trompeuses. Ã€ chaque dÃ©fi, le cobra l'accompagnait, enseignant la patience, la prudence et le respect de la nature.
Finalement, grÃ¢ce Ã  leur alliance, le prince rÃ©ussit Ã  sauver le royaume et Ã  ramener la paix et la prospÃ©ritÃ©. En signe de gratitude, le cobra se transforma en joyau magique, symbole de sagesse et de courage, que le prince porta toujours avec lui.`,
    },
    {
      id: 13,
      type: 'conte',
      title: `Conte - Groenland : Lâ€™ourse et la chasseuse`,
      text: `Au coeur des vastes glaces du Groenland, lÃ  oÃ¹ le vent hurlait et oÃ¹ la neige recouvrait tout, vivait une jeune chasseuse courageuse. Sa peau rosÃ©e par le froid et ses yeux perÃ§ants lui permettaient de repÃ©rer les moindres traces dans la neige immaculÃ©e.
Un matin, alors qu'elle suivait des empreintes mystÃ©rieuses, elle rencontra une grande ourse blanche, majestueuse et imposante, mais Ã©tonnamment douce dans son regard. La crÃ©ature parlait un langage secret que seuls les habitants du Groenland pouvaient comprendre. Elle confia Ã  la chasseuse une mission : protÃ©ger les animaux et les esprits de la glace d'un danger imminent.
La chasseuse accepta. Ensemble, elles traversÃ¨rent des fjords gelÃ©s, escaladÃ¨rent des montagnes couvertes de neige et affrontÃ¨rent les tempÃªtes polaires. Chaque pas Ã©tait un dÃ©fi, mais la prÃ©sence de l'ourse la guidait et la protÃ©geait. La chasseuse apprit Ã  Ã©couter la nature, Ã  comprendre les murmures des vents et le chant des aurores borÃ©ales.
Ã€ la fin de leur pÃ©riple, la chasseuse avait non seulement sauvÃ© les crÃ©atures du Groenland, mais elle avait aussi tissÃ© un lien indestructible avec l'ourse, qui devint sa protectrice Ã©ternelle.
Les habitants du village racontent encore que, lorsque la neige tombe doucement, on peut voir l'ourse et la chasseuse parcourir les Ã©tendues glacÃ©es, unies par un courage et une amitiÃ© hors du commun.`,
    },
    {
      id: 14,
      type: 'conte',
      title: `Conte - Italie : GiufÃ  et lâ€™Ã¢ne`,
      text: `Dans un petit village ensoleillÃ© d'Italie, au pied des collines et entre les oliveraies, vivait GiufÃ , un garÃ§on malin et plein de malice. Il possÃ©dait un Ã¢ne tÃªtu mais attachant, qui semblait parfois comprendre mieux que GiufÃ  lui-mÃªme.
Un jour, le village organisa une fÃªte et le jeune homme fut chargÃ© de conduire son animal au marchÃ© pour y vendre des produits. Mais l'Ã¢ne, espiÃ¨gle et obstinÃ©, refusait d'avancer droit et se mit Ã  zigzaguer entre les rues pavÃ©es. GiufÃ  dut user de toute son ingÃ©niositÃ© pour le guider : il chanta de drÃ´les de chansons, fit des tours de magie et mÃªme des petites farces pour le distraire.
Finalement, grÃ¢ce Ã  son esprit vif et Ã  sa patience, il rÃ©ussit Ã  le mener au marchÃ©. Les villageois, Ã©merveillÃ©s par son habiletÃ© et amusÃ©s par les facÃ©ties de l'Ã¢ne, le fÃ©licitÃ¨rent et racontÃ¨rent cette aventure longtemps aprÃ¨s.
GiufÃ  et son Ã¢ne devinrent un symbole de ruse, de courage et de joie de vivre dans tout le village, rappelant que mÃªme face Ã  des obstacles inattendus, l'intelligence et l'humour peuvent toujours triompher.`,
    },
    {
      id: 15,
      type: 'conte',
      title: `Conte - Kenya : Le feu volant`,
      text: `Dans les vastes plaines dorÃ©es du Kenya, lÃ  oÃ¹ le vent faisait onduler les hautes herbes et oÃ¹ les acacias dessinaient des ombres lÃ©gÃ¨res sur la terre chaude, vivait un jeune garÃ§on courageux nommÃ© Kibaru. Ses yeux noirs brillaient comme des braises et ses cheveux courts dansaient sous le soleil de midi.
Un soir, alors que le ciel se teintait d'orange et de pourpre, Kibaru aperÃ§ut un phÃ©nomÃ¨ne Ã©trange : des flammes flottantes, comme des lucioles ardentes, qui s'Ã©levaient dans les airs sans brÃ»ler les herbes ni les arbres. FascinÃ©, il dÃ©cida de les suivre. Chaque pas le menait plus loin, Ã  travers riviÃ¨res et collines, guidÃ© par la lumiÃ¨re tremblante du feu volant.
Ces flammes, selon la lÃ©gende, Ã©taient les esprits protecteurs de la savane, envoyÃ©s pour aider ceux qui montraient courage et bontÃ©. Kibaru dÃ©couvrit qu'en capturant leur lumiÃ¨re dans une petite calebasse, il pouvait transporter le feu d'un village Ã  l'autre, permettant aux habitants de cuisiner, de s'Ã©clairer et de se rÃ©chauffer, mÃªme lors des nuits les plus sombres.
Mais il devait Ãªtre prudent : le feu volant Ã©tait capricieux. S'il devenait impatient, il s'envolait et disparaissait dans le ciel Ã©toilÃ©.
GrÃ¢ce Ã  sa patience et son respect pour les esprits, Kibaru apprit Ã  danser avec les flammes, Ã  les guider sans jamais les contraindre, transformant ainsi chaque nuit en un spectacle lumineux fascinant.`,
    },
    {
      id: 16,
      type: 'conte',
      title: `Conte - Chili : La lune et le renard`,
      text: `Dans les montagnes arides et mystÃ©rieuses du Chili, lÃ  oÃ¹ les sommets s'Ã©lancent vers le ciel et oÃ¹ le vent murmure aux pierres, vivait un renard rusÃ© et curieux nommÃ© Chai. Son pelage roux flamboyant se fondait parfois avec les roches, et ses yeux dorÃ©s reflÃ©taient les Ã©clats de la lune qui baignait les vallÃ©es chaque nuit.
Un jour, alors que la lune brillait plus intensÃ©ment que jamais, Chai, la regarda descendre du ciel et parler dans un souffle lÃ©ger :
Renard, si tu veux comprendre les secrets de la nuit, suis mes rayons et observe avec attention.
FascinÃ© et prudent, l'animal suivit la lueur argentÃ©e Ã  travers les rochers, les riviÃ¨res scintillantes et les forÃªts clairsemÃ©es.
Au fil de son voyage nocturne, le renard comprit que la lune n'Ã©clairait pas seulement la terre, mais rÃ©vÃ©lait Ã©galement la vÃ©ritÃ© dans le coeur de ceux qui l'observaient. Chaque rayon lui enseignait la patience, l'humilitÃ© et la valeur de la curiositÃ© : apprendre Ã  Ã©couter le monde avant d'agir.
Ã€ la fin de son pÃ©riple, il rÃ©alisa que l'astre lui avait offert un cadeau invisible mais puissant : la sagesse de voir ce que les yeux seuls ne peuvent percevoir.
Depuis ce soir-lÃ , il partageait sa ruse et sa connaissance avec les autres animaux, devenant un guide respectÃ© dans les montagnes chiliennes.`,
    },
    {
      id: 17,
      type: 'conte',
      title: `Conte - France : Le Petit Poucet`,
      text: `Dans une forÃªt dense et mystÃ©rieuse de France, oÃ¹ les arbres s'Ã©lanÃ§aient vers le ciel et oÃ¹ chaque ombre semblait abriter un secret, vivait un petit garÃ§on astucieux appelÃ© Poucet. Bien que minuscule de taille, son esprit Ã©tait immense, et ses yeux pÃ©tillants d'intelligence brillaient Ã  travers les feuilles des arbres comme deux Ã©toiles dans la nuit.
Un soir, alors que la lune se glissait entre les branches, le petit bonhomme fut confrontÃ© Ã  un grand danger : ses frÃ¨res et lui avaient Ã©tÃ© abandonnÃ©s par leurs parents, perdus au coeur de la forÃªt. Mais Poucet, avec son courage et sa ruse, laissa tomber derriÃ¨re lui de petites pierres blanches qui brillaient sous la lune. Ainsi, ils purent retrouver leur chemin, pas Ã  pas, guidÃ©s par le scintillement fragile mais constant des cailloux.
Plus tard, confrontÃ© au terrible ogre, l'enfant usa encore de son intelligence : il Ã©changea les bonnets de ses frÃ¨res avec les siens, trompant l'ogre et sauvant sa famille grÃ¢ce Ã  son audace et son esprit vif.`,
    },
    {
      id: 18,
      type: 'conte',
      title: `Conte - CorÃ©e du Sud : La grue reconnaissante`,
      text: `Dans un village tranquille de CorÃ©e, nichÃ© entre des collines verdoyantes et des riviÃ¨res scintillantes, vivait un homme pauvre mais au coeur gÃ©nÃ©reux. Un soir d'hiver, alors qu'il marchait seul sous le vent glacÃ©, il trouva une grue blessÃ©e, ses ailes froissÃ©es et ses plumes Ã©bouriffÃ©es par la neige. PoussÃ© par la compassion, il la recueillit et prit soin d'elle avec patience et douceur, lui offrant chaleur et nourriture.
Quelques jours plus tard, l'oiseau disparut mystÃ©rieusement, mais bientÃ´t, une Ã©trange femme silencieuse frappa Ã  sa porte. Elle proposa de tisser pour lui de magnifiques Ã©toffes, mais Ã  une condition : il ne devait jamais regarder ce qu'elle faisait. Curieux mais respectueux, il accepta et bientÃ´t, il reÃ§ut des tissus d'une beautÃ© incroyable, faits de fil d'argent et de soie lumineuse.
Un soir, sa curiositÃ© le poussa Ã  jeter un coup d'oeil, et il dÃ©couvrit que la femme n'Ã©tait autre que la grue elle-mÃªme, transformÃ©e par reconnaissance pour sa bontÃ©. ImpressionnÃ© par sa fidÃ©litÃ© et son coeur pur, il comprit alors que la gÃ©nÃ©rositÃ© attirait toujours la magie et la reconnaissance sous des formes inattendues.`,
    },
    {
      id: 19,
      type: 'conte',
      title: `Conte - BrÃ©sil : La tortue et le jaguar`,
      text: `Au coeur de la forÃªt amazonienne, dense et vibrante de vie, vivait une tortue rusÃ©e et rÃ©flÃ©chie, toujours attentive aux moindres bruits et mouvements de la jungle.
Un jour, alors qu'elle se promenait prÃ¨s de la riviÃ¨re, elle rencontra un jaguar affamÃ©, majestueux et redoutable, dont le regard perÃ§ant trahissait l'envie de la dÃ©vorer.
La tortue, au lieu de cÃ©der Ã  la panique, eut une idÃ©e brillante. Elle l'invita Ã  participer Ã  un concours : qui pourrait atteindre le vieux figuier au sommet de la colline avant l'autre ? Celui-ci, sÃ»r de sa rapiditÃ© et de sa force, accepta sans hÃ©siter.
Tout le long du chemin, la tortue avanÃ§ait lentement mais avec une ruse astucieuse : elle laissait des indices trompeurs, faisait semblant de se perdre, et utilisait les racines et les troncs pour ralentir le jaguar. Finalement, il arriva Ã©puisÃ© et confus, tandis qu'elle, sans hÃ¢te mais avec intelligence, atteignit le figuier en premier.
Le fÃ©lin, impressionnÃ© et respectueux de l'ingÃ©niositÃ© de la tortue, renonÃ§a Ã  sa faim et devint un alliÃ© inattendu, partageant avec elle la richesse de la forÃªt et les secrets des animaux.`,
    },
    {
      id: 20,
      type: 'conte',
      title: `Conte - Iran : Le tapis volant`,
      text: `Dans les bazars colorÃ©s et animÃ©s d'une ville ancienne de Perse, un jeune garÃ§on dÃ©couvrit un tapis ancien et poussiÃ©reux, cachÃ© derriÃ¨re des tissus et des lanternes scintillantes. Ce tapis n'Ã©tait pas ordinaire : ses fils d'or et de soie s'animaient dÃ¨s qu'on posait un pied dessus, et il s'Ã©levait dans les airs, prÃªt Ã  emporter son voyageur vers des horizons insoupÃ§onnÃ©s.
Le garÃ§on, Ã©merveillÃ© et un peu craintif, s'installa au centre du tapis. AussitÃ´t, il senti le vent caresser son visage et vit les ruelles se rÃ©trÃ©cir sous lui alors qu'il s'Ã©levait au-dessus de la commune. Le tapis vola entre les minarets et les jardins suspendus, passant au-dessus des marchÃ©s parfumÃ©s et des fontaines chantantes.
Chaque mouvement du tapis Ã©tait magique et fluide, comme guidÃ© par l'air lui-mÃªme. Il traversa des vallÃ©es dÃ©sertiques, survola des montagnes majestueuses, et emmena son passager dans des paysages merveilleusement variÃ©s, oÃ¹ les couleurs et les sons semblaient sortir d'un rÃªve.`,
    },
    {
      id: 21,
      type: 'conte',
      title: `Conte - ThaÃ¯lande : La mangue du roi`,
      text: `Dans le royaume verdoyant de ThaÃ¯lande, au coeur de jardins luxuriants et parfumÃ©s, un jeune garÃ§on s'approcha d'un arbre majestueux, le manguier du roi, dont les fruits Ã©taient rÃ©putÃ©s plus sucrÃ©s et juteux que tous les autres. On raconte que celui qui goÃ»te une de ces mangues ressent la magie du royaume et obtient la sagesse et la chance.
Ce dernier, curieux et Ã©merveillÃ©, tendit la main vers un fruit dorÃ© suspendu haut dans les branches. DÃ¨s qu'il toucha la mangue, un doux parfum tropical envahit l'air, et une lumiÃ¨re chaleureuse enveloppa ses doigts, comme si le soleil lui-mÃªme s'Ã©tait glissÃ© dans l'arbre.
Soudain, le fruit se dÃ©tacha et descendit doucement, guidÃ© par un souffle magique, jusqu'Ã  lui. En la goÃ»tant, il ressentit un Ã©clat de bonheur et d'Ã©nergie, voyant autour de lui les Ã©lÃ©phants, les riziÃ¨res Ã©tincelantes et les temples scintillants, tous baignÃ©s dans une lumiÃ¨re dorÃ©e.`,
    },
    {
      id: 22,
      type: 'conte',
      title: `Conte - Angleterre : Jack et le haricot magique`,
      text: `Dans un petit village anglais bordÃ© de collines verdoyantes, vivait Jack, un garÃ§on pauvre mais audacieux, qui partageait sa vie avec sa mÃ¨re dans une maisonnette en bois.
Un matin, la seule vache de la famille ne donna plus de lait. Sa mÃ¨re, inquiÃ¨te, demanda Ã  son fils de la vendre au marchÃ© afin de survivre.
Sur le chemin, Jack rencontra un vieil homme mystÃ©rieux qui lui proposa d'Ã©changer la vache contre quelques haricots extraordinaires, brillants et colorÃ©s, avec un Ã©clat presque magique. L'enfant accepta, intriguÃ©. De retour Ã  la maison, sa mÃ¨re, furieuse, jeta les haricots par la fenÃªtre.
La nuit tomba, et sous l'Ã©clat de la lune, un haricot poussa, grandit jusqu'au ciel ! Il devint un immense haricot magique qui s'Ã©leva au-dessus des nuages, vers un monde inconnu. Jack, courageux et curieux, dÃ©cida de grimper le long de cette liane vertigineuse.
Au sommet, il dÃ©couvrit un palais fantastique, abritant un ogre immense et des trÃ©sors fabuleux. Les sons du chÃ¢teau rÃ©sonnaient dans le vent : le tintement de piÃ¨ces d'or, le rugissement de l'ogre et les chants des oiseaux du ciel.
L'enfant, rusÃ© et audacieux, utilisa son intelligence et son courage afin de rÃ©cupÃ©rer les trÃ©sors et retrouver le chemin vers la maison, en faisant preuve d'ingÃ©niositÃ© et de bravoure.`,
    },
    {
      id: 23,
      type: 'conte',
      title: `Conte - Vietnam : Lâ€™enfant des riziÃ¨res`,
      text: `Dans un petit village nichÃ© au coeur des riziÃ¨res verdoyantes du Vietnam, vivait un enfant nommÃ© Minh, curieux et dÃ©bordant d'Ã©nergie. Chaque matin, il parcourait les sentiers Ã©troits entre les champs inondÃ©s, observant les reflets du soleil sur l'eau et Ã©coutant le doux murmure du vent dans les palmiers.
Un jour, alors qu'il jouait prÃ¨s d'un petit ruisseau, il dÃ©couvrit un canard blessÃ©. Avec douceur et patience, il le soigna, s'occupant de ses ailes et de ses plumes trempÃ©es. L'animal, reconnaissant, devint son compagnon fidÃ¨le, l'accompagnant dans toutes ses aventures Ã  travers les riziÃ¨res.
Mais ces terres regorgeaient de mystÃ¨res. Entre les brumes matinales, Minh aperÃ§ut des crÃ©atures Ã©tranges et bienveillantes, qui semblaient garder les secrets des champs et des cours d'eau. Il apprit Ã  comprendre le langage des animaux, Ã  Ã©couter les lÃ©gendes transmises par les anciens, et Ã  respecter la magie qui imprÃ©gnait chaque Ã©lÃ©ment de la nature.
Un jour, une inondation menaÃ§a les riziÃ¨res du village. GrÃ¢ce Ã  son intelligence, son courage et l'aide de son fidÃ¨le canard, Minh parvint Ã  guider les villageois et Ã  protÃ©ger les champs. Sa bravoure devint une lÃ©gende locale, et l'enfant des riziÃ¨res fut cÃ©lÃ©brÃ© comme un hÃ©ros humble et sage, capable d'harmoniser le monde naturel et humain autour de lui.`,
    },
    {
      id: 24,
      type: 'conte',
      title: `Conte - Espagne : Le tambour enchantÃ©`,
      text: `Dans un petit village d'Espagne, nichÃ© entre les collines et les oliveraies, vivait un jeune garÃ§on nommÃ© Diego, passionnÃ© par la musique et les fÃªtes traditionnelles. Son instrument prÃ©fÃ©rÃ© Ã©tait un vieux tambour en bois, transmis de gÃ©nÃ©ration en gÃ©nÃ©ration dans sa famille, dont les battements rÃ©sonnaient comme un coeur vibrant de vie et de lÃ©gendes.
Un soir, alors que le soleil se couchait derriÃ¨re les collines, Diego dÃ©couvrit que le tambour possÃ©dait des pouvoirs magiques : chaque rythme qu'il jouait faisait danser les animaux, les villageois, et mÃªme les Ã©toiles dans le ciel. Ã‰merveillÃ©, il dÃ©cida de partager cette magie avec tout le village, et bientÃ´t, une fÃªte improvisÃ©e Ã©clata, oÃ¹ chacun dansait et chantait, portÃ© par la musique enchantÃ©e du tambour.
Mais la magie n'Ã©tait pas sans dÃ©fis. Les sons du tambour attirÃ¨rent Ã©galement des esprits farceurs, qui cherchaient Ã  troubler l'harmonie du village. Avec courage et ingÃ©niositÃ©, Diego apprit Ã  jouer de douces mÃ©lodies, apaisant les esprits, ce qui renforÃ§a le lien entre les habitants, la faune et la flore.
GrÃ¢ce Ã  son tambour enchantÃ©, Diego devint le gardien de la joie et des traditions, rappelant Ã  tous que la musique pouvait unir les coeurs et transformer chaque journÃ©e en un moment extraordinaire.`,
    },
    {
      id: 25,
      type: 'conte',
      title: `Conte - HaÃ¯ti : Ti-Jean et le diable`,
      text: `Dans un village colorÃ© d'HaÃ¯ti, bordÃ© par des champs de canne Ã  sucre et des collines verdoyantes, vivait un petit garÃ§on nommÃ© Ti-Jean, vif et malin, connu pour son esprit rusÃ© et son sourire espiÃ¨gle.
Un jour, alors qu'il cueillait des fruits prÃ¨s de la riviÃ¨re, le diable apparut, dÃ©cidÃ© Ã  tester l'ingÃ©niositÃ© des humains et Ã  attirer les Ã¢mes naÃ¯ves dans ses tours diaboliques.
Mais Ti-Jean n'Ã©tait pas un enfant ordinaire. Avec son intelligence, son courage et une bonne dose d'audace, il rÃ©ussit Ã  tromper le diable Ã  chaque Ã©preuve. Que ce soit en Ã©changeant des objets, en crÃ©ant des illusions ou en racontant des histoires confuses, ce dernier dÃ©joua les piÃ¨ges avec humour et ingÃ©niositÃ©.
Ã€ chaque dÃ©fi relevÃ©, il montrait que la ruse et la crÃ©ativitÃ© pouvaient vaincre mÃªme les plus grandes forces. Les villageois, Ã©merveillÃ©s par ses exploits, racontaient ses aventures autour des feux de camp, et Ti-Jean devint un symbole de courage et de vivacitÃ©.`,
    },
    {
      id: 26,
      type: 'conte',
      title: `Conte - Turquie : Nasreddine et lâ€™Ã¢ne`,
      text: `Dans un petit village turc baignÃ© de soleil, aux ruelles Ã©troites et aux marchÃ©s animÃ©s, vivait Nasreddine, un homme sage et espiÃ¨gle, connu pour son humour et ses rÃ©ponses pleines de bon sens. Un jour, alors qu'il chevauchait son fidÃ¨le Ã¢ne, il croisa des villageois qui se moquaient de lui, le jugeant toujours un peu bizarre.
Mais Nasreddine ne se laissa jamais dÃ©stabiliser. Avec un sourire malicieux et une logique inattendue, il transforma chaque situation ridicule en une leÃ§on pleine d'esprit. Que ce soit en discutant avec les marchands, en rÃ©solvant des querelles ou en improvisant de drÃ´les d'histoires, il montrait que l'intelligence et l'humour Ã©taient des armes plus puissantes que la force.
L'Ã¢ne, fidÃ¨le compagnon de ses aventures, participait souvent involontairement aux tours et aux situations comiques, ajoutant encore plus de charme et de rires Ã  chaque anecdote. Les villageois racontaient ensuite ses exploits dans les cafÃ©s et sous les arbres, riant des situations absurdes et admirant la sagacitÃ© de l'homme.`,
    },
    {
      id: 27,
      type: 'conte',
      title: `Conte - Nouvelle-ZÃ©lande : Maui ralentit le soleil`,
      text: `Dans les terres vertes et mystÃ©rieuses de la Nouvelle-ZÃ©lande, entre montagnes majestueuses et forÃªts denses, vivait Maui, un demi-dieu espiÃ¨gle aux exploits lÃ©gendaires. Un jour, voyant que les journÃ©es Ã©taient trop courtes pour permettre aux hommes et aux femmes de finir leur travail, il dÃ©cida de ralentir le soleil.
Avec courage et ruse, il grimpa sur le sommet d'une montagne et lanÃ§a un lasso magique, fabriquÃ© Ã  partir des cheveux de sa grand-mÃ¨re. Il attrapa le soleil, qui se dÃ©battait avec force, illuminant le ciel de sa lumiÃ¨re Ã©clatante. GrÃ¢ce Ã  son ingÃ©niositÃ© et sa dÃ©termination, Maui rÃ©ussit Ã  ralentir sa course, offrant aux humains de longues journÃ©es pour pÃªcher, cultiver et profiter de la vie.
Ce geste hÃ©roÃ¯que n'Ã©tait pas seulement un exploit physique, mais un acte plein de malice et d'ingÃ©niositÃ©, car l'homme savait que l'intelligence et la crÃ©ativitÃ© Ã©taient des forces aussi puissantes que le courage.
Les habitants racontÃ¨rent encore et encore cette aventure, admirant le demi-dieu qui avait su apprivoiser le soleil lui-mÃªme.`,
    },
    {
      id: 28,
      type: 'conte',
      title: `Conte - Mali : Lâ€™hippopotame et les Ã©toiles`,
      text: `Au bord du grand fleuve Niger, sous le ciel Ã©toilÃ© du Mali, vivait un hippopotame curieux et rÃªveur. Chaque nuit, il regardait les Ã©toiles briller et se demandait pourquoi elles semblaient si loin et inaccessibles. Les autres animaux riaient de ses rÃªveries, mais lui savait qu'un jour, il trouverait un moyen de toucher ces points lumineux qui scintillaient au-dessus de sa tÃªte.
Une nuit, guidÃ© par la lueur des astres, il entreprit un voyage extraordinaire, traversant riviÃ¨res et marÃ©cages, parlant aux lucioles et aux hiboux qui l'accompagnaient. Avec patience et courage, il construisit un bÃ¢ton magique, gravÃ© de symboles anciens et lumineux, qui lui permit de capturer un fragment d'Ã©toile.
GrÃ¢ce Ã  sa persÃ©vÃ©rance, l'hippopotame rÃ©alisa que mÃªme les rÃªves les plus grands pouvaient Ãªtre atteints si l'on osait avancer avec le coeur ouvert et l'esprit attentif.
Les Ã©toiles, touchÃ©es par sa dÃ©termination, continuÃ¨rent de briller plus fort, illuminant le fleuve et inspirant tous les animaux et les humains qui vivaient autour de lui.`,
    },
    {
      id: 29,
      type: 'conte',
      title: `Conte - Pologne : Le roi grenouille`,
      text: `Dans une forÃªt ancienne et mystÃ©rieuse de Pologne, vivait un roi transformÃ© en grenouille, enfermÃ© par un sortilÃ¨ge mystÃ©rieux. Jadis noble et courageux, il passait ses journÃ©es sur les berges d'un Ã©tang scintillant, regardant les nuages se reflÃ©ter dans l'eau et rÃªvant de retrouver sa forme humaine.
Un jour, une petite princesse curieuse s'aventura prÃ¨s de l'Ã©tang. Elle avait entendu parler de la lÃ©gende du roi grenouille, mais elle ne craignait pas les apparences. Avec douceur et courage, elle engagea la conversation avec le prince transformÃ©, Ã©coutant ses histoires de royaumes lointains, de chÃ¢teaux majestueux et de crÃ©atures fantastiques.
En Ã©change de sa gentillesse et de sa patience, le roi grenouille offrit une promesse : quiconque oserait l'aider avec un coeur pur pourrait briser le sort et voir le royaume s'illuminer d'une magie ancienne. La princesse accepta le dÃ©fi, rÃ©alisant que la confiance, le respect et le courage Ã©taient souvent les clÃ©s pour libÃ©rer la magie cachÃ©e derriÃ¨re les apparences.`,
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



