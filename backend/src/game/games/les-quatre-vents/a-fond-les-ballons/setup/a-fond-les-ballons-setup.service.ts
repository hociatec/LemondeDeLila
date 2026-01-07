import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type {
  AFondLesBallonsCard,
  AFondLesBallonsMetadata,
  AFondLesBallonsTile,
} from '../model/a-fond-les-ballons-state.entity';

@Injectable()
export class AFondLesBallonsSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
    }

    const tiles = buildTiles();

    const metaBase: AFondLesBallonsMetadata = {
      tiles,
      positions,
      statuses: { skipTurn: {}, trapImmunityTurns: {} },
      decks: {
        loufoque: defaultLoufoqueDeck(),
        discardLoufoque: [],
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

function buildTiles(): AFondLesBallonsTile[] {
  const types: AFondLesBallonsTile['type'][] = [
    'start',
    'bonus',
    'folie',
    'neutral',
    'piege',
    'glissade',
    'neutral',
    'tornade',
    'folie',
    'neutral',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'chaton',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'tornade',
    'folie',
    'bonus',
    'piege',
    'glissade',
    'neutral',
    'folie',
    'piege',
    'glissade',
    'finish',
  ];

  const tiles: AFondLesBallonsTile[] = [];
  for (let i = 0; i < 40; i += 1) {
    const type = types[i] ?? 'neutral';
    const label =
      type === 'start'
        ? 'Départ - La Tanière à Tartines'
        : type === 'finish'
          ? 'La Grosse Noix Dorée'
          : type === 'bonus'
            ? 'Bonus'
            : type === 'folie'
              ? 'Folie'
              : type === 'piege'
                ? 'Piège'
                : type === 'glissade'
                  ? 'Glissade'
                  : type === 'tornade'
                    ? 'Tornade'
                    : type === 'chaton'
                      ? 'Chaton'
                      : `Case ${i + 1}`;
    tiles.push({ type, label });
  }
  return tiles;
}

function defaultLoufoqueDeck(): AFondLesBallonsCard[] {
  return [
    {
      id: 1,
      text: 'Vous glissez sur une peau de banane séchée. Reculez de 2 cases.',
    },
    {
      id: 2,
      text: 'Un muscardin vous livre un cookie géant, beaucoup trop lourd. Passez votre tour.',
    },
    {
      id: 3,
      text: 'Vous sautez dans une flaque de confiture collante. Avancez d’une case.',
    },
    {
      id: 4,
      text: 'Une noix étrange chante et perturbe la tanière. La partie est figée : aucun joueur n’agit pendant ce tour.',
    },
    {
      id: 5,
      text: 'Un écureuil volant vous prend pour un ami et vous emporte dans les airs. Avancez de 4 cases.',
    },
    {
      id: 6,
      text: 'Vous renversez une bouteille de sirop magique. Tous les joueurs reculent d’une case.',
    },
    {
      id: 7,
      text: 'Vous trouvez une corde à sauter en réglisse enchantée. Avancez de 2 cases.',
    },
    { id: 8, text: 'Le Grand Chaton éternue violemment. Reculez d’une case.' },
    {
      id: 9,
      text: 'Vous vous prenez les pattes dans du chewing-gum collant. Passez votre tour.',
    },
    {
      id: 10,
      text: 'Un lérot ninja surgit et vous tend une noisette turbo. Avancez jusqu’à la prochaine case Bonus.',
    },
    {
      id: 11,
      text: 'Vous mangez trop de pop-corn et avez mal au ventre. Passez votre tour.',
    },
    {
      id: 12,
      text: 'Votre museau vous démange sans raison. Reculez d’une case.',
    },
    {
      id: 13,
      text: 'Une gerboise farceuse vous chatouille les pattes. Sautez d’une case.',
    },
    {
      id: 14,
      text: 'Vous chevauchez un ragondin en trottinette. Avancez de 3 cases.',
    },
    {
      id: 15,
      text: 'Vous faites tomber une montagne de cacahuètes. Distrait, vous reculez d’une case.',
    },
    {
      id: 16,
      text: 'Une bulle de savon géante vous emporte. Avancez jusqu’à la prochaine case Folie.',
    },
    {
      id: 17,
      text: 'Un capybara vous invite à une sieste improvisée. Passez votre tour et ronflez à ses côtés.',
    },
    {
      id: 18,
      text: 'Une souris malicieuse vous pique une noisette et file à toute vitesse. Vous la poursuivez et avancez de 2 cases.',
    },
    {
      id: 19,
      text: 'Un loir vous montre le chemin en remuant la queue. Avancez d’une case en souriant.',
    },
    {
      id: 20,
      text: 'Vous confondez une chaussette avec un bonnet, et ne voyez plus rien. Passez votre tour.',
    },
    {
      id: 21,
      text: 'Vous renversez un pot de peinture fluo. Tout le monde avance d’une case.',
    },
    {
      id: 22,
      text: 'Une baguette magique vous transforme temporairement en fromage. Passez deux tours.',
    },
    { id: 23, text: 'Vous trouvez un trampoline géant. Avancez de 4 cases.' },
    {
      id: 24,
      text: 'Un agouti philosophe vous parle longuement. Passez votre tour.',
    },
    {
      id: 25,
      text: 'Vous construisez une solide cabane en biscuits. Rejouez.',
    },
    {
      id: 26,
      text: 'Vous éternuez des confettis multicolores. Tous les joueurs avancent du même nombre de cases obtenu précédemment.',
    },
    {
      id: 27,
      text: 'Un petit avion de carton vous emporte maladroitement. Avancez d’une case, puis reculez de deux.',
    },
    {
      id: 28,
      text: 'Vous lisez un vieux grimoire ronronique. Échangez votre position avec le joueur de votre choix.',
    },
    {
      id: 29,
      text: 'Une catapulte de fromage rebondit sur vous. Reculez jusqu’à la case 13.',
    },
    {
      id: 30,
      text: 'Vous tombez dans une mare d’épaisse mousse. Passez votre tour.',
    },
    {
      id: 31,
      text: 'Un hutia curieux bondit sur votre chemin et vous bouscule gentiment. Avancez d’une case… un peu étourdi.',
    },
    {
      id: 32,
      text: 'Un fromage qui parle vous raconte une irrésistible blague. Avancez de 2 cases.',
    },
    {
      id: 33,
      text: 'Vous jouez à saute-rongeur avec un paca. Avancez de 3 cases.',
    },
    {
      id: 34,
      text: 'Vous entrez dans la Boutique des Rongeurs Fous. Piochez deux cartes Loufoques et appliquez celle qui vous fait le plus reculer.',
    },
    {
      id: 35,
      text: 'Un tunnel défectueux vous mène droit chez le Chaton gourmand. Retournez à la case départ.',
    },
    {
      id: 36,
      text: 'Vous devenez temporairement invisible. Durant deux tours, vous ignorez les effets des cases Piège.',
    },
    {
      id: 37,
      text: 'Vous mangez un piment super piquant. Reculez de 5 cases.',
    },
    {
      id: 38,
      text: 'Un biscuit géant explose. Tous les joueurs se déplacent d’une case aléatoire.',
    },
    {
      id: 39,
      text: 'Une pluie de bonbons tombe sur vous. Avancez de 2 cases.',
    },
    {
      id: 40,
      text: 'La Reine des Rongeurs vous envoie un message. Si vous êtes sur une case Glissade, avancez jusqu’à la case 40.',
    },
  ];
}
