import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type {
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesCard,
} from '../model/contes-et-cacahuetes-state.entity';

@Injectable()
export class ContesCacahuetesSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) positions[p.id] = 0;

    const metaBase: ContesCacahuetesMetadata = {
      tiles: buildTiles(),
      positions,
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

    return {
      ...baseState,
      phase: 'playing',
      pending: null,
      metadata: { ...(baseState.metadata ?? {}), ...metaBase },
    };
  }
}

function buildTiles(): ContesCacahuetesTile[] {
  return [
    {
      type: 'start',
      label:
        'Case Départ - Vous ouvrez le grand livre des contes, et un vent de magie emporte vos feuilles volantes Chaque pas vous rapproche d'histoires fantastiques, de surprises et de rires à profusion. L'aventure commence maintenant !',
    },
    {
      type: 'bonus',
      label: 'Case Bonus - Un coup de pouce magique ! La chance vous sourit, profitez-en.',
    },
    { type: 'conte', label: 'Case Conte - Japon : Momotarō' },
    { type: 'surprise', label: 'Case Surprise - Le conte réserve toujours des rebondissements.' },
    { type: 'conte', label: 'Case Conte - Sénégal : Le lièvre et la hyène' },
    { type: 'malus', label: 'Case Malus - Oups le conte vous joue un vilain tour.' },
    { type: 'conte', label: 'Case Conte - Russie : Vassilissa la très belle' },
    {
      type: 'bonus',
      label: 'Case Bonus - Une bonne fée passait par là et elle était de bonne humeur !',
    },
    { type: 'conte', label: 'Case Conte - Canada : L'ours géant et l'enfant' },
    { type: 'surprise', label: 'Case Surprise - Personne ne s'y attendait pas même vous !' },
    { type: 'conte', label: 'Case Conte - Maroc : Le figuier magique' },
    { type: 'malus', label: 'Case Malus - Tout ne se passe pas comme prévu dans les histoires' },
    { type: 'conte', label: 'Case Conte - Chine : La princesse éventail' },
    { type: 'bonus', label: 'Case Bonus - Le vent tourne en votre faveur, avancez avec le sourire.' },
    { type: 'conte', label: 'Case Conte - Irlande : Le géant Fionn et Benandonner' },
    { type: 'surprise', label: 'Case Surprise - Un événement étrange surgit de nulle part.' },
    { type: 'conte', label: 'Case Conte - Pérou : Le colibri courageux' },
    { type: 'malus', label: 'Case Malus - Une péripétie inattendue freine votre avancée.' },
    { type: 'conte', label: 'Case Conte - Égypte : Le secret du Nil' },
    { type: 'bonus', label: 'Case Bonus - Une histoire bien racontée porte toujours chance.' },
    { type: 'conte', label: 'Case Conte - Australie : Tiddalik, la grenouille' },
    { type: 'surprise', label: 'Case Surprise - Tout peut arriver quand on tourne la page.' },
    { type: 'conte', label: 'Case Conte - Allemagne : Le joueur de flûte d'Hamelin' },
    { type: 'malus', label: 'Case Malus - Même les héros trébuchent parfois.' },
    { type: 'conte', label: 'Case Conte - Inde : Le prince au cobra' },
    { type: 'bonus', label: 'Case Bonus - Vous trouvez un trèfle à quatre feuilles, évidemment !' },
    { type: 'conte', label: 'Case Conte - Groenland : L'ourse et la chasseuse' },
    { type: 'surprise', label: 'Case Surprise - Le hasard adore se mêler aux histoires.' },
    { type: 'conte', label: 'Case Conte - Italie : Giufà et l'âne' },
    { type: 'malus', label: 'Case Malus - Le sort s'emmêle et vous avec.' },
    { type: 'conte', label: 'Case Conte - Kenya : Le feu volant' },
    { type: 'bonus', label: 'Case Bonus - Le conte vous applaudit. À vous la récompense !' },
    { type: 'conte', label: 'Case Conte - Chili : La lune et le renard' },
    { type: 'surprise', label: 'Case Surprise - Une surprise se cache entre les lignes.' },
    { type: 'conte', label: 'Case Conte - France : Le Petit Poucet' },
    { type: 'malus', label: 'Case Malus - Le conte prend un tournant un peu grinçant.' },
    { type: 'conte', label: 'Case Conte - Corée du Sud : La grue reconnaissante' },
    { type: 'bonus', label: 'Case Bonus - Les esprits du récit vous encouragent chaleureusement.' },
    { type: 'conte', label: 'Case Conte - Brésil : La tortue et le jaguar' },
    { type: 'surprise', label: 'Case Surprise - Le conte vous observe et agit !' },
    { type: 'conte', label: 'Case Conte - Iran : Le tapis volant' },
    { type: 'malus', label: 'Case Malus - Une mauvaise surprise surgit entre deux pages.' },
    { type: 'conte', label: 'Case Conte - Thaïlande : La mangue du roi' },
    { type: 'bonus', label: 'Case Bonus - Un héros bien préparé mérite toujours un avantage.' },
    { type: 'conte', label: 'Case Conte - Angleterre : Jack et le haricot magique' },
    { type: 'surprise', label: 'Case Surprise - Rien n'est jamais figé dans un bon récit.' },
    { type: 'conte', label: 'Case Conte - Vietnam : L'enfant des rizières' },
    { type: 'malus', label: 'Case Malus - Les chemins des légendes ne sont pas toujours droits.' },
    { type: 'conte', label: 'Case Conte - Espagne : Le tambour enchanté' },
    { type: 'bonus', label: 'Case Bonus - La chance vous fait un clin d'oeil malicieux.' },
    { type: 'conte', label: 'Case Conte - Haïti : Ti-Jean et le diable' },
    { type: 'surprise', label: 'Case Surprise - Une surprise tombe pile au bon, ou, mauvais moment.' },
    { type: 'conte', label: 'Case Conte - Turquie : Nasreddine et l'âne' },
    { type: 'malus', label: 'Case Malus - Le destin vous teste courage !' },
    { type: 'conte', label: 'Case Conte - Nouvelle-Zélande : Maui ralentit le soleil' },
    { type: 'bonus', label: 'Case Bonus - Un moment de gloire savourez-le !' },
    { type: 'conte', label: 'Case Conte - Mali : L'hippopotame et les étoiles' },
    { type: 'malus', label: 'Case Malus - Même à la fin, le conte aime faire durer le suspense.' },
    { type: 'conte', label: 'Case Conte - Pologne : Le roi grenouille' },
    {
      type: 'finish',
      label:
        'Case Arrivée - Vous atteignez le majestueux livre magique, ses pages scintillent et s'animent autour de vous... Les contes du monde entier vous saluent et vous couronnent Maître ou Maîtresse des histoires, héros de cette aventure mémorable !',
    },
  ];
}


function buildDecks(): ContesCacahuetesMetadata['decks'] {
  const bonus: ContesCard[] = [
    {
      id: 1,
      type: 'bonus',
      title: 'Bottes de sept lieues',
      text: 'Avancez de 2 cases supplémentaires. Ces bottes magiques vous font bondir loin devant !',
    },
    {
      id: 2,
      type: 'bonus',
      title: 'Parchemin Enchanté',
      text: 'Si le résultat ne vous plaît pas, vous pouvez relancer qu’une seule fois le dé. Le vieux grimoire vous montre une autre possibilité.',
    },
    {
      id: 3,
      type: 'bonus',
      title: 'Amulette Protectrice',
      text: 'Gardez cette carte dans votre main. Elle vous protège d’un malus (valable une fois). Elle se défausse après usage.',
    },
    {
      id: 4,
      type: 'bonus',
      title: 'Cape d’Invisibilité',
      text: 'Si vous arrivez sur une case Malus, son effet est automatiquement ignoré et vous avancez d’une case supplémentaire.',
    },
    {
      id: 5,
      type: 'bonus',
      title: 'Poussière de Fée',
      text: 'Vous pouvez faire avancer un autre joueur de votre choix de 2 cases. Un geste d’amitié qui crée la magie.',
    },
    {
      id: 6,
      type: 'bonus',
      title: 'Haricot Magique',
      text: 'Un haricot magique vous propulse dans les airs ! Lancez le dé maintenant : le résultat obtenu est automatiquement doublé.',
    },
    {
      id: 7,
      type: 'bonus',
      title: 'Clé d’Or Universelle',
      text: 'Si vous tombez sur une case Conte, choisissez l’effet (bonus ou malus) pour un autre joueur de votre choix. La clé vous donne le pouvoir de décider.',
    },
    {
      id: 8,
      type: 'bonus',
      title: 'Ami Légendaire',
      text: 'Vous êtes aidé par un personnage magique ! Avancez de 3 cases.',
    },
    {
      id: 9,
      type: 'bonus',
      title: 'Pont Arc-en-ciel',
      text: 'Un pont magique apparaît ! Piochez une carte Bonus puis une carte Surprise, et appliquez leurs effets.',
    },
    {
      id: 10,
      type: 'bonus',
      title: 'Formule Magique',
      text: 'Choisissez un joueur et échangez votre prochain tour avec le sien (vous avancez à sa place, et inversement). Surprise garantie !',
    },
    {
      id: 11,
      type: 'bonus',
      title: 'Flûte Enchantée',
      text: 'Tous les autres joueurs vous applaudissent : pendant leur prochain tour, ils avancent de 1 case seulement, même avec un grand dé.',
    },
    {
      id: 12,
      type: 'bonus',
      title: 'Corne d’Abondance',
      text: 'Piocher deux cartes Bonus mais gardez-en qu’une, la plus avantageuse. Un coup de chance rare !',
    },
    {
      id: 13,
      type: 'bonus',
      title: 'Monture Mystique',
      text: 'Un animal légendaire vous emmène loin. Avancez de 5 cases, mais passez un tour au prochain lancé de dé.',
    },
    {
      id: 14,
      type: 'bonus',
      title: 'Feuille Magique',
      text: 'Gardez cette carte dans votre main : la prochaine fois que vous faites 1 au dé, avancer de 4 cases à la place. Comme un coup de vent !',
    },
    {
      id: 15,
      type: 'bonus',
      title: 'Lanterne Lumineuse',
      text: 'La lanterne vous guide. Reculez de deux cases puis avancez de trois.',
    },
  ];

  const malus: ContesCard[] = [
    {
      id: 1,
      type: 'malus',
      title: 'Sortilège de Sommeil',
      text: 'Vous vous endormez comme la Belle au bois dormant. Passez un tour.',
    },
    {
      id: 2,
      type: 'malus',
      title: 'Ronce Enchevêtrée',
      text: 'Vous êtes coincé dans une forêt de ronces. Reculez de 2 cases.',
    },
    {
      id: 3,
      type: 'malus',
      title: 'Grimoire Capricieux',
      text: 'Vous lisez une formule à l’envers : échangez votre place avec le joueur le plus proche derrière vous !',
    },
    {
      id: 4,
      type: 'malus',
      title: 'Pluie de Mots Oubliés',
      text: 'Vous oubliez un passage de votre histoire. Lancez le dé et avancez seulement de la moitié du chiffre obtenu.',
    },
    {
      id: 5,
      type: 'malus',
      title: 'Loup dans la Forêt',
      text: 'Un grand méchant loup surgit ! Vous devez attendre qu’un autre joueur atteigne ou dépasse votre case pour pouvoir rejouer.',
    },
    {
      id: 6,
      type: 'malus',
      title: 'Sable Mouvant Magique',
      text: 'Vous vous enfoncez dans une étrange plage mouvante. Passez deux tours.',
    },
    {
      id: 7,
      type: 'malus',
      title: 'Page Manquante',
      text: 'Oh non ! Votre conte est incomplet. Vous devez retirer une carte Malus et subir son effet.',
    },
    {
      id: 8,
      type: 'malus',
      title: 'Confusion de Contes',
      text: 'Les histoires s’emmêlent ! Avancez de 3 cases puis reculez de 4. Zut, ce n’était pas dans cet ordre-là !',
    },
    {
      id: 9,
      type: 'malus',
      title: 'Maladresse de Sorcier',
      text: 'Vous cassez votre baguette magique. Piochez une carte Bonus puis donnez-la à un autre joueur de votre choix.',
    },
    {
      id: 10,
      type: 'malus',
      title: 'Ombre Farceuse',
      text: 'Une créature invisible vous embête. Relancez votre dé, mais cette fois, reculez au lieu d’avancer.',
    },
    {
      id: 11,
      type: 'malus',
      title: 'Énigme Infernale',
      text: 'Vous êtes bloqué par un sphinx rusé ! Pour continuer, lancez le dé : si vous obtenez un 4 ou plus, avancez normalement. Sinon, passez un tour.',
    },
    {
      id: 12,
      type: 'malus',
      title: 'Passage Obscur',
      text: 'Vous entrez dans un tunnel sombre. Retournez à la case Malus précédente et revivez son effet.',
    },
    {
      id: 13,
      type: 'malus',
      title: 'Chaussures Enchantées mais trop petites',
      text: 'Reculez de deux cases pour changer de chaussures. Aïe !',
    },
    {
      id: 14,
      type: 'malus',
      title: 'Miroir Brisé',
      text: 'Un miroir magique vous renvoie à votre passé. Retournez à la case départ.',
    },
    {
      id: 15,
      type: 'malus',
      title: 'Grimoire Grincheux',
      text: 'Vous ne pouvez plus jouer de carte Bonus durant deux tours.',
    },
  ];

  const surprise: ContesCard[] = [
    {
      id: 1,
      type: 'surprise',
      title: 'Baguette Malicieuse',
      text: 'Une baguette magique s’agite toute seule ! Avancez d’une case puis reculez de deux.',
    },
    {
      id: 2,
      type: 'surprise',
      title: 'Voyage en Tapis Volant',
      text: 'Quelle chance ! Vous vous laissez porter par un tapis magique et avancez de quatre cases.',
    },
    {
      id: 3,
      type: 'surprise',
      title: 'Rencontre Inattendue',
      text: 'Un personnage célèbre d’un autre conte apparaît ! Piochez une carte Bonus.',
    },
    {
      id: 4,
      type: 'surprise',
      title: 'Coffre aux Merveilles',
      text: 'Vous ouvrez un vieux coffre enchanté. Tirez deux cartes au hasard (Bonus, Malus ou Surprise) et appliquez-les toutes les deux.',
    },
    {
      id: 5,
      type: 'surprise',
      title: 'Poussière de Rire',
      text: 'Un nuage de poussière de rire se répand ! Chaque joueur lance un petit dé de 1 à 3. Celui qui a le plus grand avance d’une case. Remarque : s’il y a execo, au chiffre trois, ils avancent ensemble.',
    },
    {
      id: 6,
      type: 'surprise',
      title: 'Tempête de Pages',
      text: 'Un vent magique emporte les histoires ! Choisissez un autre joueur et échangez vos positions sur le plateau.',
    },
    {
      id: 7,
      type: 'surprise',
      title: 'Carte Invisible',
      text: 'Passez votre tour.',
    },
    {
      id: 8,
      type: 'surprise',
      title: 'Livre à l’Envers',
      text: 'Vous lisez une histoire à l’envers. Votre prochain tour se fait en reculant.',
    },
    {
      id: 9,
      type: 'surprise',
      title: 'Chanson Enchantée',
      text: 'Une mélodie magique résonne ! Choisissez : avancer de 3 cases ou prendre une carte Bonus à un autre joueur.',
    },
    {
      id: 10,
      type: 'surprise',
      title: 'Dragon de Papier',
      text: 'Un mini-dragon apparaît dans votre livre ! Il vous protège automatiquement de la prochaine carte Malus.',
    },
    {
      id: 11,
      type: 'surprise',
      title: 'Conte Perdu',
      text: 'Vous découvrez un conte inconnu. Piochez une nouvelle carte Conte, même si vous êtes sur une case spéciale.',
    },
    {
      id: 12,
      type: 'surprise',
      title: 'Montre Enchantée',
      text: 'Relancez le dé, puis reculez du nombre obtenu.',
    },
    {
      id: 13,
      type: 'surprise',
      title: 'Souhait Éphémère',
      text: 'Faites un vœu simple : avancer de 2 cases, échanger votre pion avec un autre joueur, ou tirer une carte Bonus (à vous de choisir).',
    },
    {
      id: 14,
      type: 'surprise',
      title: 'Filet Magique',
      text: 'Vous attrapez une carte Bonus ou Surprise d’un autre joueur de votre choix.',
    },
    {
      id: 15,
      type: 'surprise',
      title: 'Grimoire Voyageur',
      text: 'Vous lisez un conte venu d’ailleurs. Échangez votre place avec un autre joueur : vous restez sur place, et lui prend votre position puis avance d’une case.',
    },
  ];

  const contes: ContesCard[] = [
    {
      id: 1,
      type: 'conte',
      title: 'Conte - Japon : Momotarō',
      text: `Il était une fois, dans un petit village japonais bordé de collines verdoyantes et de rivières étincelantes, un couple âgé qui vivait paisiblement.
Un jour, alors que la vieille dame lavait des vêtements dans la rivière, elle découvrit une énorme pêche flottant sur l'eau. Curieuse, elle la ramena chez elle. À leur grande surprise, en l'ouvrant, ils trouvèrent un petit garçon robuste et joyeux à l'intérieur. Ils l'appelèrent Momotarō, le garçon-pêche.
Grandissant avec force et courage, Momotarō apprit qu'au loin, sur une île mystérieuse, des oni (démons malicieux) semaient la terreur parmi les habitants. Déterminé à protéger son village, il partit à l'aventure, emportant avec lui des kibi dango (des petites boules de millet sucrées) pour convaincre des compagnons de le suivre.
Sur son chemin, il rencontra un chien fidèle, un singe polyvalent et un faisan majestueux. Chacun, séduit par les kibi dango et la détermination de l'enfant, devint son allié loyal. Ensemble, ils traversèrent les eaux tumultueuses et atteignirent l'île des oni.
Grâce à leur courage, leur ruse et la force de l'amitié, ils vainquirent les démons, récupérèrent les trésors volés et ramenèrent la paix dans le village. Momotarō, héros humble et courageux, reçut la gratitude éternelle de son peuple, et son histoire continua de se raconter au fil des générations.`,
    },
    {
      id: 2,
      type: 'conte',
      title: 'Conte - Sénégal : Le lièvre et l’hyène',
      text: `Dans les vastes savanes du Sénégal, où les baobabs se dressent comme des géants silencieux et où le soleil éclaire la terre d'un éclat doré, vivait un lièvre malin et rusé, connu pour ses tours et ses farces. Non loin de là, la hyène, grande et gourmande, rêvait toujours de le piéger pour le manger.
Un jour, cette dernière décida de tendre un piège ingénieux au lièvre. Mais le petit animal, vif comme le vent sur la savane, devina la ruse. Avec son esprit rapide et ses pattes légères, il imagina un plan astucieux.
Il laissa derrière lui des empreintes trompeuses, fit semblant de tomber dans un piège et conduisit la hyène à se coincer elle-même dans un buisson épineux. Chaque farce était plus drôle et surprenante que la précédente, et bientôt, même les autres animaux de la savane venaient applaudir les tours de ce dernier.
Mais le lièvre n'était pas cruel. Avec un sourire malicieux, il libéra la hyène, lui montrant que l'intelligence et la ruse pouvaient être plus fortes que la force brute.
Et depuis ce jour, tous les habitants de la savane racontent encore les exploits de la créature à grandes oreilles, héros petit mais redoutablement malin.`,
    },
    {
      id: 3,
      type: 'conte',
      title: 'Conte - Russie : Vassilissa la très belle',
      text: `Au coeur des forêts enneigées de Russie, là où les pins s'étiraient vers le ciel et où la neige crissait sous les pas, vivait Vassilissa, une jeune fille d'une beauté éclatante et d'un coeur pur. Elle portait toujours avec elle une poupée de chiffon, cadeau de sa mère disparue, qui semblait parler et donner des conseils secrets à celle qui savait écouter.
Orpheline, elle vivait avec sa méchante belle-mère et ses deux demi-soeurs jalouses, qui ne cessaient de lui imposer des tâches impossibles. Mais la poupée, animée d'une magie subtile, guidait Vassilissa et l'aidait à accomplir ses corvées avec habileté et intelligence.
Un jour, la belle-mère, avide de se débarrasser d'elle, l'envoya chercher du feu chez la redoutable sorcière Baba Yaga, cachée au fond de la forêt. Courageuse mais prudente, Vassilissa suivit les conseils de sa poupée, traversa ponts instables, rivières glacées et créatures mystérieuses, et réussit à accomplir les tâches impossibles que la femme lui imposait.
Grâce à sa ruse, sa patience et l'aide de la poupée magique, l'enfant revint saine et sauve, portant le feu comme un triomphe de sa bonté et de son courage.
Depuis ce jour, les contes russes parlent encore de Vassilissa, la jeune fille qui triomphait toujours des épreuves avec intelligence et coeur pur.`,
    },
    {
      id: 4,
      type: 'conte',
      title: 'Conte - Canada : L’ours géant et l’enfant',
      text: `Dans les forêts profondes du Canada, là où les rivières scintillaient comme des rubans d'argent et où les montagnes se dressaient majestueusement, vivait un petit enfant curieux et courageux.
Un jour, alors qu'il explorait les bois en suivant le chant des oiseaux, il rencontra un ours géant au pelage brun doré, imposant mais aux yeux d'une douceur surprenante.
L'animal, protecteur de la forêt, était sage et puissant, et il connaissait tous les secrets de la faune et de la flore. Il mit l'enfant à l'épreuve : il dû traverser une rivière tumultueuse, escalader une colline escarpée et comprendre le langage des oiseaux et des arbres. Mais chaque épreuve était en réalité un enseignement sur le courage, la patience et le respect de la nature.
Avec chaque étape, le jeune garçon comprit que la force ne résidait pas seulement dans la taille ou la puissance, mais dans l'intelligence, l'empathie et le respect de son environnement. L'ours géant, impressionné par son coeur pur et sa détermination, devint son allié et compagnon, le guidant à travers la forêt et lui transmettant les secrets anciens des créatures et de la terre.
Depuis ce jour, on raconte au Canada l'histoire de l'enfant qui marcha aux côtés de l'ours géant, apprenant à écouter, à respecter et à devenir un vrai ami de la forêt.`,
    },
    {
      id: 5,
      type: 'conte',
      title: 'Conte - Maroc : Le figuier magique',
      text: `Au coeur des ruelles animées du Maroc, sous un ciel azur où le soleil éclairait les mosaïques colorées, se trouvait un figuier ancien, immense et mystérieux, dont les branches semblaient toucher les nuages. On racontait que cet arbre n'était pas ordinaire : ses figues dorées étaient enchantées, capables d'exaucer les souhaits les plus sincères.
Un enfant curieux et intrépide s'approcha un matin, attiré par l'odeur sucrée des fruits et le bruissement des feuilles. Alors qu'il tendait la main pour cueillir une figue, l'arbre se mit à parler dans un murmure doux et rassurant, révélant que seul celui qui possédait un coeur pur pouvait goûter à sa magie.
Pour prouver sa valeur, il devait faire preuve de courage, de générosité et d'ingéniosité : partager ses trouvailles avec les habitants du village, aider les animaux de la place et résoudre des énigmes laissées par les anciens du royaume. À chaque acte de bonté, les figues du figuier brillaient plus fort, et l'enfant sentait une énergie chaude et bienveillante parcourir ses doigts.
Finalement, ayant démontré sa sagesse et son coeur généreux, il put cueillir une figue magique. Cette dernière ne donnait pas seulement la chance ou la richesse, mais révélait les secrets pour comprendre et respecter les gens, la nature et la magie qui se cache dans chaque geste quotidien.`,
    },
    {
      id: 6,
      type: 'conte',
      title: 'Conte - Chine : La princesse éventail',
      text: `Dans les jardins impériaux baignés de brume matinale, où les lotus flottaient sur les bassins et où les pavillons aux toits dorés reflétaient la lumière du soleil, vivait une princesse renommée pour sa beauté et sa sagesse. Mais ce qui la distinguait le plus était son éventail en soie brodée d'or et de jade, capable de contrôler le vent et de murmurer les secrets du ciel.
Un jour, une grande sécheresse frappa le royaume. Les rivières s'asséchèrent et les arbres perdirent leurs feuilles. La princesse, connue pour son coeur généreux et sa détermination, prit son éventail magique et s'avança dans le jardin. Chaque mouvement de l'objet faisait danser la brise et onduler les nuages, et bientôt, un vent doux et humide se leva, apportant la pluie salvatrice sur les champs desséchés.
Mais la princesse n'utilisait pas sa magie uniquement pour des miracles visibles : elle enseignait aux villageois l'importance de la patience, de la sagesse et du respect pour la nature, leur montrant que chaque geste, même petit, pouvait faire naître le changement.
Grâce à elle, les rivières reprirent vie, les fleurs s'épanouirent et les enfants jouaient à l'ombre des cerisiers en fleurs, tout en écoutant les histoires que soufflait le vent de son éventail.`,
    },
    {
      id: 7,
      type: 'conte',
      title: 'Conte - Irlande : Le géant Fionn et Benandonner',
      text: `Dans les collines verdoyantes et brumeuses d'Irlande, là où les moutons paissaient paisiblement et où le vent portait le parfum de l'herbe fraîche, vivait un jeune géant nommé Fionn. Curieux et courageux, il adorait explorer les landes et écouter les histoires des anciens, apprenant les légendes des druides et des guerriers d'antan.
Un matin, il entendit parler d'un géant colossal nommé Benandonner, qui vivait de l'autre côté de la mer et terrorisait les villages de ses pas gigantesques. Déterminé à protéger son pays et à prouver son courage, Fionn décida de se rendre à la rencontre de ce dernier.
Mais Fionn était malin et rusé : lorsqu'il le croisa, il remarqua que le géant était énorme et redoutable, mais qu'il se moquait de sa propre force lorsqu'il rit de ses erreurs. Fionn usa alors de ruse et d'astuce. Il fit croire à Benandonner qu'il était un géant encore plus puissant, et par une série de jeux d'ombres et de tromperies, il réussit à faire fuir la créature vers l'autre côté de la mer.
Depuis ce jour, Fionn devint le protecteur des collines irlandaises, et les villageois racontent encore comment un jeune géant malin avait surpassé un de ses congénaires terrible, transformant la peur en légende et le danger en histoire à raconter autour du feu.`,
    },
    {
      id: 8,
      type: 'conte',
      title: 'Conte - Pérou : Le colibri courageux',
      text: `Dans les hauteurs vertigineuses des Andes péruviennes, là où les sommets effleurent les nuages et où les torrents grondent dans les vallées, vivait un petit colibri au plumage éclatant. Bien que minuscule et fragile face aux montagnes imposantes et aux dangers qui rôdaient, ce colibri avait un courage qui dépassait sa taille.
Un jour, un incendie éclata dans la forêt qui nourrissait la faune et la flore des montagnes. Les grandes créatures s'effrayaient, et personne n'osait s'approcher des flammes. Mais le petit colibri, déterminé à protéger la vie autour de lui, vola droit vers le feu. Il transportait de minuscules gouttes d'eau dans son bec, tombant sans relâche sur les flammes.
Malgré la chaleur et la fatigue, le colibri ne céda jamais. Les autres animaux, inspirés par sa détermination et son courage, commencèrent à l'aider. Ensemble, ils parvinrent à éteindre l'incendie, sauvant ainsi la forêt et tous ses habitants.
Depuis ce jour, le colibri est célébré dans les légendes péruviennes comme le symbole du courage et de la persévérance, prouvant que même les plus petits peuvent accomplir de grands exploits si leur coeur est vaillant.`,
    },
    {
      id: 9,
      type: 'conte',
      title: 'Conte - Égypte : Le secret du Nil',
      text: `Au coeur de l'Égypte ancienne, là où le Nil serpentait comme un ruban bleu entre les sables dorés, se trouvait un village paisible dont les habitants vivaient en harmonie avec le fleuve sacré. On racontait qu'au crépuscule, lorsque le soleil baignait les rives d'une lumière d'or, le Nil révélait ses secrets aux coeurs courageux.
Un jeune garçon du village, curieux et intrépide, rêvait de découvrir ce mystère. Chaque soir, il s'asseyait au bord de l'eau, écoutant le murmure des vagues et observant les reflets dansants du soleil. Une nuit, le fleuve sembla s'animer, et une lumière scintillante surgit à la surface.
Guidé par cette lueur, l'enfant navigua sur une petite barque, découvrant une île cachée où les plantes et les animaux semblaient parler entre eux. Là, un ancien esprit du Nil lui confia que le secret de la vie résidait dans l'équilibre et le respect de la nature, dans la manière dont le fleuve nourrissait la terre et les hommes, jour après jour.
De retour au village, le jeune homme partagea cette sagesse : il enseigna aux habitants à écouter le fleuve et à protéger ses eaux, et le village prospéra comme jamais.
Depuis ce temps, le Nil est célébré non seulement pour ses eaux fertiles, mais aussi pour les secrets qu'il murmure à ceux qui savent regarder et écouter.`,
    },
    {
      id: 10,
      type: 'conte',
      title: 'Conte - Australie : Tiddalik, la grenouille',
      text: `Dans les vastes étendues rouges de l'Australie, là où les eucalyptus s'élançaient vers le ciel et où le sable chaud crissait sous les pieds, vivait Tiddalik, une grenouille pas comme les autres. Sa particularité ? Il pouvait boire toute l'eau du pays, et lorsqu'il était gourmand, il ne laissait aucune goutte pour les autres.
Un jour, il eut une soif insatiable et avala tous les lacs, rivières et mares de la région. Les kangourous, les wombats, les perruches et les lézards se retrouvèrent sans une seule goutte d'eau. Le désert, déjà chaud, devint impitoyable, et les animaux étaient au bord du désespoir.
Alors, ils décidèrent d'unir leurs forces. Chaque animal essaya de le faire rire, car selon la légende, rire faisait relâcher l'eau avalée par Tiddalik. Les oiseaux chantèrent de folles mélodies, les kangourous sautèrent en cadence, et les wombats se roulèrent dans le sable jusqu'à ce que Tiddalik éclate de rire, et en un instant, toute l'eau revint dans les rivières et les lacs, rendant la vie à la terre et à ses habitants.
Depuis ce jour, on raconte que la grenouille veille sur l'eau, rappelant à tous que la générosité et le partage sont essentiels à la survie de chacun.`,
    },
    {
      id: 11,
      type: 'conte',
      title: 'Conte - Allemagne : Le joueur de flûte de Hamelin',
      text: `Dans la ville pittoresque d'Hamelin, aux maisons à colombages et aux ruelles pavées, un problème inquiétant pesait sur les habitants : une invasion de rats qui dévoraient les récoltes, envahissaient les maisons et troublaient le sommeil des habitants.
Un jour, un étrange joueur de flûte fit son apparition. Vêtu d'un manteau coloré et tenant une flûte aux reflets dorés, il proposa son aide contre une promesse : être payé généreusement pour se débarrasser des rongeurs. Désespérés, les habitants acceptèrent.
Le joueur de flûte leva son instrument à ses lèvres et une mélodie envoûtante s'éleva dans l'air. Les rats, charmés et hypnotisés, le suivirent sans un bruit. Ils sortirent de chaque maison, de chaque cave et de chaque recoin, marchant derrière lui jusqu'à la rivière, où ils disparurent à jamais.
Mais, hélas, une fois sa mission accomplie, les habitants refusèrent de le payer comme convenu. Furieux, le joueur de flûte joua de nouveau une mélodie magique, et cette fois-ci, les enfants d'Hamelin furent emportés par la musique, marchant derrière lui hors de la ville, comme les rats autrefois, laissant derrière eux une ville silencieuse et pleine de remords.`,
    },
    {
      id: 12,
      type: 'conte',
      title: 'Conte - Inde : Le prince au cobra',
      text: `Dans un royaume lointain d'Inde, aux palais aux dômes dorés et aux jardins luxuriants, vivait un jeune prince courageux. Sa curiosité et son courage le poussaient souvent à explorer les forêts et les rivières qui entouraient son palais.
Un jour, alors qu'il se promenait près d'un étang sacré, il rencontra un cobra majestueux, aux écailles scintillantes et aux yeux perçants. Mais ce n'était pas un serpent ordinaire : il pouvait parler et possédait des pouvoirs magiques anciens. Ce dernier expliqua au prince qu'un grand danger menaçait le royaume, et que seul un coeur pur et courageux pourrait déjouer ce sort.
Le prince accepta la mission. Grâce aux conseils du reptile et à son intelligence, il traversa des épreuves mystérieuses : résoudre des énigmes, franchir des ponts invisibles et affronter des illusions trompeuses. À chaque défi, le cobra l'accompagnait, enseignant la patience, la prudence et le respect de la nature.
Finalement, grâce à leur alliance, le prince réussit à sauver le royaume et à ramener la paix et la prospérité. En signe de gratitude, le cobra se transforma en joyau magique, symbole de sagesse et de courage, que le prince porta toujours avec lui.`,
    },
    {
      id: 13,
      type: 'conte',
      title: 'Conte - Groenland : L’ourse et la chasseuse',
      text: `Au coeur des vastes glaces du Groenland, là où le vent hurlait et où la neige recouvrait tout, vivait une jeune chasseuse courageuse. Sa peau rosée par le froid et ses yeux perçants lui permettaient de repérer les moindres traces dans la neige immaculée.
Un matin, alors qu'elle suivait des empreintes mystérieuses, elle rencontra une grande ourse blanche, majestueuse et imposante, mais étonnamment douce dans son regard. La créature parlait un langage secret que seuls les habitants du Groenland pouvaient comprendre. Elle confia à la chasseuse une mission : protéger les animaux et les esprits de la glace d'un danger imminent.
La chasseuse accepta. Ensemble, elles traversèrent des fjords gelés, escaladèrent des montagnes couvertes de neige et affrontèrent les tempêtes polaires. Chaque pas était un défi, mais la présence de l'ourse la guidait et la protégeait. La chasseuse apprit à écouter la nature, à comprendre les murmures des vents et le chant des aurores boréales.
À la fin de leur périple, la chasseuse avait non seulement sauvé les créatures du Groenland, mais elle avait aussi tissé un lien indestructible avec l'ourse, qui devint sa protectrice éternelle.
Les habitants du village racontent encore que, lorsque la neige tombe doucement, on peut voir l'ourse et la chasseuse parcourir les étendues glacées, unies par un courage et une amitié hors du commun.`,
    },
    {
      id: 14,
      type: 'conte',
      title: 'Conte - Italie : Giufà et l’âne',
      text: `Dans un petit village ensoleillé d'Italie, au pied des collines et entre les oliveraies, vivait Giufà, un garçon malin et plein de malice. Il possédait un âne têtu mais attachant, qui semblait parfois comprendre mieux que Giufà lui-même.
Un jour, le village organisa une fête et le jeune homme fut chargé de conduire son animal au marché pour y vendre des produits. Mais l'âne, espiègle et obstiné, refusait d'avancer droit et se mit à zigzaguer entre les rues pavées. Giufà dut user de toute son ingéniosité pour le guider : il chanta de drôles de chansons, fit des tours de magie et même des petites farces pour le distraire.
Finalement, grâce à son esprit vif et à sa patience, il réussit à le mener au marché. Les villageois, émerveillés par son habileté et amusés par les facéties de l'âne, le félicitèrent et racontèrent cette aventure longtemps après.
Giufà et son âne devinrent un symbole de ruse, de courage et de joie de vivre dans tout le village, rappelant que même face à des obstacles inattendus, l'intelligence et l'humour peuvent toujours triompher.`,
    },
    {
      id: 15,
      type: 'conte',
      title: 'Conte - Kenya : Le feu volant',
      text: `Dans les vastes plaines dorées du Kenya, là où le vent faisait onduler les hautes herbes et où les acacias dessinaient des ombres légères sur la terre chaude, vivait un jeune garçon courageux nommé Kibaru. Ses yeux noirs brillaient comme des braises et ses cheveux courts dansaient sous le soleil de midi.
Un soir, alors que le ciel se teintait d'orange et de pourpre, Kibaru aperçut un phénomène étrange : des flammes flottantes, comme des lucioles ardentes, qui s'élevaient dans les airs sans brûler les herbes ni les arbres. Fasciné, il décida de les suivre. Chaque pas le menait plus loin, à travers rivières et collines, guidé par la lumière tremblante du feu volant.
Ces flammes, selon la légende, étaient les esprits protecteurs de la savane, envoyés pour aider ceux qui montraient courage et bonté. Kibaru découvrit qu'en capturant leur lumière dans une petite calebasse, il pouvait transporter le feu d'un village à l'autre, permettant aux habitants de cuisiner, de s'éclairer et de se réchauffer, même lors des nuits les plus sombres.
Mais il devait être prudent : le feu volant était capricieux. S'il devenait impatient, il s'envolait et disparaissait dans le ciel étoilé.
Grâce à sa patience et son respect pour les esprits, Kibaru apprit à danser avec les flammes, à les guider sans jamais les contraindre, transformant ainsi chaque nuit en un spectacle lumineux fascinant.`,
    },
    {
      id: 16,
      type: 'conte',
      title: 'Conte - Chili : La lune et le renard',
      text: `Dans les montagnes arides et mystérieuses du Chili, là où les sommets s'élancent vers le ciel et où le vent murmure aux pierres, vivait un renard rusé et curieux nommé Chai. Son pelage roux flamboyant se fondait parfois avec les roches, et ses yeux dorés reflétaient les éclats de la lune qui baignait les vallées chaque nuit.
Un jour, alors que la lune brillait plus intensément que jamais, Chai, la regarda descendre du ciel et parler dans un souffle léger :
Renard, si tu veux comprendre les secrets de la nuit, suis mes rayons et observe avec attention.
Fasciné et prudent, l'animal suivit la lueur argentée à travers les rochers, les rivières scintillantes et les forêts clairsemées.
Au fil de son voyage nocturne, le renard comprit que la lune n'éclairait pas seulement la terre, mais révélait également la vérité dans le coeur de ceux qui l'observaient. Chaque rayon lui enseignait la patience, l'humilité et la valeur de la curiosité : apprendre à écouter le monde avant d'agir.
À la fin de son périple, il réalisa que l'astre lui avait offert un cadeau invisible mais puissant : la sagesse de voir ce que les yeux seuls ne peuvent percevoir.
Depuis ce soir-là, il partageait sa ruse et sa connaissance avec les autres animaux, devenant un guide respecté dans les montagnes chiliennes.`,
    },
    {
      id: 17,
      type: 'conte',
      title: 'Conte - France : Le Petit Poucet',
      text: `Dans une forêt dense et mystérieuse de France, où les arbres s'élançaient vers le ciel et où chaque ombre semblait abriter un secret, vivait un petit garçon astucieux appelé Poucet. Bien que minuscule de taille, son esprit était immense, et ses yeux pétillants d'intelligence brillaient à travers les feuilles des arbres comme deux étoiles dans la nuit.
Un soir, alors que la lune se glissait entre les branches, le petit bonhomme fut confronté à un grand danger : ses frères et lui avaient été abandonnés par leurs parents, perdus au coeur de la forêt. Mais Poucet, avec son courage et sa ruse, laissa tomber derrière lui de petites pierres blanches qui brillaient sous la lune. Ainsi, ils purent retrouver leur chemin, pas à pas, guidés par le scintillement fragile mais constant des cailloux.
Plus tard, confronté au terrible ogre, l'enfant usa encore de son intelligence : il échangea les bonnets de ses frères avec les siens, trompant l'ogre et sauvant sa famille grâce à son audace et son esprit vif.`,
    },
    {
      id: 18,
      type: 'conte',
      title: 'Conte - Corée du Sud : La grue reconnaissante',
      text: `Dans un village tranquille de Corée, niché entre des collines verdoyantes et des rivières scintillantes, vivait un homme pauvre mais au coeur généreux. Un soir d'hiver, alors qu'il marchait seul sous le vent glacé, il trouva une grue blessée, ses ailes froissées et ses plumes ébouriffées par la neige. Poussé par la compassion, il la recueillit et prit soin d'elle avec patience et douceur, lui offrant chaleur et nourriture.
Quelques jours plus tard, l'oiseau disparut mystérieusement, mais bientôt, une étrange femme silencieuse frappa à sa porte. Elle proposa de tisser pour lui de magnifiques étoffes, mais à une condition : il ne devait jamais regarder ce qu'elle faisait. Curieux mais respectueux, il accepta et bientôt, il reçut des tissus d'une beauté incroyable, faits de fil d'argent et de soie lumineuse.
Un soir, sa curiosité le poussa à jeter un coup d'oeil, et il découvrit que la femme n'était autre que la grue elle-même, transformée par reconnaissance pour sa bonté. Impressionné par sa fidélité et son coeur pur, il comprit alors que la générosité attirait toujours la magie et la reconnaissance sous des formes inattendues.`,
    },
    {
      id: 19,
      type: 'conte',
      title: 'Conte - Brésil : La tortue et le jaguar',
      text: `Au coeur de la forêt amazonienne, dense et vibrante de vie, vivait une tortue rusée et réfléchie, toujours attentive aux moindres bruits et mouvements de la jungle.
Un jour, alors qu'elle se promenait près de la rivière, elle rencontra un jaguar affamé, majestueux et redoutable, dont le regard perçant trahissait l'envie de la dévorer.
La tortue, au lieu de céder à la panique, eut une idée brillante. Elle l'invita à participer à un concours : qui pourrait atteindre le vieux figuier au sommet de la colline avant l'autre ? Celui-ci, sûr de sa rapidité et de sa force, accepta sans hésiter.
Tout le long du chemin, la tortue avançait lentement mais avec une ruse astucieuse : elle laissait des indices trompeurs, faisait semblant de se perdre, et utilisait les racines et les troncs pour ralentir le jaguar. Finalement, il arriva épuisé et confus, tandis qu'elle, sans hâte mais avec intelligence, atteignit le figuier en premier.
Le félin, impressionné et respectueux de l'ingéniosité de la tortue, renonça à sa faim et devint un allié inattendu, partageant avec elle la richesse de la forêt et les secrets des animaux.`,
    },
    {
      id: 20,
      type: 'conte',
      title: 'Conte - Iran : Le tapis volant',
      text: `Dans les bazars colorés et animés d'une ville ancienne de Perse, un jeune garçon découvrit un tapis ancien et poussiéreux, caché derrière des tissus et des lanternes scintillantes. Ce tapis n'était pas ordinaire : ses fils d'or et de soie s'animaient dès qu'on posait un pied dessus, et il s'élevait dans les airs, prêt à emporter son voyageur vers des horizons insoupçonnés.
Le garçon, émerveillé et un peu craintif, s'installa au centre du tapis. Aussitôt, il senti le vent caresser son visage et vit les ruelles se rétrécir sous lui alors qu'il s'élevait au-dessus de la commune. Le tapis vola entre les minarets et les jardins suspendus, passant au-dessus des marchés parfumés et des fontaines chantantes.
Chaque mouvement du tapis était magique et fluide, comme guidé par l'air lui-même. Il traversa des vallées désertiques, survola des montagnes majestueuses, et emmena son passager dans des paysages merveilleusement variés, où les couleurs et les sons semblaient sortir d'un rêve.`,
    },
    {
      id: 21,
      type: 'conte',
      title: 'Conte - Thaïlande : La mangue du roi',
      text: `Dans le royaume verdoyant de Thaïlande, au coeur de jardins luxuriants et parfumés, un jeune garçon s'approcha d'un arbre majestueux, le manguier du roi, dont les fruits étaient réputés plus sucrés et juteux que tous les autres. On raconte que celui qui goûte une de ces mangues ressent la magie du royaume et obtient la sagesse et la chance.
Ce dernier, curieux et émerveillé, tendit la main vers un fruit doré suspendu haut dans les branches. Dès qu'il toucha la mangue, un doux parfum tropical envahit l'air, et une lumière chaleureuse enveloppa ses doigts, comme si le soleil lui-même s'était glissé dans l'arbre.
Soudain, le fruit se détacha et descendit doucement, guidé par un souffle magique, jusqu'à lui. En la goûtant, il ressentit un éclat de bonheur et d'énergie, voyant autour de lui les éléphants, les rizières étincelantes et les temples scintillants, tous baignés dans une lumière dorée.`,
    },
    {
      id: 22,
      type: 'conte',
      title: 'Conte - Angleterre : Jack et le haricot magique',
      text: `Dans un petit village anglais bordé de collines verdoyantes, vivait Jack, un garçon pauvre mais audacieux, qui partageait sa vie avec sa mère dans une maisonnette en bois.
Un matin, la seule vache de la famille ne donna plus de lait. Sa mère, inquiète, demanda à son fils de la vendre au marché afin de survivre.
Sur le chemin, Jack rencontra un vieil homme mystérieux qui lui proposa d'échanger la vache contre quelques haricots extraordinaires, brillants et colorés, avec un éclat presque magique. L'enfant accepta, intrigué. De retour à la maison, sa mère, furieuse, jeta les haricots par la fenêtre.
La nuit tomba, et sous l'éclat de la lune, un haricot poussa, grandit jusqu'au ciel ! Il devint un immense haricot magique qui s'éleva au-dessus des nuages, vers un monde inconnu. Jack, courageux et curieux, décida de grimper le long de cette liane vertigineuse.
Au sommet, il découvrit un palais fantastique, abritant un ogre immense et des trésors fabuleux. Les sons du château résonnaient dans le vent : le tintement de pièces d'or, le rugissement de l'ogre et les chants des oiseaux du ciel.
L'enfant, rusé et audacieux, utilisa son intelligence et son courage afin de récupérer les trésors et retrouver le chemin vers la maison, en faisant preuve d'ingéniosité et de bravoure.`,
    },
    {
      id: 23,
      type: 'conte',
      title: 'Conte - Vietnam : L’enfant des rizières',
      text: `Dans un petit village niché au coeur des rizières verdoyantes du Vietnam, vivait un enfant nommé Minh, curieux et débordant d'énergie. Chaque matin, il parcourait les sentiers étroits entre les champs inondés, observant les reflets du soleil sur l'eau et écoutant le doux murmure du vent dans les palmiers.
Un jour, alors qu'il jouait près d'un petit ruisseau, il découvrit un canard blessé. Avec douceur et patience, il le soigna, s'occupant de ses ailes et de ses plumes trempées. L'animal, reconnaissant, devint son compagnon fidèle, l'accompagnant dans toutes ses aventures à travers les rizières.
Mais ces terres regorgeaient de mystères. Entre les brumes matinales, Minh aperçut des créatures étranges et bienveillantes, qui semblaient garder les secrets des champs et des cours d'eau. Il apprit à comprendre le langage des animaux, à écouter les légendes transmises par les anciens, et à respecter la magie qui imprégnait chaque élément de la nature.
Un jour, une inondation menaça les rizières du village. Grâce à son intelligence, son courage et l'aide de son fidèle canard, Minh parvint à guider les villageois et à protéger les champs. Sa bravoure devint une légende locale, et l'enfant des rizières fut célébré comme un héros humble et sage, capable d'harmoniser le monde naturel et humain autour de lui.`,
    },
    {
      id: 24,
      type: 'conte',
      title: 'Conte - Espagne : Le tambour enchanté',
      text: `Dans un petit village d'Espagne, niché entre les collines et les oliveraies, vivait un jeune garçon nommé Diego, passionné par la musique et les fêtes traditionnelles. Son instrument préféré était un vieux tambour en bois, transmis de génération en génération dans sa famille, dont les battements résonnaient comme un coeur vibrant de vie et de légendes.
Un soir, alors que le soleil se couchait derrière les collines, Diego découvrit que le tambour possédait des pouvoirs magiques : chaque rythme qu'il jouait faisait danser les animaux, les villageois, et même les étoiles dans le ciel. Émerveillé, il décida de partager cette magie avec tout le village, et bientôt, une fête improvisée éclata, où chacun dansait et chantait, porté par la musique enchantée du tambour.
Mais la magie n'était pas sans défis. Les sons du tambour attirèrent également des esprits farceurs, qui cherchaient à troubler l'harmonie du village. Avec courage et ingéniosité, Diego apprit à jouer de douces mélodies, apaisant les esprits, ce qui renforça le lien entre les habitants, la faune et la flore.
Grâce à son tambour enchanté, Diego devint le gardien de la joie et des traditions, rappelant à tous que la musique pouvait unir les coeurs et transformer chaque journée en un moment extraordinaire.`,
    },
    {
      id: 25,
      type: 'conte',
      title: 'Conte - Haïti : Ti-Jean et le diable',
      text: `Dans un village coloré d'Haïti, bordé par des champs de canne à sucre et des collines verdoyantes, vivait un petit garçon nommé Ti-Jean, vif et malin, connu pour son esprit rusé et son sourire espiègle.
Un jour, alors qu'il cueillait des fruits près de la rivière, le diable apparut, décidé à tester l'ingéniosité des humains et à attirer les âmes naïves dans ses tours diaboliques.
Mais Ti-Jean n'était pas un enfant ordinaire. Avec son intelligence, son courage et une bonne dose d'audace, il réussit à tromper le diable à chaque épreuve. Que ce soit en échangeant des objets, en créant des illusions ou en racontant des histoires confuses, ce dernier déjoua les pièges avec humour et ingéniosité.
À chaque défi relevé, il montrait que la ruse et la créativité pouvaient vaincre même les plus grandes forces. Les villageois, émerveillés par ses exploits, racontaient ses aventures autour des feux de camp, et Ti-Jean devint un symbole de courage et de vivacité.`,
    },
    {
      id: 26,
      type: 'conte',
      title: 'Conte - Turquie : Nasreddine et l’âne',
      text: `Dans un petit village turc baigné de soleil, aux ruelles étroites et aux marchés animés, vivait Nasreddine, un homme sage et espiègle, connu pour son humour et ses réponses pleines de bon sens. Un jour, alors qu'il chevauchait son fidèle âne, il croisa des villageois qui se moquaient de lui, le jugeant toujours un peu bizarre.
Mais Nasreddine ne se laissa jamais déstabiliser. Avec un sourire malicieux et une logique inattendue, il transforma chaque situation ridicule en une leçon pleine d'esprit. Que ce soit en discutant avec les marchands, en résolvant des querelles ou en improvisant de drôles d'histoires, il montrait que l'intelligence et l'humour étaient des armes plus puissantes que la force.
L'âne, fidèle compagnon de ses aventures, participait souvent involontairement aux tours et aux situations comiques, ajoutant encore plus de charme et de rires à chaque anecdote. Les villageois racontaient ensuite ses exploits dans les cafés et sous les arbres, riant des situations absurdes et admirant la sagacité de l'homme.`,
    },
    {
      id: 27,
      type: 'conte',
      title: 'Conte - Nouvelle-Zélande : Maui ralentit le soleil',
      text: `Dans les terres vertes et mystérieuses de la Nouvelle-Zélande, entre montagnes majestueuses et forêts denses, vivait Maui, un demi-dieu espiègle aux exploits légendaires. Un jour, voyant que les journées étaient trop courtes pour permettre aux hommes et aux femmes de finir leur travail, il décida de ralentir le soleil.
Avec courage et ruse, il grimpa sur le sommet d'une montagne et lança un lasso magique, fabriqué à partir des cheveux de sa grand-mère. Il attrapa le soleil, qui se débattait avec force, illuminant le ciel de sa lumière éclatante. Grâce à son ingéniosité et sa détermination, Maui réussit à ralentir sa course, offrant aux humains de longues journées pour pêcher, cultiver et profiter de la vie.
Ce geste héroïque n'était pas seulement un exploit physique, mais un acte plein de malice et d'ingéniosité, car l'homme savait que l'intelligence et la créativité étaient des forces aussi puissantes que le courage.
Les habitants racontèrent encore et encore cette aventure, admirant le demi-dieu qui avait su apprivoiser le soleil lui-même.`,
    },
    {
      id: 28,
      type: 'conte',
      title: 'Conte - Mali : L’hippopotame et les étoiles',
      text: `Au bord du grand fleuve Niger, sous le ciel étoilé du Mali, vivait un hippopotame curieux et rêveur. Chaque nuit, il regardait les étoiles briller et se demandait pourquoi elles semblaient si loin et inaccessibles. Les autres animaux riaient de ses rêveries, mais lui savait qu'un jour, il trouverait un moyen de toucher ces points lumineux qui scintillaient au-dessus de sa tête.
Une nuit, guidé par la lueur des astres, il entreprit un voyage extraordinaire, traversant rivières et marécages, parlant aux lucioles et aux hiboux qui l'accompagnaient. Avec patience et courage, il construisit un bâton magique, gravé de symboles anciens et lumineux, qui lui permit de capturer un fragment d'étoile.
Grâce à sa persévérance, l'hippopotame réalisa que même les rêves les plus grands pouvaient être atteints si l'on osait avancer avec le coeur ouvert et l'esprit attentif.
Les étoiles, touchées par sa détermination, continuèrent de briller plus fort, illuminant le fleuve et inspirant tous les animaux et les humains qui vivaient autour de lui.`,
    },
    {
      id: 29,
      type: 'conte',
      title: 'Conte - Pologne : Le roi grenouille',
      text: `Dans une forêt ancienne et mystérieuse de Pologne, vivait un roi transformé en grenouille, enfermé par un sortilège mystérieux. Jadis noble et courageux, il passait ses journées sur les berges d'un étang scintillant, regardant les nuages se refléter dans l'eau et rêvant de retrouver sa forme humaine.
Un jour, une petite princesse curieuse s'aventura près de l'étang. Elle avait entendu parler de la légende du roi grenouille, mais elle ne craignait pas les apparences. Avec douceur et courage, elle engagea la conversation avec le prince transformé, écoutant ses histoires de royaumes lointains, de châteaux majestueux et de créatures fantastiques.
En échange de sa gentillesse et de sa patience, le roi grenouille offrit une promesse : quiconque oserait l'aider avec un coeur pur pourrait briser le sort et voir le royaume s'illuminer d'une magie ancienne. La princesse accepta le défi, réalisant que la confiance, le respect et le courage étaient souvent les clés pour libérer la magie cachée derrière les apparences.`,
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
