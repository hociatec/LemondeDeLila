import { compileJsonGame } from '../engine/json/public-api';
import game0 from '../games/les-quatre-vents/a-fond-les-ballons/game';
import manifest0 from '../games/les-quatre-vents/a-fond-les-ballons/manifest.json';
import game1 from '../games/les-quatre-vents/aventure-sauvage/game';
import manifest1 from '../games/les-quatre-vents/aventure-sauvage/manifest.json';
import game2 from '../games/les-quatre-vents/ca-derape/game';
import manifest2 from '../games/les-quatre-vents/ca-derape/manifest.json';
import game3 from '../games/les-quatre-vents/contes-et-cacahuetes/game';
import manifest3 from '../games/les-quatre-vents/contes-et-cacahuetes/manifest.json';
import game4 from '../games/les-quatre-vents/en-attendant-minuit/game';
import manifest4 from '../games/les-quatre-vents/en-attendant-minuit/manifest.json';
import game5 from '../games/les-quatre-vents/frousse-party/game';
import manifest5 from '../games/les-quatre-vents/frousse-party/manifest.json';
import game6 from '../games/les-quatre-vents/galopons-ensemble/game';
import manifest6 from '../games/les-quatre-vents/galopons-ensemble/manifest.json';
import game7 from '../games/les-quatre-vents/mission-galaxie/game';
import manifest7 from '../games/les-quatre-vents/mission-galaxie/manifest.json';
import game8 from '../games/les-quatre-vents/mon-village-mon-histoire/game';
import manifest8 from '../games/les-quatre-vents/mon-village-mon-histoire/manifest.json';
import game9 from '../games/les-quatre-vents/odyssee-quatre-cieux/game';
import manifest9 from '../games/les-quatre-vents/odyssee-quatre-cieux/manifest.json';
import manifest10 from '../games/les-quatre-vents/panier-express/manifest.json';
import document10 from '../games/les-quatre-vents/panier-express/game.json';
import game11 from '../games/les-quatre-vents/pirates-en-vadrouille/game';
import manifest11 from '../games/les-quatre-vents/pirates-en-vadrouille/manifest.json';
import game12 from '../games/les-quatre-vents/primalis/game';
import manifest12 from '../games/les-quatre-vents/primalis/manifest.json';
import game13 from '../games/les-quatre-vents/sac-a-malices/game';
import manifest13 from '../games/les-quatre-vents/sac-a-malices/manifest.json';
import game14 from '../games/les-quatre-vents/taxi-express/game';
import manifest14 from '../games/les-quatre-vents/taxi-express/manifest.json';
import game15 from '../games/les-quatre-vents/tout-pres-de-maman/game';
import manifest15 from '../games/les-quatre-vents/tout-pres-de-maman/manifest.json';
import game16 from '../games/les-quatre-vents/voyage-en-terre-de-brumes/game';
import manifest16 from '../games/les-quatre-vents/voyage-en-terre-de-brumes/manifest.json';
import game17 from '../games/vents-dansants/cat-pattes/game';
import manifest17 from '../games/vents-dansants/cat-pattes/manifest.json';
import game18 from '../games/vents-dansants/cercles-sacres/game';
import manifest18 from '../games/vents-dansants/cercles-sacres/manifest.json';
import game19 from '../games/vents-dansants/dame-nature/game';
import manifest19 from '../games/vents-dansants/dame-nature/manifest.json';
import game20 from '../games/vents-dansants/entre-rites-et-lumieres/game';
import manifest20 from '../games/vents-dansants/entre-rites-et-lumieres/manifest.json';
import game21 from '../games/vents-dansants/gerard-president/game';
import manifest21 from '../games/vents-dansants/gerard-president/manifest.json';
import game22 from '../games/vents-dansants/la-bande-a-banane/game';
import manifest22 from '../games/vents-dansants/la-bande-a-banane/manifest.json';
import game23 from '../games/vents-dansants/la-grande-mine-de-barbak/game';
import manifest23 from '../games/vents-dansants/la-grande-mine-de-barbak/manifest.json';
import game24 from '../games/vents-dansants/la-parade-sucree/game';
import manifest24 from '../games/vents-dansants/la-parade-sucree/manifest.json';
import game25 from '../games/vents-dansants/le-marche-des-merveilles/game';
import manifest25 from '../games/vents-dansants/le-marche-des-merveilles/manifest.json';
import game26 from '../games/vents-dansants/les-absurdissimes/game';
import manifest26 from '../games/vents-dansants/les-absurdissimes/manifest.json';
import game27 from '../games/vents-dansants/les-mains-de-la-terre/game';
import manifest27 from '../games/vents-dansants/les-mains-de-la-terre/manifest.json';
import game28 from '../games/vents-dansants/nawak/game';
import manifest28 from '../games/vents-dansants/nawak/manifest.json';
import game29 from '../games/vents-dansants/olympia/game';
import manifest29 from '../games/vents-dansants/olympia/manifest.json';
import game30 from '../games/vents-dansants/pimp-my-ride/game';
import manifest30 from '../games/vents-dansants/pimp-my-ride/manifest.json';
import game31 from '../games/vents-dansants/zig-et-zag/game';
import manifest31 from '../games/vents-dansants/zig-et-zag/manifest.json';
import game32 from '../games/vents-infinis/arche-de-mnemosyne/game';
import manifest32 from '../games/vents-infinis/arche-de-mnemosyne/manifest.json';
import game33 from '../games/vents-sacres/corridor/game';
import manifest33 from '../games/vents-sacres/corridor/manifest.json';
import manifest34 from '../games/vents-sacres/course-des-etoiles/manifest.json';
import document34 from '../games/vents-sacres/course-des-etoiles/game.json';
import game35 from '../games/vents-sacres/foulees-fantastiques/game';
import manifest35 from '../games/vents-sacres/foulees-fantastiques/manifest.json';
import game36 from '../games/vents-sacres/jeu-oie/game';
import manifest36 from '../games/vents-sacres/jeu-oie/manifest.json';
import game37 from '../games/vents-sacres/lama/game';
import manifest37 from '../games/vents-sacres/lama/manifest.json';
import game38 from '../games/vents-sacres/morpion/game';
import manifest38 from '../games/vents-sacres/morpion/manifest.json';
const game10 = compileJsonGame(manifest10, document10);
const game34 = compileJsonGame(manifest34, document34);

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
