import { compileJsonGame } from '../engine/json/public-api';
import manifest0 from '../games/les-quatre-vents/a-fond-les-ballons/manifest.json';
import document0 from '../games/les-quatre-vents/a-fond-les-ballons/game.json';
import asset0_0 from '../games/les-quatre-vents/a-fond-les-ballons/catalogue.json';
import manifest1 from '../games/les-quatre-vents/aventure-sauvage/manifest.json';
import document1 from '../games/les-quatre-vents/aventure-sauvage/game.json';
import asset1_0 from '../games/les-quatre-vents/aventure-sauvage/content/board.json';
import asset1_1 from '../games/les-quatre-vents/aventure-sauvage/content/cards.json';
import asset1_2 from '../games/les-quatre-vents/aventure-sauvage/content/pawns.json';
import manifest2 from '../games/les-quatre-vents/ca-derape/manifest.json';
import document2 from '../games/les-quatre-vents/ca-derape/game.json';
import asset2_0 from '../games/les-quatre-vents/ca-derape/catalogue.json';
import manifest3 from '../games/les-quatre-vents/contes-et-cacahuetes/manifest.json';
import document3 from '../games/les-quatre-vents/contes-et-cacahuetes/game.json';
import asset3_0 from '../games/les-quatre-vents/contes-et-cacahuetes/content/catalogue.json';
import manifest4 from '../games/les-quatre-vents/en-attendant-minuit/manifest.json';
import document4 from '../games/les-quatre-vents/en-attendant-minuit/game.json';
import asset4_0 from '../games/les-quatre-vents/en-attendant-minuit/catalogue.json';
import manifest5 from '../games/les-quatre-vents/frousse-party/manifest.json';
import document5 from '../games/les-quatre-vents/frousse-party/game.json';
import asset5_0 from '../games/les-quatre-vents/frousse-party/content/catalogue.json';
import manifest6 from '../games/les-quatre-vents/galopons-ensemble/manifest.json';
import document6 from '../games/les-quatre-vents/galopons-ensemble/game.json';
import asset6_0 from '../games/les-quatre-vents/galopons-ensemble/content/catalogue.json';
import manifest7 from '../games/les-quatre-vents/mission-galaxie/manifest.json';
import document7 from '../games/les-quatre-vents/mission-galaxie/game.json';
import asset7_0 from '../games/les-quatre-vents/mission-galaxie/catalogue.json';
import manifest8 from '../games/les-quatre-vents/mon-village-mon-histoire/manifest.json';
import document8 from '../games/les-quatre-vents/mon-village-mon-histoire/game.json';
import asset8_0 from '../games/les-quatre-vents/mon-village-mon-histoire/content/catalogue.json';
import manifest9 from '../games/les-quatre-vents/odyssee-quatre-cieux/manifest.json';
import document9 from '../games/les-quatre-vents/odyssee-quatre-cieux/game.json';
import manifest10 from '../games/les-quatre-vents/panier-express/manifest.json';
import document10 from '../games/les-quatre-vents/panier-express/game.json';
import asset10_0 from '../games/les-quatre-vents/panier-express/content/board.json';
import asset10_1 from '../games/les-quatre-vents/panier-express/content/cards.json';
import asset10_2 from '../games/les-quatre-vents/panier-express/content/pawns.json';
import asset10_3 from '../games/les-quatre-vents/panier-express/content/products.json';
import asset10_4 from '../games/les-quatre-vents/panier-express/content/quizzes.json';
import manifest11 from '../games/les-quatre-vents/pirates-en-vadrouille/manifest.json';
import document11 from '../games/les-quatre-vents/pirates-en-vadrouille/game.json';
import asset11_0 from '../games/les-quatre-vents/pirates-en-vadrouille/content/catalogue.json';
import manifest12 from '../games/les-quatre-vents/primalis/manifest.json';
import document12 from '../games/les-quatre-vents/primalis/game.json';
import asset12_0 from '../games/les-quatre-vents/primalis/content/catalogue.json';
import manifest13 from '../games/les-quatre-vents/sac-a-malices/manifest.json';
import document13 from '../games/les-quatre-vents/sac-a-malices/game.json';
import asset13_0 from '../games/les-quatre-vents/sac-a-malices/catalogue.json';
import manifest14 from '../games/les-quatre-vents/taxi-express/manifest.json';
import document14 from '../games/les-quatre-vents/taxi-express/game.json';
import asset14_0 from '../games/les-quatre-vents/taxi-express/content/board.json';
import asset14_1 from '../games/les-quatre-vents/taxi-express/content/clients.json';
import asset14_2 from '../games/les-quatre-vents/taxi-express/content/events.json';
import manifest15 from '../games/les-quatre-vents/tout-pres-de-maman/manifest.json';
import document15 from '../games/les-quatre-vents/tout-pres-de-maman/game.json';
import asset15_0 from '../games/les-quatre-vents/tout-pres-de-maman/content/catalogue.json';
import manifest16 from '../games/les-quatre-vents/voyage-en-terre-de-brumes/manifest.json';
import document16 from '../games/les-quatre-vents/voyage-en-terre-de-brumes/game.json';
import asset16_0 from '../games/les-quatre-vents/voyage-en-terre-de-brumes/catalogue.json';
import manifest17 from '../games/vents-dansants/cat-pattes/manifest.json';
import document17 from '../games/vents-dansants/cat-pattes/game.json';
import asset17_0 from '../games/vents-dansants/cat-pattes/content/cat-pattes.json';
import manifest18 from '../games/vents-dansants/cercles-sacres/manifest.json';
import document18 from '../games/vents-dansants/cercles-sacres/game.json';
import asset18_0 from '../games/vents-dansants/cercles-sacres/content/catalogue.json';
import manifest19 from '../games/vents-dansants/dame-nature/manifest.json';
import document19 from '../games/vents-dansants/dame-nature/game.json';
import asset19_0 from '../games/vents-dansants/dame-nature/content/catalogue.json';
import manifest20 from '../games/vents-dansants/entre-rites-et-lumieres/manifest.json';
import document20 from '../games/vents-dansants/entre-rites-et-lumieres/game.json';
import asset20_0 from '../games/vents-dansants/entre-rites-et-lumieres/content/catalogue.json';
import manifest21 from '../games/vents-dansants/gerard-president/manifest.json';
import document21 from '../games/vents-dansants/gerard-president/game.json';
import asset21_0 from '../games/vents-dansants/gerard-president/content/catalogue.json';
import manifest22 from '../games/vents-dansants/la-bande-a-banane/manifest.json';
import document22 from '../games/vents-dansants/la-bande-a-banane/game.json';
import asset22_0 from '../games/vents-dansants/la-bande-a-banane/catalogue.json';
import manifest23 from '../games/vents-dansants/la-grande-mine-de-barbak/manifest.json';
import document23 from '../games/vents-dansants/la-grande-mine-de-barbak/game.json';
import asset23_0 from '../games/vents-dansants/la-grande-mine-de-barbak/content/catalogue.json';
import manifest24 from '../games/vents-dansants/la-parade-sucree/manifest.json';
import document24 from '../games/vents-dansants/la-parade-sucree/game.json';
import asset24_0 from '../games/vents-dansants/la-parade-sucree/content/catalogue.json';
import manifest25 from '../games/vents-dansants/le-marche-des-merveilles/manifest.json';
import document25 from '../games/vents-dansants/le-marche-des-merveilles/game.json';
import asset25_0 from '../games/vents-dansants/le-marche-des-merveilles/content/catalogue.json';
import manifest26 from '../games/vents-dansants/les-absurdissimes/manifest.json';
import document26 from '../games/vents-dansants/les-absurdissimes/game.json';
import asset26_0 from '../games/vents-dansants/les-absurdissimes/content/cards.json';
import manifest27 from '../games/vents-dansants/les-mains-de-la-terre/manifest.json';
import document27 from '../games/vents-dansants/les-mains-de-la-terre/game.json';
import asset27_0 from '../games/vents-dansants/les-mains-de-la-terre/catalogue.json';
import manifest28 from '../games/vents-dansants/nawak/manifest.json';
import document28 from '../games/vents-dansants/nawak/game.json';
import asset28_0 from '../games/vents-dansants/nawak/catalogue.json';
import manifest29 from '../games/vents-dansants/olympia/manifest.json';
import document29 from '../games/vents-dansants/olympia/game.json';
import asset29_0 from '../games/vents-dansants/olympia/catalogue.json';
import manifest30 from '../games/vents-dansants/pimp-my-ride/manifest.json';
import document30 from '../games/vents-dansants/pimp-my-ride/game.json';
import asset30_0 from '../games/vents-dansants/pimp-my-ride/content/catalogue.json';
import manifest31 from '../games/vents-dansants/zig-et-zag/manifest.json';
import document31 from '../games/vents-dansants/zig-et-zag/game.json';
import asset31_0 from '../games/vents-dansants/zig-et-zag/catalogue.json';
import manifest32 from '../games/vents-infinis/arche-de-mnemosyne/manifest.json';
import document32 from '../games/vents-infinis/arche-de-mnemosyne/game.json';
import asset32_0 from '../games/vents-infinis/arche-de-mnemosyne/quiz.json';
import manifest33 from '../games/vents-sacres/corridor/manifest.json';
import document33 from '../games/vents-sacres/corridor/game.json';
import manifest34 from '../games/vents-sacres/course-des-etoiles/manifest.json';
import document34 from '../games/vents-sacres/course-des-etoiles/game.json';
import manifest35 from '../games/vents-sacres/foulees-fantastiques/manifest.json';
import document35 from '../games/vents-sacres/foulees-fantastiques/game.json';
import asset35_0 from '../games/vents-sacres/foulees-fantastiques/catalogue.json';
import manifest36 from '../games/vents-sacres/jeu-oie/manifest.json';
import document36 from '../games/vents-sacres/jeu-oie/game.json';
import asset36_0 from '../games/vents-sacres/jeu-oie/content/catalogue.json';
import manifest37 from '../games/vents-sacres/lama/manifest.json';
import document37 from '../games/vents-sacres/lama/game.json';
import manifest38 from '../games/vents-sacres/morpion/manifest.json';
import document38 from '../games/vents-sacres/morpion/game.json';
import asset38_0 from '../games/vents-sacres/morpion/content/pawns.json';
const game0 = compileJsonGame(manifest0, document0, { "content/catalogue.json": asset0_0 });
const game1 = compileJsonGame(manifest1, document1, { "content/board.json": asset1_0, "content/cards.json": asset1_1, "content/pawns.json": asset1_2 });
const game2 = compileJsonGame(manifest2, document2, { "content/catalogue.json": asset2_0 });
const game3 = compileJsonGame(manifest3, document3, { "content/catalogue.json": asset3_0 });
const game4 = compileJsonGame(manifest4, document4, { "content/catalogue.json": asset4_0 });
const game5 = compileJsonGame(manifest5, document5, { "content/catalogue.json": asset5_0 });
const game6 = compileJsonGame(manifest6, document6, { "content/catalogue.json": asset6_0 });
const game7 = compileJsonGame(manifest7, document7, { "content/catalogue.json": asset7_0 });
const game8 = compileJsonGame(manifest8, document8, { "content/catalogue.json": asset8_0 });
const game9 = compileJsonGame(manifest9, document9);
const game10 = compileJsonGame(manifest10, document10, { "content/board.json": asset10_0, "content/cards.json": asset10_1, "content/pawns.json": asset10_2, "content/products.json": asset10_3, "content/quizzes.json": asset10_4 });
const game11 = compileJsonGame(manifest11, document11, { "content/catalogue.json": asset11_0 });
const game12 = compileJsonGame(manifest12, document12, { "content/catalogue.json": asset12_0 });
const game13 = compileJsonGame(manifest13, document13, { "content/catalogue.json": asset13_0 });
const game14 = compileJsonGame(manifest14, document14, { "content/board.json": asset14_0, "content/clients.json": asset14_1, "content/events.json": asset14_2 });
const game15 = compileJsonGame(manifest15, document15, { "content/catalogue.json": asset15_0 });
const game16 = compileJsonGame(manifest16, document16, { "content/catalogue.json": asset16_0 });
const game17 = compileJsonGame(manifest17, document17, { "content/cat-pattes.json": asset17_0 });
const game18 = compileJsonGame(manifest18, document18, { "content/catalogue.json": asset18_0 });
const game19 = compileJsonGame(manifest19, document19, { "content/catalogue.json": asset19_0 });
const game20 = compileJsonGame(manifest20, document20, { "content/catalogue.json": asset20_0 });
const game21 = compileJsonGame(manifest21, document21, { "content/catalogue.json": asset21_0 });
const game22 = compileJsonGame(manifest22, document22, { "content/catalogue.json": asset22_0 });
const game23 = compileJsonGame(manifest23, document23, { "content/catalogue.json": asset23_0 });
const game24 = compileJsonGame(manifest24, document24, { "content/catalogue.json": asset24_0 });
const game25 = compileJsonGame(manifest25, document25, { "content/catalogue.json": asset25_0 });
const game26 = compileJsonGame(manifest26, document26, { "content/cards.json": asset26_0 });
const game27 = compileJsonGame(manifest27, document27, { "content/catalogue.json": asset27_0 });
const game28 = compileJsonGame(manifest28, document28, { "content/catalogue.json": asset28_0 });
const game29 = compileJsonGame(manifest29, document29, { "content/catalogue.json": asset29_0 });
const game30 = compileJsonGame(manifest30, document30, { "content/catalogue.json": asset30_0 });
const game31 = compileJsonGame(manifest31, document31, { "content/catalogue.json": asset31_0 });
const game32 = compileJsonGame(manifest32, document32, { "content/quiz.json": asset32_0 });
const game33 = compileJsonGame(manifest33, document33);
const game34 = compileJsonGame(manifest34, document34);
const game35 = compileJsonGame(manifest35, document35, { "content/catalogue.json": asset35_0 });
const game36 = compileJsonGame(manifest36, document36, { "content/catalogue.json": asset36_0 });
const game37 = compileJsonGame(manifest37, document37);
const game38 = compileJsonGame(manifest38, document38, { "content/pawns.json": asset38_0 });

/** Generated by commands/generate-game-registry.cjs. Do not edit manually. */
export const GENERATED_GAME_DEFINITIONS: readonly unknown[] = Object.freeze([
  game0,
  game1,
  game2,
  game3,
  game4,
  game5,
  game6,
  game7,
  game8,
  game9,
  game10,
  game11,
  game12,
  game13,
  game14,
  game15,
  game16,
  game17,
  game18,
  game19,
  game20,
  game21,
  game22,
  game23,
  game24,
  game25,
  game26,
  game27,
  game28,
  game29,
  game30,
  game31,
  game32,
  game33,
  game34,
  game35,
  game36,
  game37,
  game38,
]);

export const GENERATED_GAME_PACKAGES: readonly {
  definition: unknown;
  manifest: unknown;
}[] = Object.freeze([
  Object.freeze({ definition: game0, manifest: manifest0 }),
  Object.freeze({ definition: game1, manifest: manifest1 }),
  Object.freeze({ definition: game2, manifest: manifest2 }),
  Object.freeze({ definition: game3, manifest: manifest3 }),
  Object.freeze({ definition: game4, manifest: manifest4 }),
  Object.freeze({ definition: game5, manifest: manifest5 }),
  Object.freeze({ definition: game6, manifest: manifest6 }),
  Object.freeze({ definition: game7, manifest: manifest7 }),
  Object.freeze({ definition: game8, manifest: manifest8 }),
  Object.freeze({ definition: game9, manifest: manifest9 }),
  Object.freeze({ definition: game10, manifest: manifest10 }),
  Object.freeze({ definition: game11, manifest: manifest11 }),
  Object.freeze({ definition: game12, manifest: manifest12 }),
  Object.freeze({ definition: game13, manifest: manifest13 }),
  Object.freeze({ definition: game14, manifest: manifest14 }),
  Object.freeze({ definition: game15, manifest: manifest15 }),
  Object.freeze({ definition: game16, manifest: manifest16 }),
  Object.freeze({ definition: game17, manifest: manifest17 }),
  Object.freeze({ definition: game18, manifest: manifest18 }),
  Object.freeze({ definition: game19, manifest: manifest19 }),
  Object.freeze({ definition: game20, manifest: manifest20 }),
  Object.freeze({ definition: game21, manifest: manifest21 }),
  Object.freeze({ definition: game22, manifest: manifest22 }),
  Object.freeze({ definition: game23, manifest: manifest23 }),
  Object.freeze({ definition: game24, manifest: manifest24 }),
  Object.freeze({ definition: game25, manifest: manifest25 }),
  Object.freeze({ definition: game26, manifest: manifest26 }),
  Object.freeze({ definition: game27, manifest: manifest27 }),
  Object.freeze({ definition: game28, manifest: manifest28 }),
  Object.freeze({ definition: game29, manifest: manifest29 }),
  Object.freeze({ definition: game30, manifest: manifest30 }),
  Object.freeze({ definition: game31, manifest: manifest31 }),
  Object.freeze({ definition: game32, manifest: manifest32 }),
  Object.freeze({ definition: game33, manifest: manifest33 }),
  Object.freeze({ definition: game34, manifest: manifest34 }),
  Object.freeze({ definition: game35, manifest: manifest35 }),
  Object.freeze({ definition: game36, manifest: manifest36 }),
  Object.freeze({ definition: game37, manifest: manifest37 }),
  Object.freeze({ definition: game38, manifest: manifest38 }),
]);
