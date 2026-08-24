import { DynamicModule, Module } from '@nestjs/common';
import { BoardMissionGamesModule } from '../games/board-mission/board-mission-games.module';
import { AFondLesBallonsModule } from '../games/les-quatre-vents/a-fond-les-ballons/a-fond-les-ballons.module';
import { AventureSauvageModule } from '../games/les-quatre-vents/aventure-sauvage/aventure-sauvage.module';
import { CaDerapeModule } from '../games/les-quatre-vents/ca-derape/ca-derape.module';
import { ContesModule } from '../games/les-quatre-vents/contes-et-cacahuetes/contes.module';
import { EnAttendantMinuitModule } from '../games/les-quatre-vents/en-attendant-minuit/en-attendant-minuit.module';
import { FroussePartyModule } from '../games/les-quatre-vents/frousse-party/frousse-party.module';
import { GaloponsEnsembleModule } from '../games/les-quatre-vents/galopons-ensemble/galopons-ensemble.module';
import { MissionGalaxieModule } from '../games/les-quatre-vents/mission-galaxie/mission-galaxie.module';
import { MonVillageMonHistoireModule } from '../games/les-quatre-vents/mon-village-mon-histoire/mon-village-mon-histoire.module';
import { OdysseeModule } from '../games/les-quatre-vents/odyssee-quatre-cieux/odyssee.module';
import { PanierExpressModule } from '../games/les-quatre-vents/panier-express/panier-express.module';
import { PiratesEnVadrouilleModule } from '../games/les-quatre-vents/pirates-en-vadrouille/pirates-en-vadrouille.module';
import { PrimalisModule } from '../games/les-quatre-vents/primalis/primalis.module';
import { SacAMalicesModule } from '../games/les-quatre-vents/sac-a-malices/sac-a-malices.module';
import { ToutPresDeMamanModule } from '../games/les-quatre-vents/tout-pres-de-maman/tout-pres-de-maman.module';
import { VoyageModule } from '../games/les-quatre-vents/voyage-en-terre-de-brumes/voyage.module';
import { CatPattesModule } from '../games/vents-dansants/cat-pattes/cat-pattes.module';
import { CerclesSacresModule } from '../games/vents-dansants/cercles-sacres/cercles-sacres.module';
import { DameNatureModule } from '../games/vents-dansants/dame-nature/dame-nature.module';
import { EntreRitesModule } from '../games/vents-dansants/entre-rites-et-lumieres/entre-rites.module';
import { GerardPresidentModule } from '../games/vents-dansants/gerard-president/gerard-president.module';
import { LaBandeABananeModule } from '../games/vents-dansants/la-bande-a-banane/la-bande-a-banane.module';
import { LaGrandeMineDeBarbakModule } from '../games/vents-dansants/la-grande-mine-de-barbak/la-grande-mine-de-barbak.module';
import { LaParadeSucreeModule } from '../games/vents-dansants/la-parade-sucree/la-parade-sucree.module';
import { LeMarcheDesMerveillesModule } from '../games/vents-dansants/le-marche-des-merveilles/le-marche-des-merveilles.module';
import { LesAbsurdissimesModule } from '../games/vents-dansants/les-absurdissimes/les-absurdissimes.module';
import { LesMainsDeLaTerreModule } from '../games/vents-dansants/les-mains-de-la-terre/les-mains-de-la-terre.module';
import { NawakModule } from '../games/vents-dansants/nawak/nawak.module';
import { OlympiaModule } from '../games/vents-dansants/olympia/olympia.module';
import { PimpMyRideModule } from '../games/vents-dansants/pimp-my-ride/pimp-my-ride.module';
import { ZigEtZagModule } from '../games/vents-dansants/zig-et-zag/zig-et-zag.module';
import { ArcheDeMnemosyneModule } from '../games/vents-infinis/arche-de-mnemosyne/arche-de-mnemosyne.module';
import { CorridorModule } from '../games/vents-sacres/corridor/corridor.module';
import { FouleesFantastiquesModule } from '../games/vents-sacres/foulees-fantastiques/foulees-fantastiques.module';
import { JeuOieModule } from '../games/vents-sacres/jeu-oie/jeu-oie.module';
import { LamaModule } from '../games/vents-sacres/lama/lama.module';
import { MorpionModule } from '../games/vents-sacres/morpion/morpion.module';
import { GamePluginHandlersRegistrarService } from '../infrastructure/module/game-plugin-handlers-registrar.service';
import { GameRegistryModule } from './game-registry.module';

const GAME_PLUGIN_IMPORTS = [
  BoardMissionGamesModule,
  AFondLesBallonsModule,
  AventureSauvageModule,
  CaDerapeModule,
  ContesModule,
  EnAttendantMinuitModule,
  FroussePartyModule,
  GaloponsEnsembleModule,
  MissionGalaxieModule,
  MonVillageMonHistoireModule,
  OdysseeModule,
  PanierExpressModule,
  PiratesEnVadrouilleModule,
  PrimalisModule,
  SacAMalicesModule,
  ToutPresDeMamanModule,
  VoyageModule,
  CatPattesModule,
  CerclesSacresModule,
  DameNatureModule,
  EntreRitesModule,
  GerardPresidentModule,
  LaBandeABananeModule,
  LaGrandeMineDeBarbakModule,
  LaParadeSucreeModule,
  LeMarcheDesMerveillesModule,
  LesAbsurdissimesModule,
  LesMainsDeLaTerreModule,
  NawakModule,
  OlympiaModule,
  PimpMyRideModule,
  ZigEtZagModule,
  ArcheDeMnemosyneModule,
  CorridorModule,
  FouleesFantastiquesModule,
  JeuOieModule,
  LamaModule,
  MorpionModule,
];

@Module({})
export class GamePluginsModule {
  static forRoot(): DynamicModule {
    return {
      module: GamePluginsModule,
      imports: [GameRegistryModule, ...GAME_PLUGIN_IMPORTS],
      providers: [GamePluginHandlersRegistrarService],
      exports: GAME_PLUGIN_IMPORTS,
    };
  }
}
