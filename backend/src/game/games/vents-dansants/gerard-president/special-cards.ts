import {
  freezeGameContent,
  gameEffects,
} from '../../../core/application/public-api';
import type { GameEffectInstruction } from '../../../core/application/public-api';

export const GERARD_SPECIAL_EFFECTS = [
  'sabotage',
  'double-prenom',
  'double-theme',
  'interdiction',
  'main-fantome',
  'defense-totale',
  'echange-force',
  'panique-generale',
  'retour-envoyeur',
  'theme-secret',
  'chuchotement-confus',
  'mega-combo',
  'inversion',
  'jury-mystere',
  'effet-domino',
  'prenom-fantome',
  'inversion-role',
  'chaos-temporel',
  'ultra-sabotage',
  'prenom-volant',
] as const;
export type GerardSpecialEffect = (typeof GERARD_SPECIAL_EFFECTS)[number];

export interface GerardPresidentSpecialCard {
  id: string;
  name: string;
  description: string;
  effect: GerardSpecialEffect;
  effects: readonly GameEffectInstruction[];
}

type RawGerardPresidentSpecialCard = Omit<
  GerardPresidentSpecialCard,
  'effects'
>;

const RAW_GERARD_PRESIDENT_SPECIAL_CARDS: RawGerardPresidentSpecialCard[] = [
  {
    id: 'special-sabotage',
    name: 'Carte Sabotage',
    description:
      'Cette carte te permet de désigner un joueur et de l?obliger à justifier à voix haute un prénom qui n?est pas le sien, choisi au hasard parmi ceux posés. Il devra improviser une explication absurde, logique ou hilarante pour ce prénom, même s?il ne l?a pas joué. De quoi créer des situations gênantes ou tordantes, surtout quand le sabotage tombe sur un prénom complètement improbable !',
    effect: 'sabotage',
  },
  {
    id: 'special-double-prenom',
    name: 'Carte Double Prénom',
    description:
      'Grâce à cette carte, tu peux jouer deux prénoms ensemble au lieu d?un seul. Ils doivent former un ?combo? crédible, absurde ou ridicule : à toi de créer une association qui fera mouche. Exemple : ?Bébert-Francis? pour un coach de zumba mystique, ou ?Brigitte-Damoclès? pour une astrologue de supermarché. Tu joues cette carte au moment où tu poses tes prénoms.',
    effect: 'double-prenom',
  },
  {
    id: 'special-double-theme',
    name: 'Carte Double Thème',
    description:
      'Lorsque tu es le joueur actif et que tu dois lire un thème, tu peux jouer cette carte pour en piocher un deuxième et combiner les deux. Tous les joueurs devront proposer un prénom qui colle aux deux situations en même temps. Cela donne des fusions absurdes comme : ?Le prénom d?un ancien cascadeur qui donne des cours de flûte à des hyènes? ou ?Le prénom d?une grand-mère recherchée par Interpol?. Fou rire garanti par surcharge d?imagination !',
    effect: 'double-theme',
  },
  {
    id: 'special-interdiction',
    name: 'Carte Interdiction',
    description:
      'Avec cette carte, tu annonces immédiatement après lecture du thème qu?un prénom précis est interdit ce tour-ci. Aucun joueur ne pourra poser ce prénom, même s?il est parfait pour le thème. Par exemple, tu peux dire : ?Interdiction de jouer ?Kevin? !? et regarder les autres paniquer s?ils l?avaient en main. Cela perturbe les plans et force à improviser.',
    effect: 'interdiction',
  },
  {
    id: 'special-main-fantome',
    name: 'Carte Main Fantôme',
    description:
      'Tu choisis un joueur, qui devra ce tour-ci jouer un prénom au hasard depuis sa main (sans le regarder !). Il pose la carte face cachée à l?aveugle, et découvre en même temps que tout le monde quel prénom il a envoyé au jury. Parfait pour ajouter un brin de chaos et d?auto-sabotage imprévisible.',
    effect: 'main-fantome',
  },
  {
    id: 'special-defense-totale',
    name: 'Carte Défense Totale',
    description:
      'Cette carte te protège pendant un tour. Si quelqu?un tente de te saboter, t?interdire un prénom que tu avais, ou t?imposer une carte Main Fantôme, tu peux dire ?Non !? et annuler l?effet immédiatement. Tu peux aussi l?utiliser pour éviter de devoir justifier ton prénom si tu es désigné. ? jouer juste après qu?un effet te cible.',
    effect: 'defense-totale',
  },
  {
    id: 'special-echange-force',
    name: 'Carte ?change Forcé',
    description:
      'Tu désignes un joueur et échangez 1 carte prénom de vos mains, au hasard ou choisie (selon ton choix). Cela peut te sauver d?une main pourrie ou ruiner celle d?un adversaire juste avant un thème parfait.',
    effect: 'echange-force',
  },
  {
    id: 'special-panique-generale',
    name: 'Carte Panique Générale',
    description:
      "À jouer juste après la lecture d'un thème. Tous les joueurs doivent défausser 3 cartes prénom de leur main et repiocher autant. Ça redistribue les chances et peut déséquilibrer les stratégies. Parfait quand tu sens que d'autres ont de trop bonnes mains !",
    effect: 'panique-generale',
  },
  {
    id: 'special-retour-envoyeur',
    name: 'Carte Retour à l?envoyeur',
    description:
      'Si tu es ciblé par une carte spéciale (Sabotage, Main Fantôme, etc.), tu peux jouer celle-ci pour renvoyer l?effet vers le joueur qui l?a lancé. Petit moment de revanche satisfaisant et de tension imprévisible.',
    effect: 'retour-envoyeur',
  },
  {
    id: 'special-theme-secret',
    name: 'Carte Thème Secret',
    description:
      'Tu es le joueur actif et tu tires le thème en secret. Tu annonces seulement une version raccourcie ou très vague (par exemple ?Le thème est? étrange !?). Tous les joueurs doivent proposer un prénom à l?aveugle. Puis, tu révèles le thème exact après lecture des prénoms. Cela crée des retournements de situation hilarants et injustes? donc forcément très drôles.',
    effect: 'theme-secret',
  },
  {
    id: 'special-chuchotement-confus',
    name: 'Carte Chuchotement Confus',
    description:
      'Tu choisis un joueur qui devra chuchoter son prénom à son voisin de gauche. Le voisin doit ensuite défendre ce prénom à haute voix comme s?il était le sien. Confusion et fous rires garantis !',
    effect: 'chuchotement-confus',
  },
  {
    id: 'special-mega-combo',
    name: 'Carte Méga Combo',
    description:
      'Permet de jouer trois prénoms en un seul, reliés par une histoire complètement improbable. Exemple : ?Gérard, Joséphine et Bob-Le-Cactus, survivants d?une apocalypse de crème chantilly.?',
    effect: 'mega-combo',
  },
  {
    id: 'special-inversion',
    name: 'Carte Inversion',
    description:
      'Tous les joueurs doivent échanger leur carte prénom jouée avec celle d?un autre joueur de leur choix avant la révélation. Le Maître du Thème voit alors des choix inattendus et absurdes.',
    effect: 'inversion',
  },
  {
    id: 'special-jury-mystere',
    name: 'Carte Jury Mystère',
    description:
      'Pour un tour seulement, le Maître du Thème n?est pas le joueur actif, mais un joueur choisi au hasard parmi ceux qui ont posé un prénom. Il choisit le gagnant à la place. Chaos garanti !',
    effect: 'jury-mystere',
  },
  {
    id: 'special-effet-domino',
    name: 'Carte Effet Domino',
    description:
      'Tu choisis un joueur ciblé : après avoir joué cette carte, chaque joueur suivant doit ajouter un adjectif ridicule à son prénom avant de le poser. Exemple : ?Gérard-?cureuil-Volant.?',
    effect: 'effet-domino',
  },
  {
    id: 'special-prenom-fantome',
    name: 'Carte Prénom Fantôme',
    description:
      'Tu joues cette carte après que tous les prénoms soient posés : tu peux ajouter un prénom ?fantôme? invisible pour le Maître du Thème. Il devra défendre ce prénom en imaginant qu?il a été joué par quelqu?un.',
    effect: 'prenom-fantome',
  },
  {
    id: 'special-inversion-role',
    name: 'Carte Inversion de Rôle',
    description:
      'Pour ce tour, tous les joueurs deviennent Maîtres du Thème et doivent voter à main levée pour choisir le prénom gagnant. Chaque joueur vote pour celui qu?il juge le plus absurde, même si ce n?est pas le sien.',
    effect: 'inversion-role',
  },
  {
    id: 'special-chaos-temporel',
    name: 'Carte Chaos Temporel',
    description:
      'Joue cette carte pour remonter le tour précédent : tous les joueurs reprennent leur prénom posé au tour précédent et le rejouent, mais avec une justification encore plus absurde.',
    effect: 'chaos-temporel',
  },
  {
    id: 'special-ultra-sabotage',
    name: 'Carte Ultra Sabotage',
    description:
      'Similaire à Sabotage, mais cible deux joueurs à la fois, qui doivent chacun justifier un prénom choisi au hasard. Les explications croisées peuvent devenir catastrophiquement drôles.',
    effect: 'ultra-sabotage',
  },
  {
    id: 'special-prenom-volant',
    name: 'Carte Prénom Volant',
    description:
      'Tu choisis un joueur dont tu peux voler une carte prénom de sa main pour la jouer immédiatement, en plus de ton propre prénom. Le joueur volé doit piocher une nouvelle carte en compensation.',
    effect: 'prenom-volant',
  },
];

export const GERARD_PRESIDENT_SPECIAL_CARDS: GerardPresidentSpecialCard[] =
  RAW_GERARD_PRESIDENT_SPECIAL_CARDS.map((card) => ({
    ...card,
    effects: [gameEffects.custom(`gerard.${card.effect}`)],
  }));

freezeGameContent(GERARD_PRESIDENT_SPECIAL_CARDS);
