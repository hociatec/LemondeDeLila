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
  const labels: string[] = [
    'Départ',
    'Petit bosquet',
    'Case neutre',
    'Petit pont',
    'Collines dansantes',
    'Rivière chantante',
    'Prairie colorée',
    'Case neutre',
    'Monticule rigolo',
    'Forêt des chuchotis',
    'Case neutre',
    'Racine taquine',
    'Colline du hérisson',
    'Case neutre',
    'Tourbillon de feuilles',
    'Pont suspendu',
    'Petite mare mystérieuse',
    'Case neutre',
    'Chemin des fougères',
    "Colline de l'élan",
    'Case neutre',
    'Racine souriante',
    'Forêt des murmures',
    'Case neutre',
    'Prairie des papillons',
    'Monticule secret',
    'Case neutre',
    'Pont des échos',
    'Case neutre',
    'Arrivée',
  ];
  return labels.map((label) => ({ label }));
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
    keepTurn?: boolean,
  ) => cards.push({ id, title, category, kind, text, moveDelta, keepTurn });

  const simple = [
    ['Petit coup de chance', 1],
    ['Chaussures lustrées', 2],
    ['Pas pressé mais efficace', 1],
    ['Pas de panique, ça passe', 2],
    ['Vent dans le dos', 3],
    ['Sourire confiant', 2],
    ['Accélération modeste', 3],
    ['Gambettes courageuses', 2],
    ['Tu trouves le bon rythme', 3],
    ['Tu te débrouilles bien', 1],
    ['Vibration positive', 2],
    ['En avant, toujours', 3],
  ] as const;
  simple.forEach(([t, d], i) =>
    push(i + 1, t, 'avances_simples', 'move', `Avance de ${d} case(s).`, d),
  );

  const spectacular = [
    ['Turbo improbable', 5],
    ['Élan de héros', 6],
    ["Sprint de l'inattendu", 7],
    ['Café beaucoup trop fort', 6],
    ['Chevauchée triomphale… sans cheval', 8],
    ['Tu voles presque', 5],
    ['Coup de génie du genou', 7],
    ['Ligne droite parfaite', 6],
  ] as const;
  spectacular.forEach(([t, d], i) =>
    push(
      13 + i,
      t,
      'avances_spectaculaires',
      'move',
      `Avance de ${d} case(s).`,
      d,
    ),
  );

  const losses = [
    ['Canard philosophe', 'skip', 1],
    ['Glissade élégante mais contre-productive', 'move', -2],
    ['Tu oublies ce que tu faisais', 'skip', 1],
    ["Chaussures à l'envers", 'move', -1],
    ["Tu cherches ton élan", 'move', 0],
    ['Doute existentialo-sportif', 'move', -3],
    ["Tu perds l'équilibre", 'move', -2],
    ['Piqûre de mouette (symbolique)', 'move', -1],
    ['Bourrasque fripouille', 'move', -3],
    ["Tu félicites quelqu'un pour rien", 'move', -1],
    ["Tu t'enlaces toi-même", 'skip', 1],
    ['Tu fais demi-tour par erreur', 'move', -4],
  ] as const;
  losses.forEach(([t, k, d], i) => {
    const id = 21 + i;
    if (k === 'skip')
      push(id, t, 'reculs', 'skip', 'Perds ton prochain tour.');
    else
      push(
        id,
        t,
        'reculs',
        'move',
        d === 0 ? "Pas de déplacement ce tour-ci." : `Déplacement: ${d}.`,
        d as any,
      );
  });

  const special = [
    ['Raccourci secret', 'rule', 'Tu prends la première place.'],
    [
      'Chemin des cactus sympathiques',
      'rule',
      'Avance de 4 cases et ignore la prochaine pénalité.',
    ],
    ['Saute-mouton', 'rule', "Tu dépasses d'1 place le joueur devant toi."],
    [
      'Saut quantique non prévu',
      'rule',
      "Avance jusqu'à la prochaine case multiple de 5.",
    ],
    ['Chemin de traverse', 'rule', 'Avance de 3 cases et rejoue.', 3, true],
    [
      "Trompe-l’œil du décor",
      'swap',
      'Avance de 2 cases et échange ta position avec un joueur.',
    ],
    ['Trappe bienveillante', 'move', 'Avance de 5 cases.', 5],
    ['Virage à 90° trop efficace', 'move', 'Avance de 3 cases.', 3],
  ] as const;
  special.forEach(([t, kind, text, delta, keepTurn], i) =>
    push(33 + i, t, 'special', kind as any, text, delta as any, keepTurn as any),
  );

  const shared = [
    ['La trompette de l’univers', 'global', 'Tous les joueurs changent de place au hasard.'],
    ['Course en file indienne', 'global', "Le dernier devient premier (inversion du classement)."],
    ['Pause hydratation collective', 'global', 'Tour commun perdu (tous passent leur prochain tour).'],
    ['Concours de fières postures', 'global', 'Chacun avance de 1 case.'],
    ['Le sol est un peu trop élastique', 'global', 'Tout le monde recule de 2.'],
    ['Brise de sérénité', 'neutral', "Rien n'arrive."],
    ['Appel du koala intérieur', 'global', 'Tous passent leur prochain tour.'],
    ['Applaudissements inattendus', 'global', 'Tous avancent de 2 cases.'],
    ['Brouhaha inexplicable', 'global', 'Décalage général des positions.'],
    ['La danse des mollets heureux', 'global', 'Le joueur courant rejoue.', undefined, true],
  ] as const;
  shared.forEach(([t, kind, text, delta, keepTurn], i) =>
    push(41 + i, t, 'chaos', kind as any, text as any, delta as any, keepTurn as any),
  );

  const conditional = [
    'Si tu es en tête, tu recules de 2. Sinon tu avances de 2.',
    'Si tu es dernier, avance de 3 cases. Sinon, rien ne se passe.',
    'Si tu viens de reculer, avance de 3. Sinon rien.',
    'Si tu dois attendre un tour, tu l’annules.',
    'Si tu es sur une case multiple de 5, avance de 4. Sinon recule de 1.',
    "Si tu n'as pas bougé depuis 2 tours, avance de 5.",
    'Si tu es à égalité avec quelqu’un, vous avancez tous les deux de 2.',
    'Rejoue immédiatement ton tour !',
    'Si tu arrives derrière quelqu’un à 1 case, rejoins-le.',
    'Si tu dépasses un joueur ce tour-ci, avance encore de 1.',
  ];
  conditional.forEach((text, i) =>
    push(51 + i, `Condition ${i + 1}`, 'conditionnel', 'conditional', text, undefined, i === 7),
  );

  const rules = [
    'Tu dois lancer le dé deux fois ce tour-ci et avancer le total obtenu.',
    'Pioche une carte.',
    'Ton prochain déplacement est doublé.',
    'Recule de 3 cases puis avance de 2.',
    'Ton prochain recul est ignoré.',
    'Avance de 3 cases puis recule de 1.',
    'Tu choisis qui joue après toi ce tour-ci.',
    'Tu décides si le prochain joueur recule de 1 ou avance de 1.',
    'Ton prochain lancer de dé compte double.',
    'Choisis un joueur : ton prochain lancer de dé devient égal au sien.',
  ];
  rules.forEach((text, i) =>
    push(61 + i, `Règle idiote ${i + 1}`, 'regle', 'rule', text),
  );

  const ambience = [
    'La brise chante.',
    'Un oiseau observe la course.',
    'Le sol ouvre un souvenir.',
    'Une clochette lointaine.',
    'Le monde vous regarde avec tendresse.',
    "Une vague d'optimisme passe.",
    'Les montagnes encouragent silencieusement.',
    'Un souffle de forêt vous entoure.',
    'La course est belle, tout simplement.',
    'Moment de paix entre deux pas.',
  ];
  ambience.forEach((text, i) =>
    push(71 + i, `Ambiance ${i + 1}`, 'ambiance', 'neutral', text),
  );

  return cards;
}
