import { freezeGameContent } from '../../../engine/sdk/public-api';

export interface GerardPresidentNameCard {
  id: string;
  name: string;
}

export interface GerardPresidentThemeCard {
  id: string;
  text: string;
}

import { GERARD_PRESIDENT_NAMES } from './name-content';
export { GERARD_PRESIDENT_NAMES } from './name-content';

export const GERARD_PRESIDENT_THEMES = [
  'Le prénom qui survivrait à une apocalypse de zombies.',
  'Le prénom qui devrait être interdit par décret.',
  'Le prénom le plus flippant dans une cave à 2h du matin.',
  'Le prénom d’un sorcier pas doué mais super motivé.',
  'Le prénom d’un prof de sport ultra-sévère.',
  'Le prénom d’une personne qui mange des cornichons au petit déj.',
  'Le prénom du plus grand séducteur de camping.',
  'Le prénom d’un joueur de pétanque légendaire.',
  'Le prénom d’un dictateur de salon de thé.',
  'Le prénom d’une idole oubliée des années 80.',
  'Le prénom qui défonce tout à Mario Kart.',
  'Le prénom d’un chat psychopathe.',
  'Le prénom d’un maître du karaoké.',
  'Le prénom d’un espion qui se fait toujours griller.',
  'Le prénom d’un animateur de télé parlant trop fort.',
  'Le prénom d’un ninja avec une sciatique.',
  'Le prénom d’un Youtubeur faisant des tutos de pliage de serviettes.',
  'Le prénom d’un pâtissier en reconversion dans le métal.',
  'Le prénom d’un dresseur de pigeons acrobates.',
  'Le prénom d’un gourou de secte vegan astrale.',
  'Le prénom le plus ringard de la galaxie.',
  'Le prénom d’un ancien cascadeur reconverti en banquier.',
  'Le prénom d’un membre d’un boys band improbable.',
  'Le prénom d’une mamie championne d’arts martiaux.',
  'Le prénom d’un vendeur de tapis capable de vendre à un moine.',
  'Le prénom d’un mannequin pour pulls moches.',
  'Le prénom d’un organisateur de mariages catastrophiques.',
  'Le prénom d’un invité relou à tous les anniversaires.',
  'Le prénom d’un prof de yoga fumant en cachette.',
  'Le prénom d’un plombier super-héros du dimanche.',
  'Le prénom d’une star de série télé oubliée.',
  'Le prénom qui a toujours une anecdote gênante.',
  'Le prénom d’un candidat de télé-réalité médiévale.',
  'Le prénom d’un DJ de mariage coincé dans les années disco.',
  'Le prénom d’un personnage de film d’horreur qui meurt en première partie.',
  'Le prénom d’un coach de vie qui pleure devant Top Chef.',
  'Le prénom d’un ado rebelle à l’école de tricot.',
  'Le prénom d’un roi déchu du dancefloor.',
  'Le prénom d’un mec qui vit encore chez sa mère à 52 ans.',
  'Le prénom d’un aventurier qui a peur des pigeons.',
  'Le prénom d’un ou d’une ex qu’on ne regrette vraiment pas.',
  'Le prénom d’un joueur d’échecs ultra-suspect.',
  'Le prénom d’un campeur qui parle aux moustiques.',
  'Le prénom d’un joueur de baby-foot invincible.',
  'Le prénom d’un sculpteur de fromages.',
  'Le prénom parfait pour un hamster.',
  'Le prénom d’un influenceur qui fait des unboxings de Tupperware.',
  'Le prénom d’un ange gardien très distrait.',
  'Le prénom d’un livreur de pizza qui arrive toujours froid.',
  'Le prénom d’un pote qu’on invite jamais mais qui vient toujours.',
  'Le prénom d’un présentateur météo dépressif.',
  'Le prénom d’un roi de la sieste.',
  'Le prénom d’un mime qui parle tout le temps.',
  'Le prénom d’un chanteur qui rate toutes ses notes.',
  'Le prénom d’un vendeur de lunettes aveugle.',
  'Le prénom d’un barman allergique à l’alcool.',
  'Le prénom d’un éleveur de lamas star de TikTok.',
  'Le prénom d’un chevalier du Moyen Âge mais en claquettes.',
  'Le prénom d’un stagiaire en mission sur la Lune.',
  'Le prénom d’un super-héros super-inutile.',
  'Le prénom d’un poète incompris parce qu’il écrit en morse.',
  'Le prénom d’un cuisinier qui confond sucre et sel.',
  'Le prénom d’un magicien qui perd toujours ses cartes.',
  'Le prénom d’un mec qui se bat contre les ventilateurs.',
  'Le prénom d’un président d’un club de flûte infernal.',
  'Le prénom d’un animateur de bingo sous acide.',
  'Le prénom d’un photographe photophobe.',
  'Le prénom d’un moniteur d’auto-école qui ne sait pas conduire.',
  'Le prénom d’un fan de Star Wars qui croit que Yoda est un Pokémon.',
  'Le prénom d’un concierge de manoir hanté mais optimiste.',
  'Le prénom d’un styliste de bottes ringard.',
  'Le prénom d’un collectionneur de cuillères qui les appelle toutes « Roger ».',
  'Le prénom d’un médium qui fait peur à son miroir.',
  'Le prénom d’un capitaine de bateau en mousse.',
  'Le prénom d’un sportif de canapé.',
  'Le prénom d’un vendeur d’aspirateurs qui ne le passe jamais.',
  'Le prénom d’un philosophe de fast-food.',
  'Le prénom d’un écolo qui mange des sachets bio.',
  'Le prénom d’un tailleur de barbe pour hérissons.',
  'Le prénom qui inspire la plus grande crainte dans un concours de karaoké',
  'Le prénom d’un animateur de colo qui se fait tirer les cheveux par les enfants.',
  'Le prénom d’un pilote d’avion qui dort pendant les annonces.',
  'Le prénom d’un mannequin pour charentaises.',
  'Le prénom d’un ado qui fait des tutos maquillage pour serpents.',
  'Le prénom d’un ancien champion de cache-cache jamais retrouvé.',
  'Le prénom d’un bricoleur qui détruit tout sauf son égo.',
  'Le prénom d’un dresseur de plantes carnivores affectueuses.',
  'Le prénom d’un voisin qui espionne avec un drone rose fluo.',
  'Le prénom d’un joueur de Uno banni à vie.',
  'Le prénom d’un chef d’orchestre de klaxons.',
  'Le prénom d’un gourou qui ne croit même pas à sa propre secte.',
  'Le prénom d’un tiktokeur qui fait des danses à la poste.',
  'Le prénom d’un facteur qui confond toujours les boîtes aux lettres.',
  'Le prénom d’un expert en camouflages en pleine canicule.',
  'Le prénom d’un vendeur de yaourts parlant en alexandrins.',
  'Le prénom d’un gardien de musée volant ses propres objets.',
  'Le prénom d’un imitateur de cloches.',
  'Le prénom d’un pirate des Caraïbes allergique au rhum.',
  'Le prénom d’un médium qui confond les signes astrologiques avec des plats.',
  'Le prénom d’un capitaine de pédalo mégalomane',
];

export {
  GERARD_PRESIDENT_SPECIAL_CARDS,
  type GerardPresidentSpecialCard,
} from './special-cards';

export const GERARD_PRESIDENT_NAME_CARDS: GerardPresidentNameCard[] =
  GERARD_PRESIDENT_NAMES.map((name, index) => ({
    id: `name-${index + 1}`,
    name,
  }));
export const GERARD_PRESIDENT_THEME_CARDS: GerardPresidentThemeCard[] =
  GERARD_PRESIDENT_THEMES.map((text, index) => ({
    id: `theme-${index + 1}`,
    text,
  }));
export const GERARD_PRESIDENT_NAME_BY_ID = Object.fromEntries(
  GERARD_PRESIDENT_NAME_CARDS.map((card) => [card.id, card]),
);
export const GERARD_PRESIDENT_THEME_BY_ID = Object.fromEntries(
  GERARD_PRESIDENT_THEME_CARDS.map((card) => [card.id, card]),
);

freezeGameContent(GERARD_PRESIDENT_NAMES);
freezeGameContent(GERARD_PRESIDENT_THEMES);
freezeGameContent(GERARD_PRESIDENT_NAME_CARDS);
freezeGameContent(GERARD_PRESIDENT_THEME_CARDS);
freezeGameContent(GERARD_PRESIDENT_NAME_BY_ID);
freezeGameContent(GERARD_PRESIDENT_THEME_BY_ID);
