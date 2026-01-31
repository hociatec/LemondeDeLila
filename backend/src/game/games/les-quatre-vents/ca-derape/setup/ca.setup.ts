import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { CaCard, CaMetadata, CaTile } from '../model/ca.types';

@Injectable()
export class CaSetupService {
  hydrateInitialState(base: GameStateEntity): GameStateEntity {
    const players = Array.isArray(base.players) ? base.players : [];
    const positions: Record<number, number> = {};
    const lastRollByPlayer: Record<number, number> = {};
    const lastMoveDelta: Record<number, number> = {};
    const turnsSinceMoved: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
      lastRollByPlayer[p.id] = 0;
      lastMoveDelta[p.id] = 0;
      turnsSinceMoved[p.id] = 0;
    }

    const meta: CaMetadata = {
      tiles: buildTiles(),
      positions,
      lastRollByPlayer,
      lastMoveDelta,
      turnsSinceMoved,
      statuses: {
        skipTurn: {},
        ignoreNextPenalty: {},
        doubleNextMove: {},
        doubleNextRoll: {},
        mirrorNextRollFrom: {},
        nextPlayerDelta: null,
      },
      decks: { cards: buildDeck(), discard: [] },
      winnerId: null,
    };

    return {
      ...base,
      phase: 'playing',
      pending: null,
      metadata: { ...(base.metadata ?? {}), ...meta },
    };
  }
}

function buildTiles(): CaTile[] {
  const tiles: CaTile[] = [
    {
      label: 'Départ',
      description:
        "Les coureurs se tiennent prêts, le souffle chargé d'excitation.",
      isNeutral: true,
    },
    {
      label: 'Petit Bosquet',
      description:
        'Les feuilles frémissent, et un écureuil curieux vous observe.',
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: 'Un moment pour respirer, admirer le ciel bleu.',
      isNeutral: true,
    },
    {
      label: 'Petit Pont',
      description: 'Le bois craque doucement sous vos pas.',
      isNeutral: false,
    },
    {
      label: 'Collines Dansantes',
      description: 'Les ondulations du terrain vous font sourire.',
      isNeutral: false,
    },
    {
      label: 'Rivière Chantante',
      description: "L'eau clapote et semble vous encourager.",
      isNeutral: false,
    },
    {
      label: 'Prairie Colorée',
      description: 'Des fleurs folles se balancent au rythme du vent.',
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: 'Rien à signaler, juste un souffle tranquille.',
      isNeutral: true,
    },
    {
      label: 'Monticule Rigolo',
      description: 'Vous escaladez ce mini-tas sans glisser dans la boue.',
      isNeutral: false,
    },
    {
      label: 'Forêt des Chuchotis',
      description: 'Les arbres semblent murmurer des secrets.',
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: "Le temps s'arrête un instant, profitez-en !",
      isNeutral: true,
    },
    {
      label: 'Racine Taquine',
      description:
        'Elle tente de vous faire trébucher, mais vous vous en sortez.',
      isNeutral: false,
    },
    {
      label: 'Colline du Hérisson',
      description: "Il roucoule... ou c'est juste votre imagination ?",
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: 'Silence sauf le vent dans les branches.',
      isNeutral: true,
    },
    {
      label: 'Tourbillon de Feuilles',
      description: 'Quelques feuilles tournoient autour de vous.',
      isNeutral: false,
    },
    {
      label: 'Pont Suspendu',
      description: 'Vous avancez avec précaution, chaque pas compte.',
      isNeutral: false,
    },
    {
      label: 'Petite Mare Mystérieuse',
      description: "On dirait qu'elle cache quelque chose.",
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: "Pause contemplative, le temps d'un souffle.",
      isNeutral: true,
    },
    {
      label: 'Chemin des Fougères',
      description: 'Les frondes vous chatouillent les jambes.',
      isNeutral: false,
    },
    {
      label: "Colline de l'Élan",
      description: "Vous sentez l'énergie vous pousser vers l'avant.",
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: "Juste un souffle d'air frais.",
      isNeutral: true,
    },
    {
      label: 'Racine Souriante',
      description: "Elle s'incline comme pour vous saluer.",
      isNeutral: false,
    },
    {
      label: 'Forêt des Murmures',
      description: 'Les oiseaux vous suivent du regard, curieux.',
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: 'Rien ne se passe, profitez du moment.',
      isNeutral: true,
    },
    {
      label: 'Prairie des Papillons',
      description: 'Ils virevoltent autour de vous, légers et colorés.',
      isNeutral: false,
    },
    {
      label: 'Monticule Secret',
      description: 'On dirait un passage oublié à explorer.',
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: 'Respirez, le parcours continue calmement.',
      isNeutral: true,
    },
    {
      label: 'Pont des Échos',
      description: 'Chaque pas résonne, drôle et surprenant.',
      isNeutral: false,
    },
    {
      label: 'Case Neutre',
      description: "La ligne d'arrivée se rapproche, le cœur s'emballe.",
      isNeutral: true,
    },
    {
      label: 'Arrivée',
      description:
        "Bravo ! vous franchissez la ligne, acclamé par l'univers entier !",
      isNeutral: true,
    },
  ];

  return tiles;
}

function buildDeck(): CaCard[] {
  const cards: CaCard[] = [];
  const push = (
    id: number,
    title: string,
    category: string,
    kind: CaCard['kind'],
    text: string,
    moveDelta?: number,
  ) => cards.push({ id, title, category, kind, text, moveDelta });

  // a) Avances simples (12) - ids 1..12
  const a = [
    ['Petit Coup de Chance', 1, 'Vous ressentez un l?ger souffle favorable. Avancez de 1 case.'],
    ['Chaussures Lustr?es', 2, "Vos semelles glissent juste ce qu?il faut. Avancez de 2 cases."],
    ['Pas Press? mais Efficace', 1, 'Vous vous d?placez ? votre rythme et ?a marche. Avancez de 1 case.'],
    ['Pas de Panique, ?a Passe', 2, 'Vous tracez tranquillement. Avancez de 2 cases.'],
    ['Vent dans le Dos', 3, 'Le vent vous pousse gentiment. Avancez de 3 cases.'],
    ['Sourire Confiant', 2, 'Vous inspirez la fluidit?. Avancez de 2 cases.'],
    ['Acc?l?ration Modeste', 3, "Rien d?extraordinaire, mais ?a avance. Avancez de 3 cases."],
    ['Gambettes Courageuses', 2, 'Vous avancez d?termin?. Avancez de 2 cases.'],
    ['Vous Trouvez le Bon Rythme', 3, 'Les choses sont simples. Avancez de 3 cases.'],
    ['Vous vous D?brouillez Bien', 1, 'Pas de panique, Vous g?rez. Avancez de 1 case.'],
    ['Vibration Positive', 2, 'Une bonne journ?e. Avancez de 2 cases.'],
    ['En Avant, Toujours', 3, 'Pas de r?flexion inutile... Avancez de 3 cases.'],
  ] as const;
  a.forEach(([title, delta, text], i) =>
    push(i + 1, title, 'a_avances_simples', 'move', text, delta),
  );

  // b) Avances spectaculaires (8) - ids 13..20
  const b = [
    ['Turbo Improbable', 5, 'On ne sait pas pourquoi, mais vous foncez. Avancez de 5 cases.'],
    ['?lan de H?ros', 6, "C?est beau. On applaudit. Avancez de 6 cases."],
    ['Sprint de l?Inattendu', 7, 'Votre corps d?cide de r?ussir. Avancez de 7 cases.'],
    ['Caf? Beaucoup Trop Fort', 6, "L?effet est imm?diat. Avancez de 6 cases."],
    ['Chevauch?e Triomphale Sans Cheval', 8, 'Vous simulez le cheval. ?a marche. Avancez de 8 cases.'],
    ['Vous Volez Presque', 5, "L?air vous soutient. Avancez de 5 cases."],
    ['Coup de G?nie du Genou', 7, 'Vos jambes prennent une d?cision audacieuse. Avancez de 7 cases.'],
    ['Ligne Droite Parfaite', 6, 'Fluide, pr?cis, imparable. Avancez de 6 cases.'],
  ] as const;
  b.forEach(([title, delta, text], i) =>
    push(13 + i, title, 'b_avances_spectaculaires', 'move', text, delta),
  );

  // c) Reculs / Pertes (12) - ids 21..32
  const c = [
    ['Canard Philosophe', 'skip', 0, 'Il faut ?couter son discours. Passez un tour.'],
    ['Glissade ?l?gante mais Contre-productive', 'move', -2, 'Vous glissez en beaut?. Reculez de 2 cases.'],
    ['Vous Oubliez ce que vous Faisiez', 'skip', 0, 'Petit moment de vide. Passez un tour.'],
    ['Chaussures ? l\'Envers', 'move', -1, 'Cela g?ne un peu. Reculez de 1 case.'],
    ['Vous Cherchez votre ?lan', 'skip', 0, '?a viendra. Passez un tour.'],
    ['Doute Existentialo-Sportif', 'move', -3, 'Est-ce vraiment une bonne id?e ? Reculez de 3 cases.'],
    ['Vous Perdez l\'?quilibre', 'move', -2, 'Rien de grave, mais bon Reculez de 2 cases.'],
    ['Piqure de Mouette (Symbolique)', 'move', -1, 'Vous prenez ?a personnellement. Reculez de 1 case.'],
    ['Bourrasque Fripouille', 'move', -3, "Le vent n?est pas votre ami aujourd?hui. Reculez de 3 cases."],
    ['Vous F?licitez Quelqu\'un pour Rien', 'move', -1, '?a ralentit. Reculez de 1 case.'],
    ['Vous vous enlacez vous-M?me', 'skip', 0, "C?est bien, mais le temps passe. Passez un tour."],
    ['Vous Faites Demi-Tour par Erreur', 'move', -4, 'Vous revenez ? votre pr?c?dent emplacement. Reculez de 4 cases.'],
  ] as const;
  c.forEach(([title, kind, delta, text], i) =>
    push(
      21 + i,
      title,
      'c_reculs',
      kind as any,
      text,
      kind == 'move' ? (delta as any) : undefined,
    ),
  );

  // d) Raccourcis / D?placements sp?ciaux (8) - ids 33..40
  push(
    33,
    'Raccourci Secret',
    'd_special',
    'rule',
    'Vous passez devant le joueur en t?te. Vous prenez la premi?re place.',
  );
  push(
    34,
    'Chemin des Cactus Sympathiques',
    'd_special',
    'rule',
    'Ils vous ouvrent la voie. Avancez de 4 cases et ignorez la prochaine p?nalit?.',
    4,
  );
  push(
    35,
    'Saute-Mouton',
    'd_special',
    'rule',
    'Vous bondissez par-dessus le joueur devant vous. Vous le faite reculez de 1 case.',
  );
  push(
    36,
    'Saut Quantique Non Pr?vu',
    'd_special',
    'rule',
    "La physique applaudit. Avancez jusqu?? la prochaine case multiple de 5.",
  );
  push(
    37,
    'Chemin de Traverse',
    'd_special',
    'rule',
    'Vous prenez un passage oubli?. Avancez de 3 cases et rejouez.',
    3,
  );
  push(
    38,
    'Trompe-l\'?il du D?cor',
    'd_special',
    'swap',
    'Vous apparaissez plus loin que pr?vu. Avancez de 2 cases et ?changez votre position avec un joueur de votre choix.',
    2,
  );
  push(
    39,
    'Trappe Bienveillante',
    'd_special',
    'move',
    'On vous transporte plus loin, sans explication. Avancez de 5 cases.',
    5,
  );
  push(
    40,
    'Virage ? 90? Trop Efficace',
    'd_special',
    'move',
    'Vous coupez net. Avancez de 3 cases.',
    3,
  );

  // e) Chaos partag? (10) - ids 41..50
  const e = [
    ['La Trompette de l\'Univers', 'global', 'Tous les joueurs changent de place au hasard. M?langer toutes les positions.'],
    ['Course en File Indienne', 'global', "Le dernier devient premier. Inverser l?ordre du classement."],
    ['Pause Hydratation Collective', 'global', 'Personne ne se d?place ce tour-ci. Tour commun perdu.'],
    ['Concours de Fi?res Postures', 'global', 'Chacun avance dignement. Tout le monde avance de 1 case.'],
    ['Le Sol Est Un Peu Trop ?lastique', 'global', 'Le sol penche dangeureusement en arri?re. Tout le monde recule de 2 cases.'],
    ['Brise de S?r?nit?', 'neutral', "Rien n?arrive. Absolument rien. Aucun effet."],
    ['Appel du Koala Int?rieur', 'global', 'Tout le monde se repose. Tout le monde passe un tour.'],
    ['Applaudissements Inattendus', 'global', '?a motive tout le monde. Tout le monde avance de 1 case.'],
    ['Brouhaha Inexplicable', 'global', 'Tous les joueurs ?changent leur place avec celui juste derri?re lui. D?calage g?n?ral !'],
    ['La Danse des Mollets Heureux', 'global', 'Bonne humeur g?n?rale. Tout le monde relance le d?.'],
  ] as const;
  e.forEach(([title, kind, text], i) =>
    push(41 + i, title, 'e_chaos', kind as any, text),
  );

  // f) Effets conditionnels (10) - ids 51..60
  const f = [
    'Si vous ?tes en t?te, vous reculez de 2 cases. Sinon vous avancez de 2.',
    'Si vous ?tes dernier, avancez de 3 cases. Sinon, rien ne se passe.',
    'Si vous venez de reculer, avancez de 3 cases. Sinon rien.',
    "Si vous devez passer un tour, vous l?annulez.",
    'Si vous ?tes sur une case multiple de 5, avancez de 4 cases. Sinon reculez de 1.',
    "Si vous n?avez pas boug? depuis 2 tours, avancez de 5 cases.",
    "Si vous ?tes ? ?galit? avec quelqu?un, avancez tous les deux de 2 cases.",
    'Rejouez imm?diatement votre tour !',
    "Si vous arrivez juste derri?re quelqu?un, rejoignez-le.",
    "Si vous d?passez un joueur d\'une case ce tour-ci, avancez encore de 1.",
  ] as const;
  f.forEach((text, i) =>
    push(51 + i, 'Condition ' + (i + 1), 'f_conditionnel', 'conditional', text),
  );

  // g) R?gles idiotes temporaires (10) - ids 61..70
  const g = [
    'Vous devez lancer le d? deux fois, et avancer le total obtenu.',
    'Piochez une carte au hasard.',
    'Votre prochain d?placement est doubl?.',
    'Reculez de 3 case puis avancez de 2.',
    'Votre prochain recul est ignor?.',
    'Avancez de 3 cases puis reculez de 1.',
    'Choisissez qui joue apr?s vous ce tour-ci.',
    'Vous d?cidez si le prochain joueur recule ou avance de 1.',
    'Votre prochain lancer de d? compte double.',
    'Choisissez un joueur : Votre prochain lancer de d? devient ?gal au sien.',
  ] as const;
  g.forEach((text, i) =>
    push(61 + i, 'R?gle idiote ' + (i + 1), 'g_regles', 'rule', text),
  );

  // h) Cartes ambiance neutres (10) - ids 71..80
  const h = [
    'La Brise Chante. M?me le vent a mis ses chaussettes rigolotes ce matin.',
    'Un Oiseau Observe la Course. Il a pari? sur vous, ou pas on ne sait jamais.',
    'Le Sol Ouvre un Souvenir. Attention, il pourrait se rappeler de vos ?tranges pens?es !',
    "Une Clochette Lointaine. On dirait qu?un chat joue de la trompette au loin.",
    'Le Monde Vous Regarde avec Tendresse. Il rit un peu de vos chaussettes d?pareill?es.',
    "Une Vague d?Optimisme Passe. Elle porte des lunettes de soleil et un sourire g?ant.",
    'Les Montagnes Encouragent Silencieusement. Elles hochent la t?te comme des grands sages poss?d?s.',
    "Un Souffle de For?t Vous Entoure. Il sent l?herbe, la mousse et un peu de biscuits disparus.",
    'La Course Est Belle, Tout Simplement. M?me les escargots applaudissent avec leurs antennes.',
    'Moment de Paix entre Deux Pas. Silence sauf si un lapin fait du breakdance !',
  ] as const;
  h.forEach((text, i) =>
    push(71 + i, 'Ambiance ' + (i + 1), 'h_ambiance', 'neutral', text),
  );

  return cards;
}

