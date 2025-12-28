import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type {
  ContesCacahuetesMetadata,
  ContesCacahuetesTile,
  ContesCard,
} from '../model/contes-et-cacahuetes-state.entity';

@Injectable()
export class ContesCacahuetesSetupService {
  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const players = Array.isArray(baseState.players) ? baseState.players : [];
    const positions: Record<number, number> = {};
    for (const p of players) positions[p.id] = 0;

    const metaBase: ContesCacahuetesMetadata = {
      tiles: buildTiles(),
      positions,
      decks: buildDecks(),
      statuses: {
        skipTurn: {},
        rerollToken: {},
        shieldMalus: {},
        protectNextMalus: {},
        ignoreNextConteAndAdvance: {},
        replaceOneOn1By4: {},
        noBonusCardsTurns: {},
        forcedRollOneTurns: {},
        reverseNextTurn: {},
        blockedUntilPassed: {},
        turnSwapWith: {},
        turnSwapRemaining: {},
        keyOfGold: {},
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

function buildTiles(): ContesCacahuetesTile[] {
  const tiles: ContesCacahuetesTile[] = [];
  const push = (type: ContesCacahuetesTile['type'], label: string) => tiles.push({ type, label });

  push('start', 'Départ');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Japon : Momotarō');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Sénégal : Le lièvre et l’hyène');
  push('malus', 'Malus');
  push('conte', 'Conte - Russie : Vassilissa la très belle');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Canada : L’ours géant et l’enfant');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Maroc : Le figuier magique');
  push('malus', 'Malus');
  push('conte', 'Conte - Chine : La princesse éventail');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Irlande : Le géant Fionn et Benandonner');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Pérou : Le colibri courageux');
  push('malus', 'Malus');
  push('conte', 'Conte - Égypte : Le secret du Nil');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Australie : Tiddalik, la grenouille');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Allemagne : Le joueur de flûte de Hamelin');
  push('malus', 'Malus');
  push('conte', 'Conte - Inde : Le prince au cobra');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Groenland : L’ourse et la chasseuse');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Italie : Giufà et l’âne');
  push('malus', 'Malus');
  push('conte', 'Conte - Kenya : Le feu volant');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Chili : La lune et le renard');
  push('surprise', 'Surprise');
  push('conte', 'Conte - France : Le Petit Poucet');
  push('malus', 'Malus');
  push('conte', 'Conte - Corée du Sud : La grue reconnaissante');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Brésil : La tortue et le jaguar');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Iran : Le tapis volant');
  push('malus', 'Malus');
  push('conte', 'Conte - Thaïlande : La mangue du roi');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Angleterre : Jack et le haricot magique');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Vietnam : L’enfant des rizières');
  push('malus', 'Malus');
  push('conte', 'Conte - Espagne : Le tambour enchanté');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Haïti : Ti-Jean et le diable');
  push('surprise', 'Surprise');
  push('conte', 'Conte - Turquie : Nasreddine et l’âne');
  push('malus', 'Malus');
  push('conte', 'Conte - Nouvelle-Zélande : Maui ralentit le soleil');
  push('bonus', 'Bonus');
  push('conte', 'Conte - Mali : L’hippopotame et les étoiles');
  push('malus', 'Malus');
  push('conte', 'Conte - Pologne : Le roi grenouille');
  push('finish', 'Arrivée - Grand livre magique');

  return tiles;
}

function buildDecks(): ContesCacahuetesMetadata['decks'] {
  const bonus: ContesCard[] = [
    { id: 1, type: 'bonus', title: 'Bottes de sept lieues', text: 'Avancez de 2 cases supplémentaires.' },
    { id: 2, type: 'bonus', title: 'Parchemin enchanté', text: 'Vous pouvez relancer une seule fois le dé.' },
    { id: 3, type: 'bonus', title: 'Amulette protectrice', text: 'Vous protège d’un malus (valable une fois).' },
    { id: 4, type: 'bonus', title: 'Cape d’invisibilité', text: 'Si vous arrivez sur une case Conte, elle est ignorée et vous avancez d’1 case.' },
    { id: 5, type: 'bonus', title: 'Poussière de fée', text: 'Faites avancer un autre joueur de 2 cases.' },
    { id: 6, type: 'bonus', title: 'Haricot magique', text: 'Lancez le dé maintenant : résultat doublé.' },
    { id: 7, type: 'bonus', title: 'Clé d’or universelle', text: 'Sur Conte : choisissez Bonus ou Malus pour un autre joueur.' },
    { id: 8, type: 'bonus', title: 'Ami légendaire', text: 'Avancez de 3 cases.' },
    { id: 9, type: 'bonus', title: 'Pont arc-en-ciel', text: 'Piochez une carte Bonus et une carte Surprise.' },
    { id: 10, type: 'bonus', title: 'Formule magique', text: 'Choisissez un joueur : échangez vos prochains tours.' },
    { id: 11, type: 'bonus', title: 'Flûte enchantée', text: 'Au prochain tour des autres joueurs, ils avancent d’1 case.' },
    { id: 12, type: 'bonus', title: 'Corne d’abondance', text: 'Piochez 2 Bonus, gardez-en 1.' },
    { id: 13, type: 'bonus', title: 'Monture mystique', text: 'Avancez de 5 cases, mais passez votre prochain tour.' },
    { id: 14, type: 'bonus', title: 'Feuille magique', text: 'La prochaine fois que vous faites 1, avancez de 4 à la place.' },
    { id: 15, type: 'bonus', title: 'Lanterne lumineuse', text: 'Reculez de 2 cases puis avancez de 3.' },
  ];

  const malus: ContesCard[] = [
    { id: 1, type: 'malus', title: 'Sortilège de sommeil', text: 'Passez votre tour.' },
    { id: 2, type: 'malus', title: 'Ronce enchevêtrée', text: 'Reculez de 2 cases.' },
    { id: 3, type: 'malus', title: 'Grimoire capricieux', text: 'Échangez votre place avec le joueur le plus proche derrière vous.' },
    { id: 4, type: 'malus', title: 'Pluie de mots oubliés', text: 'Lancez le dé et avancez seulement de la moitié.' },
    { id: 5, type: 'malus', title: 'Loup dans la forêt', text: 'Bloqué jusqu’à ce qu’un autre joueur atteigne ou dépasse votre case.' },
    { id: 6, type: 'malus', title: 'Sable mouvant magique', text: 'Passez deux tours.' },
    { id: 7, type: 'malus', title: 'Page manquante', text: 'Tirez une autre carte Malus et subissez son effet.' },
    { id: 8, type: 'malus', title: 'Confusion de contes', text: 'Avancez de 3 cases puis reculez de 4.' },
    { id: 9, type: 'malus', title: 'Maladresse de sorcier', text: 'Donnez une de vos cartes Bonus à un autre joueur.' },
    { id: 10, type: 'malus', title: 'Ombre farceuse', text: 'Relancez le dé, mais reculez au lieu d’avancer.' },
    { id: 11, type: 'malus', title: 'Énigme infernale', text: 'Lancez le dé : si 4+ avancez, sinon passez votre tour.' },
    { id: 12, type: 'malus', title: 'Passage obscur', text: 'Retournez à la case Malus précédente et revivez son effet.' },
    { id: 13, type: 'malus', title: 'Chaussures trop petites', text: 'Reculez de 2 cases.' },
    { id: 14, type: 'malus', title: 'Miroir brisé', text: 'Retournez à la case départ.' },
    { id: 15, type: 'malus', title: 'Grimoire grincheux', text: 'Vous ne pouvez plus jouer de carte Bonus pendant deux tours.' },
  ];

  const surprise: ContesCard[] = [
    { id: 1, type: 'surprise', title: 'Baguette malicieuse', text: 'Avancez d’1 case puis reculez de 2.' },
    { id: 2, type: 'surprise', title: 'Voyage en tapis volant', text: 'Avancez de 4 cases.' },
    { id: 3, type: 'surprise', title: 'Rencontre inattendue', text: 'Piochez une carte Bonus.' },
    { id: 4, type: 'surprise', title: 'Coffre aux merveilles', text: 'Tirez deux cartes au hasard (Bonus/Malus/Surprise) et appliquez-les.' },
    { id: 5, type: 'surprise', title: 'Poussière de rire', text: 'Choisissez 1 à 3 : le plus grand avance d’1 case.' },
    { id: 6, type: 'surprise', title: 'Tempête de pages', text: 'Choisissez un joueur et échangez vos positions.' },
    { id: 7, type: 'surprise', title: 'Carte invisible', text: 'Passez votre tour.' },
    { id: 8, type: 'surprise', title: 'Livre à l’envers', text: 'Votre prochain tour se fait en reculant.' },
    { id: 9, type: 'surprise', title: 'Chanson enchantée', text: 'Choisissez : avancer de 3 ou prendre une carte Bonus à un autre joueur.' },
    { id: 10, type: 'surprise', title: 'Dragon de papier', text: 'Protège automatiquement de la prochaine carte Malus.' },
    { id: 11, type: 'surprise', title: 'Conte perdu', text: 'Piochez une carte Conte, même sur une case spéciale.' },
    { id: 12, type: 'surprise', title: 'Montre enchantée', text: 'Relancez le dé puis reculez du nombre obtenu.' },
    { id: 13, type: 'surprise', title: 'Souhait éphémère', text: 'Choisissez : avancer de 2, échanger, ou tirer une carte Bonus.' },
    { id: 14, type: 'surprise', title: 'Filet magique', text: 'Attrapez une carte Bonus ou Surprise d’un autre joueur.' },
    { id: 15, type: 'surprise', title: 'Grimoire voyageur', text: 'Échangez votre place avec un joueur : lui prend votre position et avance d’1 case.' },
  ];

  const contes: ContesCard[] = [
    { id: 1, type: 'conte', title: 'Conte - Japon : Momotarō', text: 'Un conte du Japon : Momotarō.' },
    { id: 2, type: 'conte', title: 'Conte - Sénégal : Le lièvre et l’hyène', text: 'Un conte du Sénégal : Le lièvre et l’hyène.' },
    { id: 3, type: 'conte', title: 'Conte - Russie : Vassilissa la très belle', text: 'Un conte de Russie : Vassilissa la très belle.' },
    { id: 4, type: 'conte', title: 'Conte - Canada : L’ours géant et l’enfant', text: 'Un conte du Canada : L’ours géant et l’enfant.' },
    { id: 5, type: 'conte', title: 'Conte - Maroc : Le figuier magique', text: 'Un conte du Maroc : Le figuier magique.' },
    { id: 6, type: 'conte', title: 'Conte - Chine : La princesse éventail', text: 'Un conte de Chine : La princesse éventail.' },
    { id: 7, type: 'conte', title: 'Conte - Irlande : Le géant Fionn et Benandonner', text: 'Un conte d’Irlande : Le géant Fionn et Benandonner.' },
    { id: 8, type: 'conte', title: 'Conte - Pérou : Le colibri courageux', text: 'Un conte du Pérou : Le colibri courageux.' },
    { id: 9, type: 'conte', title: 'Conte - Égypte : Le secret du Nil', text: 'Un conte d’Égypte : Le secret du Nil.' },
    { id: 10, type: 'conte', title: 'Conte - Australie : Tiddalik, la grenouille', text: 'Un conte d’Australie : Tiddalik, la grenouille.' },
    { id: 11, type: 'conte', title: 'Conte - Allemagne : Le joueur de flûte de Hamelin', text: 'Un conte d’Allemagne : Le joueur de flûte de Hamelin.' },
    { id: 12, type: 'conte', title: 'Conte - Inde : Le prince au cobra', text: 'Un conte d’Inde : Le prince au cobra.' },
    { id: 13, type: 'conte', title: 'Conte - Groenland : L’ourse et la chasseuse', text: 'Un conte du Groenland : L’ourse et la chasseuse.' },
    { id: 14, type: 'conte', title: 'Conte - Italie : Giufà et l’âne', text: 'Un conte d’Italie : Giufà et l’âne.' },
    { id: 15, type: 'conte', title: 'Conte - Kenya : Le feu volant', text: 'Un conte du Kenya : Le feu volant.' },
    { id: 16, type: 'conte', title: 'Conte - Chili : La lune et le renard', text: 'Un conte du Chili : La lune et le renard.' },
    { id: 17, type: 'conte', title: 'Conte - France : Le Petit Poucet', text: 'Un conte de France : Le Petit Poucet.' },
    { id: 18, type: 'conte', title: 'Conte - Corée du Sud : La grue reconnaissante', text: 'Un conte de Corée du Sud : La grue reconnaissante.' },
    { id: 19, type: 'conte', title: 'Conte - Brésil : La tortue et le jaguar', text: 'Un conte du Brésil : La tortue et le jaguar.' },
    { id: 20, type: 'conte', title: 'Conte - Iran : Le tapis volant', text: 'Un conte d’Iran : Le tapis volant.' },
    { id: 21, type: 'conte', title: 'Conte - Thaïlande : La mangue du roi', text: 'Un conte de Thaïlande : La mangue du roi.' },
    { id: 22, type: 'conte', title: 'Conte - Angleterre : Jack et le haricot magique', text: 'Un conte d’Angleterre : Jack et le haricot magique.' },
    { id: 23, type: 'conte', title: 'Conte - Vietnam : L’enfant des rizières', text: 'Un conte du Vietnam : L’enfant des rizières.' },
    { id: 24, type: 'conte', title: 'Conte - Espagne : Le tambour enchanté', text: 'Un conte d’Espagne : Le tambour enchanté.' },
    { id: 25, type: 'conte', title: 'Conte - Haïti : Ti-Jean et le diable', text: 'Un conte d’Haïti : Ti-Jean et le diable.' },
    { id: 26, type: 'conte', title: 'Conte - Turquie : Nasreddine et l’âne', text: 'Un conte de Turquie : Nasreddine et l’âne.' },
    { id: 27, type: 'conte', title: 'Conte - Nouvelle-Zélande : Maui ralentit le soleil', text: 'Un conte de Nouvelle-Zélande : Maui ralentit le soleil.' },
    { id: 28, type: 'conte', title: 'Conte - Mali : L’hippopotame et les étoiles', text: 'Un conte du Mali : L’hippopotame et les étoiles.' },
    { id: 29, type: 'conte', title: 'Conte - Pologne : Le roi grenouille', text: 'Un conte de Pologne : Le roi grenouille.' },
  ];

  return {
    bonus,
    malus,
    surprise,
    contes,
    discardBonus: [],
    discardMalus: [],
    discardSurprise: [],
    discardContes: [],
  };
}
