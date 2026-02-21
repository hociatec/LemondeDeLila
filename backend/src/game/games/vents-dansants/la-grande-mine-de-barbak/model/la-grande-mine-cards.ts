export type LaGrandeMineCategory =
  | 'tresor'
  | 'objet'
  | 'event'
  | 'monster'
  | 'collapse';
export interface LaGrandeMineCard {
  id: string;
  name: string;
  category: LaGrandeMineCategory;
  description: string;
  points?: number | null;
}
const cards: LaGrandeMineCard[] = [
  {
    id: 'barbak-tresor-1',
    category: 'tresor',
    name: 'Lingot d’or étincelant',
    description: '(+2 points.)',
    points: 2,
  },
  {
    id: 'barbak-tresor-2',
    category: 'tresor',
    name: 'Sac de gemmes multicolores',
    description: '(+3 points.)',
    points: 3,
  },
  {
    id: 'barbak-tresor-3',
    category: 'tresor',
    name: 'Morceau de mithril pur – trésor rare,',
    description: '(+5 points.)',
    points: 5,
  },
  {
    id: 'barbak-tresor-4',
    category: 'tresor',
    name: 'Lingot d’or terni',
    description: '(+1 point.)',
    points: 1,
  },
  {
    id: 'barbak-tresor-5',
    category: 'tresor',
    name: 'Coffre piégé',
    description:
      "(si vous n'avez pas d’arme devant vous, vous perdez une carte au hasard. Sinon, vous gagnez +3 points.)",
    points: 3,
  },
  {
    id: 'barbak-tresor-6',
    category: 'tresor',
    name: 'Pierre philosophale en plâtre',
    description:
      '(faux trésor, vaut 0 point et ne sera révélé qu’au décompte final.)',
    points: 0,
  },
  {
    id: 'barbak-tresor-7',
    category: 'tresor',
    name: 'Champignon lumineux',
    description:
      '(vous gagnez +2 points seulement si vous possédez déjà une carte Bière.)',
    points: 2,
  },
  {
    id: 'barbak-tresor-8',
    category: 'tresor',
    name: 'Trésor ancien – trésor rare,',
    description: '(+6 points, mais il attire automatiquement les monstres.)',
    points: 6,
  },
  {
    id: 'barbak-tresor-9',
    category: 'tresor',
    name: 'Sceptre en mithril – trésor royal,',
    description: '(+7 points.)',
    points: 7,
  },
  {
    id: 'barbak-tresor-10',
    category: 'tresor',
    name: 'Fourrure de troll – trésor étrange,',
    description: '(+2 points ou -2 points (tirage automatique).)',
    points: 2,
  },
  {
    id: 'barbak-tresor-11',
    category: 'tresor',
    name: 'Mine de sel',
    description:
      '(vous gagnez +2 points, mais si vous possédez la carte “Bière renversée”, vous perdez 1 point.)',
    points: 2,
  },
  {
    id: 'barbak-tresor-12',
    category: 'tresor',
    name: 'Diamant chantant – trésor rare,',
    description:
      '(+5 points et vous pouvez regarder la carte du dessus de la pioche.)',
    points: 5,
  },
  {
    id: 'barbak-tresor-13',
    category: 'tresor',
    name: 'Rune perdue – trésor mystique,',
    description: '(+4 points.)',
    points: 4,
  },
  {
    id: 'barbak-tresor-14',
    category: 'tresor',
    name: 'Couronne en or massif – trésor royal,',
    description: '(+8 points.)',
    points: 8,
  },
  {
    id: 'barbak-tresor-15',
    category: 'tresor',
    name: 'Idole naine brisée',
    description: '(+2 points, ou +5 points si vous possédez déjà 3 Runes.)',
    points: 2,
  },
  {
    id: 'barbak-tresor-16',
    category: 'tresor',
    name: 'Pierre précieuse maudite',
    description:
      '(+3 points mais vous perdez 1 point pour chaque carte Bière que vous avez.)',
    points: 3,
  },
  {
    id: 'barbak-tresor-17',
    category: 'tresor',
    name: 'Rune de l’Aube – trésor mystique,',
    description: '(+4 points et vous êtes immunisé contre “Barbe en feu”.)',
    points: 4,
  },
  {
    id: 'barbak-tresor-18',
    category: 'tresor',
    name: 'Talisman de Barbe-Vie – trésor rare,',
    description:
      '(+3 points et il protège automatiquement votre carte “Barbe sacrée”.)',
    points: 3,
  },
  {
    id: 'barbak-objet-1',
    category: 'objet',
    name: 'Brouette percée',
    description:
      '(vous pouvez transporter 2 trésors, mais vous perdez 1 point.)',
    points: 1,
  },
  {
    id: 'barbak-objet-2',
    category: 'objet',
    name: 'Pioche runique',
    description:
      '(le prochain trésor que vous posez voit sa valeur doublée automatiquement.)',
    points: null,
  },
  {
    id: 'barbak-objet-3',
    category: 'objet',
    name: 'Casque cabossé',
    description:
      '(protège un trésor ou un objet contre un monstre, mais se casse après usage.)',
    points: null,
  },
  {
    id: 'barbak-objet-4',
    category: 'objet',
    name: 'Barbe postiche en mousse',
    description:
      '(vous êtes protégé contre les effets du “Concours de barbes”.)',
    points: null,
  },
  {
    id: 'barbak-objet-5',
    category: 'objet',
    name: 'Amulette de pierre runique',
    description: '(+1 point, permanent.)',
    points: 1,
  },
  {
    id: 'barbak-objet-6',
    category: 'objet',
    name: 'Marteau de forge légendaire',
    description: '(+2 points et vous êtes protégé contre un monstre.)',
    points: 2,
  },
  {
    id: 'barbak-objet-7',
    category: 'objet',
    name: 'Bière naine explosive',
    description:
      '(vous pouvez repousser un monstre, mais vous perdez 1 point.)',
    points: 1,
  },
  {
    id: 'barbak-objet-8',
    category: 'objet',
    name: 'Épée rouillée',
    description: '(protège une fois contre un goblin.)',
    points: null,
  },
  {
    id: 'barbak-objet-9',
    category: 'objet',
    name: 'Casque du Houblon Royal',
    description:
      '(+1 point, et +1 supplémentaire si vous possédez une carte Bière.)',
    points: 1,
  },
  {
    id: 'barbak-objet-10',
    category: 'objet',
    name: 'Pioche des Ancêtres',
    description:
      '(défaussez un trésor, mais choisissez celui que vous voulez perdre.)',
    points: null,
  },
  {
    id: 'barbak-objet-11',
    category: 'objet',
    name: 'Choppe sans fond',
    description:
      '(+2 points automatiquement à chaque tour où vous jouez un Objet.)',
    points: 2,
  },
  {
    id: 'barbak-objet-12',
    category: 'objet',
    name: 'Cape de Forge Ardente – objet rare,',
    description: '(+2 points et vous êtes protégé contre “Explosion de mine”.)',
    points: 2,
  },
  {
    id: 'barbak-objet-13',
    category: 'objet',
    name: 'Bière enchantée',
    description: '(annule automatiquement l’effet d’un monstre sur vous.)',
    points: null,
  },
  {
    id: 'barbak-objet-14',
    category: 'objet',
    name: 'Chapeau pointu ridicule',
    description:
      '(vous êtes protégé contre un événement, mais cette carte ne rapporte aucun point.)',
    points: null,
  },
  {
    id: 'barbak-objet-15',
    category: 'objet',
    name: 'Bouclier cabossé',
    description:
      '(annule une attaque de monstre ciblant votre trésor ou objet.)',
    points: null,
  },
  {
    id: 'barbak-objet-16',
    category: 'objet',
    name: 'Marteau de Gloire',
    description:
      '(+1 point et effrayez tous les goblins ciblant votre domaine ce tour-ci.)',
    points: 1,
  },
  {
    id: 'barbak-objet-17',
    category: 'objet',
    name: 'Hache de guerre',
    description: '(+2 points et êtes protégé contre un troll.)',
    points: 2,
  },
  {
    id: 'barbak-objet-18',
    category: 'objet',
    name: 'Rune protectrice',
    description: '(annule automatiquement la prochaine attaque contre vous.)',
    points: null,
  },
  {
    id: 'barbak-objet-19',
    category: 'objet',
    name: 'Corne de bataille',
    description: '(+1 point et annule un effet d’Éboulement mineur.)',
    points: 1,
  },
  {
    id: 'barbak-objet-20',
    category: 'objet',
    name: 'Lanterne magique',
    description: '(vous révélez les 3 prochaines cartes de la pioche.)',
    points: null,
  },
  {
    id: 'barbak-objet-21',
    category: 'objet',
    name: 'Bière éternelle –',
    description:
      '(objet rare, (+3 points si vous possédez au moins une autre Bière.)',
    points: 3,
  },
  {
    id: 'barbak-objet-22',
    category: 'objet',
    name: 'Ceinture Tressée de Forge',
    description: '(+2 points si vous possédez au moins un autre outil.)',
    points: 2,
  },
  {
    id: 'barbak-event-1',
    category: 'event',
    name: 'Choppe géante de bière',
    description: '(vous rejouez immédiatement.)',
    points: null,
  },
  {
    id: 'barbak-event-2',
    category: 'event',
    name: 'Tonneau percé',
    description: '(vous devez défausser une carte au hasard.)',
    points: null,
  },
  {
    id: 'barbak-event-3',
    category: 'event',
    name: 'Concours de rots',
    description:
      '(le joueur le plus bruyant gagne un trésor. (effet automatisé par une simulation sonore aléatoire))',
    points: null,
  },
  {
    id: 'barbak-event-4',
    category: 'event',
    name: 'Concours de barbes',
    description:
      '(le joueur à la plus longue barbe gagne +1 point. (effet automatisé par un aléatoire du système.))',
    points: 1,
  },
  {
    id: 'barbak-event-5',
    category: 'event',
    name: 'Festin gargantuesque',
    description: '(vous récupérez une carte depuis la défausse.)',
    points: null,
  },
  {
    id: 'barbak-event-6',
    category: 'event',
    name: 'Rot magique',
    description: '(annule l’effet de la dernière carte jouée.)',
    points: null,
  },
  {
    id: 'barbak-event-7',
    category: 'event',
    name: 'Barbe en feu',
    description:
      '(votre héros est posé face cachée jusqu’à votre prochain tour.)',
    points: null,
  },
  {
    id: 'barbak-event-8',
    category: 'event',
    name: 'Chant de taverne',
    description:
      '(tous les joueurs perdent aléatoirement une carte (sauf si vous possédez un objet protecteur).)',
    points: null,
  },
  {
    id: 'barbak-event-9',
    category: 'event',
    name: 'Tabouret cassé',
    description: '(vous perdez votre prochain tour.)',
    points: null,
  },
  {
    id: 'barbak-event-10',
    category: 'event',
    name: 'Chèvre têtue',
    description:
      '(vous donnez une carte aléatoirement de votre main au joueur suivant.)',
    points: null,
  },
  {
    id: 'barbak-event-11',
    category: 'event',
    name: 'Explosion de mine',
    description: '(tous les joueurs défaussent un trésor.)',
    points: null,
  },
  {
    id: 'barbak-event-12',
    category: 'event',
    name: 'Concours de bras de fer',
    description:
      '(deux joueurs s’affrontent automatiquement. Celui qui possède le plus de points de Trésors devant lui gagne et prend une carte au perdant. En cas d’égalité, le gagnant est choisi aléatoirement.)',
    points: null,
  },
  {
    id: 'barbak-event-13',
    category: 'event',
    name: 'Taverne itinérante',
    description: '(tous les joueurs piochent une carte supplémentaire.)',
    points: null,
  },
  {
    id: 'barbak-event-14',
    category: 'event',
    name: 'Chant épique des Ancêtres',
    description: '(vous piochez 2 cartes, puis en donnez 1 à un adversaire.)',
    points: null,
  },
  {
    id: 'barbak-event-15',
    category: 'event',
    name: 'Bière renversée',
    description: '(votre prochaine pioche est défaussée automatiquement.)',
    points: null,
  },
  {
    id: 'barbak-event-16',
    category: 'event',
    name: 'Concours de cuisine naine',
    description: '(vous échangez un trésor avec un joueur de votre choix.)',
    points: null,
  },
  {
    id: 'barbak-event-17',
    category: 'event',
    name: 'Taverne effondrée',
    description: '(tous les joueurs perdent une carte Bière.)',
    points: null,
  },
  {
    id: 'barbak-event-18',
    category: 'event',
    name: 'Marchand louche',
    description:
      '(vous piochez 3 cartes, puis devez en défausser 2 de votre main.)',
    points: null,
  },
  {
    id: 'barbak-event-19',
    category: 'event',
    name: 'Caverne écho',
    description: '(le prochain joueur doit jouer deux fois consécutivement.)',
    points: null,
  },
  {
    id: 'barbak-event-20',
    category: 'event',
    name: 'Champignon explosif',
    description: '(un joueur de votre choix défausse une carte au hasard.)',
    points: null,
  },
  {
    id: 'barbak-event-21',
    category: 'event',
    name: 'Festin de la Forge',
    description: '(chaque joueur donne une carte au plus faible (le dernier.))',
    points: null,
  },
  {
    id: 'barbak-event-22',
    category: 'event',
    name: 'Coup de pioche raté',
    description: '(vous ne jouez rien ce tour-ci.)',
    points: null,
  },
  {
    id: 'barbak-event-23',
    category: 'event',
    name: 'Piolet bancal',
    description:
      '(si vous trouvez un trésor, lancez un dé : 1 à 3 = vous cassez le trésor, 4 à 6 = vous le gardez.)',
    points: null,
  },
  {
    id: 'barbak-event-24',
    category: 'event',
    name: 'Explosifs instables',
    description:
      '(vous détruisez un monstre, mais perdez un trésor au hasard.)',
    points: null,
  },
  {
    id: 'barbak-event-25',
    category: 'event',
    name: 'Malédiction du Houblon Aigre',
    description: '(votre prochaine Bière vaut 0 point.)',
    points: 0,
  },
  {
    id: 'barbak-event-26',
    category: 'event',
    name: 'Tonneau des Mille Échos',
    description:
      '(l’effet d’une carte jouée ce tour est reproduit automatiquement deux fois.)',
    points: null,
  },
  {
    id: 'barbak-monster-1',
    category: 'monster',
    name: 'Troll des cavernes',
    description: '(si vous n’avez pas d’arme, vous perdez 1 trésor.)',
    points: null,
  },
  {
    id: 'barbak-monster-2',
    category: 'monster',
    name: 'Goblin chapardeur',
    description: '(il vole la première carte de votre domaine.)',
    points: null,
  },
  {
    id: 'barbak-monster-3',
    category: 'monster',
    name: 'Dragon enrhumé',
    description: '(tous les joueurs perdent une carte au hasard.)',
    points: null,
  },
  {
    id: 'barbak-monster-4',
    category: 'monster',
    name: 'Goblin des tunnels',
    description: '(il échange deux cartes de votre domaine au hasard.)',
    points: null,
  },
  {
    id: 'barbak-monster-5',
    category: 'monster',
    name: 'Orc grincheux',
    description: '(-2 points sauf si vous possédez une arme.)',
    points: -2,
  },
  {
    id: 'barbak-monster-6',
    category: 'monster',
    name: 'Troll ivre',
    description: '(attaque ratée une fois sur deux.)',
    points: null,
  },
  {
    id: 'barbak-monster-7',
    category: 'monster',
    name: 'Dragon somnolent',
    description: '(tous perdent un trésor sauf celui ayant le plus de Bière.)',
    points: null,
  },
  {
    id: 'barbak-monster-8',
    category: 'monster',
    name: 'Troll qui rote',
    description: '(tous les joueurs défaussent une carte de Taverne.)',
    points: null,
  },
  {
    id: 'barbak-monster-9',
    category: 'monster',
    name: 'Goblin farceur',
    description: '(il échange une carte entre deux autres joueurs.)',
    points: null,
  },
  {
    id: 'barbak-monster-10',
    category: 'monster',
    name: 'Squelette barbu',
    description: '(vous perdez la carte la plus ancienne de votre domaine.)',
    points: null,
  },
  {
    id: 'barbak-monster-11',
    category: 'monster',
    name: 'Orc bossu',
    description: '(-1 point et devez défausser un objet au hasard.)',
    points: -1,
  },
  {
    id: 'barbak-collapse-1',
    category: 'collapse',
    name: 'Éboulement mineur',
    description: '(chaque joueur défausse une carte de son choix. (x2))',
    points: null,
  },
  {
    id: 'barbak-collapse-2',
    category: 'collapse',
    name: 'Éboulement majeur',
    description:
      '(fin de partie imminente, chaque joueur défausse 2 trésors au hasard. (x3))',
    points: null,
  },
  {
    id: 'barbak-collapse-3',
    category: 'collapse',
    name: 'Effondrement final',
    description: '(la partie se termine immédiatement.)',
    points: null,
  },
  {
    id: 'barbak-collapse-4',
    category: 'collapse',
    name: 'Effondrement final',
    description: '(la partie se termine immédiatement.)',
    points: null,
  },
];
export const LA_GRANDE_MINE_CARDS = cards;
export const LA_GRANDE_MINE_CARD_BY_ID = Object.fromEntries(
  cards.map((card) => [card.id, card]),
);
