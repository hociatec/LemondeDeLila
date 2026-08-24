import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameRegistryService } from '../../application/services/game-registry.service';
import { AFondLesBallonsService } from '../../games/les-quatre-vents/a-fond-les-ballons/application/services/a-fond-les-ballons.service';
import { AventureSauvageService } from '../../games/les-quatre-vents/aventure-sauvage/application/services/aventure-sauvage.service';
import { CaDerapeService } from '../../games/les-quatre-vents/ca-derape/application/services/ca-derape.service';
import { ContesService } from '../../games/les-quatre-vents/contes-et-cacahuetes/application/services/contes.service';
import { EnAttendantMinuitService } from '../../games/les-quatre-vents/en-attendant-minuit/application/services/en-attendant-minuit.service';
import { FroussePartyService } from '../../games/les-quatre-vents/frousse-party/application/services/frousse-party.service';
import { GaloponsEnsembleService } from '../../games/les-quatre-vents/galopons-ensemble/application/services/galopons-ensemble.service';
import { MissionGalaxieService } from '../../games/les-quatre-vents/mission-galaxie/application/services/mission-galaxie.service';
import { MonVillageService } from '../../games/les-quatre-vents/mon-village-mon-histoire/application/services/mon-village-mon-histoire.service';
import { OdysseeQuatreCieuxService } from '../../games/les-quatre-vents/odyssee-quatre-cieux/application/services/odyssee.service';
import { PanierExpressService } from '../../games/les-quatre-vents/panier-express/application/services/panier-express.service';
import { PiratesEnVadrouilleService } from '../../games/les-quatre-vents/pirates-en-vadrouille/application/services/pirates-en-vadrouille.service';
import { PrimalisService } from '../../games/les-quatre-vents/primalis/application/services/primalis.service';
import { SacAMalicesService } from '../../games/les-quatre-vents/sac-a-malices/application/services/sac-a-malices.service';
import { ToutPresDeMamanService } from '../../games/les-quatre-vents/tout-pres-de-maman/application/services/tout-pres-de-maman.service';
import { VoyageService } from '../../games/les-quatre-vents/voyage-en-terre-de-brumes/application/services/voyage.service';
import { CatPattesService } from '../../games/vents-dansants/cat-pattes/application/services/cat-pattes.service';
import { CerclesSacresService } from '../../games/vents-dansants/cercles-sacres/application/services/cercles-sacres.service';
import { DameNatureService } from '../../games/vents-dansants/dame-nature/application/services/dame-nature.service';
import { EntreRitesService } from '../../games/vents-dansants/entre-rites-et-lumieres/application/services/entre-rites.service';
import { GerardPresidentService } from '../../games/vents-dansants/gerard-president/application/services/gerard-president.service';
import { BandeABananeService } from '../../games/vents-dansants/la-bande-a-banane/application/services/la-bande-a-banane.service';
import { LaGrandeMineDeBarbakService } from '../../games/vents-dansants/la-grande-mine-de-barbak/application/services/la-grande-mine-de-barbak.service';
import { LaParadeSucreeService } from '../../games/vents-dansants/la-parade-sucree/application/services/la-parade-sucree.service';
import { LeMarcheDesMerveillesService } from '../../games/vents-dansants/le-marche-des-merveilles/application/services/le-marche-des-merveilles.service';
import { LesAbsurdissimesService } from '../../games/vents-dansants/les-absurdissimes/application/services/les-absurdissimes.service';
import { LesMainsDeLaTerreService } from '../../games/vents-dansants/les-mains-de-la-terre/application/services/les-mains-de-la-terre.service';
import { NawakService } from '../../games/vents-dansants/nawak/application/services/nawak.service';
import { OlympiaService } from '../../games/vents-dansants/olympia/application/services/olympia.service';
import { PimpMyRideService } from '../../games/vents-dansants/pimp-my-ride/application/services/pimp-my-ride.service';
import { ZigEtZagService } from '../../games/vents-dansants/zig-et-zag/application/services/zig-et-zag.service';
import { ArcheDeMnemosyneService } from '../../games/vents-infinis/arche-de-mnemosyne/application/services/arche-de-mnemosyne.service';
import { CorridorService } from '../../games/vents-sacres/corridor/application/services/corridor.service';
import { FouleesFantastiquesService } from '../../games/vents-sacres/foulees-fantastiques/application/services/foulees-fantastiques.service';
import { JeuOieService } from '../../games/vents-sacres/jeu-oie/application/services/jeu-oie.service';
import { LamaService } from '../../games/vents-sacres/lama/application/services/lama.service';
import { MorpionService } from '../../games/vents-sacres/morpion/application/services/morpion.service';
import type { GameRulesAdapter } from '../../application/contracts/game-rules-adapter.interface';

@Injectable()
export class GamePluginHandlersRegistrarService implements OnModuleInit {
  constructor(
    private readonly registry: GameRegistryService,
    private readonly aFondLesBallons: AFondLesBallonsService,
    private readonly aventureSauvage: AventureSauvageService,
    private readonly caDerape: CaDerapeService,
    private readonly contes: ContesService,
    private readonly enAttendantMinuit: EnAttendantMinuitService,
    private readonly frousseParty: FroussePartyService,
    private readonly galoponsEnsemble: GaloponsEnsembleService,
    private readonly missionGalaxie: MissionGalaxieService,
    private readonly monVillage: MonVillageService,
    private readonly odysseeQuatreCieux: OdysseeQuatreCieuxService,
    private readonly panierExpress: PanierExpressService,
    private readonly piratesEnVadrouille: PiratesEnVadrouilleService,
    private readonly primalis: PrimalisService,
    private readonly sacAMalices: SacAMalicesService,
    private readonly toutPresDeMaman: ToutPresDeMamanService,
    private readonly voyage: VoyageService,
    private readonly catPattes: CatPattesService,
    private readonly cerclesSacres: CerclesSacresService,
    private readonly dameNature: DameNatureService,
    private readonly entreRites: EntreRitesService,
    private readonly gerardPresident: GerardPresidentService,
    private readonly laBandeABanane: BandeABananeService,
    private readonly laGrandeMineDeBarbak: LaGrandeMineDeBarbakService,
    private readonly laParadeSucree: LaParadeSucreeService,
    private readonly leMarcheDesMerveilles: LeMarcheDesMerveillesService,
    private readonly lesAbsurdissimes: LesAbsurdissimesService,
    private readonly lesMainsDeLaTerre: LesMainsDeLaTerreService,
    private readonly nawak: NawakService,
    private readonly olympia: OlympiaService,
    private readonly pimpMyRide: PimpMyRideService,
    private readonly zigEtZag: ZigEtZagService,
    private readonly archeDeMnemosyne: ArcheDeMnemosyneService,
    private readonly corridor: CorridorService,
    private readonly fouleesFantastiques: FouleesFantastiquesService,
    private readonly jeuOie: JeuOieService,
    private readonly lama: LamaService,
    private readonly morpion: MorpionService,
  ) {}

  onModuleInit(): void {
    for (const handler of this.getHandlers()) {
      this.registry.register(handler);
    }
  }

  private getHandlers(): GameRulesAdapter[] {
    return [
      this.aFondLesBallons,
      this.aventureSauvage,
      this.caDerape,
      this.contes,
      this.enAttendantMinuit,
      this.frousseParty,
      this.galoponsEnsemble,
      this.missionGalaxie,
      this.monVillage,
      this.odysseeQuatreCieux,
      this.panierExpress,
      this.piratesEnVadrouille,
      this.primalis,
      this.sacAMalices,
      this.toutPresDeMaman,
      this.voyage,
      this.catPattes,
      this.cerclesSacres,
      this.dameNature,
      this.entreRites,
      this.gerardPresident,
      this.laBandeABanane,
      this.laGrandeMineDeBarbak,
      this.laParadeSucree,
      this.leMarcheDesMerveilles,
      this.lesAbsurdissimes,
      this.lesMainsDeLaTerre,
      this.nawak,
      this.olympia,
      this.pimpMyRide,
      this.zigEtZag,
      this.archeDeMnemosyne,
      this.corridor,
      this.fouleesFantastiques,
      this.jeuOie,
      this.lama,
      this.morpion,
    ];
  }
}
