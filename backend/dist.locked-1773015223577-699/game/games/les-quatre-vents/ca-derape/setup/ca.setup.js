"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CaSetupService", {
    enumerable: true,
    get: function() {
        return CaSetupService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let CaSetupService = class CaSetupService {
    hydrateInitialState(base) {
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        const lastRollByPlayer = {};
        const lastMoveDelta = {};
        const turnsSinceMoved = {};
        for (const p of players){
            positions[p.id] = 0;
            lastRollByPlayer[p.id] = 0;
            lastMoveDelta[p.id] = 0;
            turnsSinceMoved[p.id] = 0;
        }
        const meta = {
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
                nextPlayerDelta: null
            },
            decks: {
                cards: buildDeck(),
                discard: []
            },
            winnerId: null
        };
        return {
            ...base,
            phase: 'playing',
            pending: null,
            metadata: {
                ...base.metadata ?? {},
                ...meta
            }
        };
    }
};
CaSetupService = _ts_decorate([
    (0, _common.Injectable)()
], CaSetupService);
function buildTiles() {
    const tiles = [
        {
            label: 'Départ',
            description: "Les coureurs se tiennent prêts, le souffle chargé d'excitation.",
            isNeutral: true
        },
        {
            label: 'Petit Bosquet',
            description: 'Les feuilles frémissent, et un écureuil curieux vous observe.',
            isNeutral: false
        },
        {
            label: 'Case Neutre',
            description: 'Un moment pour respirer, admirer le ciel bleu.',
            isNeutral: true
        },
        {
            label: 'Petit Pont',
            description: 'Le bois craque doucement sous vos pas.',
            isNeutral: false
        },
        {
            label: 'Collines Dansantes',
            description: 'Les ondulations du terrain vous font sourire.',
            isNeutral: false
        },
        {
            label: 'Rivière Chantante',
            description: "L'eau clapote et semble vous encourager.",
            isNeutral: false
        },
        {
            label: 'Prairie Colorée',
            description: 'Des fleurs folles se balancent au rythme du vent.',
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: 'Rien à signaler, juste un souffle tranquille.',
            isNeutral: true
        },
        {
            label: 'Monticule Rigolo',
            description: 'Vous escaladez ce mini-tas sans glisser dans la boue.',
            isNeutral: false
        },
        {
            label: 'Forêt des Chuchotis',
            description: 'Les arbres semblent murmurer des secrets.',
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: "Le temps s'arrête un instant, profitez-en !",
            isNeutral: true
        },
        {
            label: 'Racine Taquine',
            description: 'Elle tente de vous faire trébucher, mais vous vous en sortez.',
            isNeutral: false
        },
        {
            label: 'Colline du Hérisson',
            description: "Il roucoule... ou c'est juste votre imagination ?",
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: 'Silence sauf le vent dans les branches.',
            isNeutral: true
        },
        {
            label: 'Tourbillon de Feuilles',
            description: 'Quelques feuilles tournoient autour de vous.',
            isNeutral: false
        },
        {
            label: 'Pont Suspendu',
            description: 'Vous avancez avec précaution, chaque pas compte.',
            isNeutral: false
        },
        {
            label: 'Petite Mare Mystérieuse',
            description: "On dirait qu'elle cache quelque chose.",
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: "Pause contemplative, le temps d'un souffle.",
            isNeutral: true
        },
        {
            label: 'Chemin des Fougères',
            description: 'Les frondes vous chatouillent les jambes.',
            isNeutral: false
        },
        {
            label: "Colline de l'Élan",
            description: "Vous sentez l'énergie vous pousser vers l'avant.",
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: "Juste un souffle d'air frais.",
            isNeutral: true
        },
        {
            label: 'Racine Souriante',
            description: "Elle s'incline comme pour vous saluer.",
            isNeutral: false
        },
        {
            label: 'Forêt des Murmures',
            description: 'Les oiseaux vous suivent du regard, curieux.',
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: 'Rien ne se passe, profitez du moment.',
            isNeutral: true
        },
        {
            label: 'Prairie des Papillons',
            description: 'Ils virevoltent autour de vous, légers et colorés.',
            isNeutral: false
        },
        {
            label: 'Monticule Secret',
            description: 'On dirait un passage oublié à explorer.',
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: 'Respirez, le parcours continue calmement.',
            isNeutral: true
        },
        {
            label: 'Pont des Échos',
            description: 'Chaque pas résonne, drôle et surprenant.',
            isNeutral: false
        },
        {
            label: 'Case détente',
            description: "La ligne d'arrivée se rapproche, le cœur s'emballe.",
            isNeutral: true
        },
        {
            label: 'Arrivée',
            description: "Bravo ! vous franchissez la ligne, acclamé par l'univers entier !",
            isNeutral: true
        }
    ];
    return tiles;
}
function buildDeck() {
    const cards = [];
    const push = (id, title, category, kind, text, moveDelta)=>cards.push({
            id,
            title,
            category,
            kind,
            text,
            moveDelta
        });
    const a = [
        [
            'Petit Coup de Chance',
            1,
            'Vous ressentez un léger souffle favorable. Avancez de 1 case.'
        ],
        [
            'Chaussures Lustrées',
            2,
            "Vos semelles glissent juste ce qu'il faut. Avancez de 2 cases."
        ],
        [
            'Pas Pressé mais Efficace',
            1,
            'Vous vous déplacez à votre rythme et ça marche. Avancez de 1 case.'
        ],
        [
            'Pas de Panique, ça Passe',
            2,
            'Vous tracez tranquillement. Avancez de 2 cases.'
        ],
        [
            'Vent dans le Dos',
            3,
            'Le vent vous pousse gentiment. Avancez de 3 cases.'
        ],
        [
            'Sourire Confiant',
            2,
            'Vous inspirez la fluidité. Avancez de 2 cases.'
        ],
        [
            'Accélération Modeste',
            3,
            "Rien d'extraordinaire, mais ça avance. Avancez de 3 cases."
        ],
        [
            'Gambettes Courageuses',
            2,
            'Vous avancez déterminé. Avancez de 2 cases.'
        ],
        [
            'Vous Trouvez le Bon Rythme',
            3,
            'Les choses sont simples. Avancez de 3 cases.'
        ],
        [
            'Vous vous Débrouillez Bien',
            1,
            'Pas de panique, vous gérez. Avancez de 1 case.'
        ],
        [
            'Vibration Positive',
            2,
            'Une bonne journée. Avancez de 2 cases.'
        ],
        [
            'En Avant, Toujours',
            3,
            'Pas de réflexion inutile... Avancez de 3 cases.'
        ]
    ];
    a.forEach(([title, delta, text], i)=>push(i + 1, title, 'a_avances_simples', 'move', text, delta));
    const b = [
        [
            'Turbo Improbable',
            5,
            'On ne sait pas pourquoi, mais vous foncez. Avancez de 5 cases.'
        ],
        [
            'Élan de Héros',
            6,
            "C'est beau. On applaudit. Avancez de 6 cases."
        ],
        [
            "Sprint de l'Inattendu",
            7,
            'Votre corps décide de réussir. Avancez de 7 cases.'
        ],
        [
            'Café Beaucoup Trop Fort',
            6,
            "L'effet est immédiat. Avancez de 6 cases."
        ],
        [
            'Chevauchée Triomphale Sans Cheval',
            8,
            'Vous simulez le cheval. Ça marche. Avancez de 8 cases.'
        ],
        [
            'Vous Volez Presque',
            5,
            "L'air vous soutient. Avancez de 5 cases."
        ],
        [
            'Coup de Génie du Genou',
            7,
            'Vos jambes prennent une décision audacieuse. Avancez de 7 cases.'
        ],
        [
            'Ligne Droite Parfaite',
            6,
            'Fluide, précis, imparable. Avancez de 6 cases.'
        ]
    ];
    b.forEach(([title, delta, text], i)=>push(13 + i, title, 'b_avances_spectaculaires', 'move', text, delta));
    const c = [
        [
            'Canard Philosophe',
            'skip',
            0,
            'Il faut écouter son discours. Passez un tour.'
        ],
        [
            'Glissade Élégante mais Contre-productive',
            'move',
            -2,
            'Vous glissez en beauté. Reculez de 2 cases.'
        ],
        [
            'Vous Oubliez ce que vous Faisiez',
            'skip',
            0,
            'Petit moment de vide. Passez un tour.'
        ],
        [
            "Chaussures à l'Envers",
            'move',
            -1,
            'Cela gêne un peu. Reculez de 1 case.'
        ],
        [
            'Vous Cherchez votre Élan',
            'skip',
            0,
            'Ça viendra. Passez un tour.'
        ],
        [
            'Doute Existentialo-Sportif',
            'move',
            -3,
            'Est-ce vraiment une bonne idée ? Reculez de 3 cases.'
        ],
        [
            "Vous Perdez l'Équilibre",
            'move',
            -2,
            'Rien de grave, mais bon. Reculez de 2 cases.'
        ],
        [
            'Piqûre de Mouette (Symbolique)',
            'move',
            -1,
            'Vous prenez ça personnellement. Reculez de 1 case.'
        ],
        [
            'Bourrasque Fripouille',
            'move',
            -3,
            "Le vent n'est pas votre ami aujourd'hui. Reculez de 3 cases."
        ],
        [
            "Vous Félicitez Quelqu'un pour Rien",
            'move',
            -1,
            'Ça ralentit. Reculez de 1 case.'
        ],
        [
            'Vous vous enlacez vous-Même',
            'skip',
            0,
            "C'est bien, mais le temps passe. Passez un tour."
        ],
        [
            'Vous Faites Demi-Tour par Erreur',
            'move',
            -4,
            'Vous revenez à votre précédent emplacement. Reculez de 4 cases.'
        ]
    ];
    c.forEach(([title, kind, delta, text], i)=>push(21 + i, title, 'c_reculs', kind, text, kind === 'move' ? delta : undefined));
    const dEntries = [
        [
            'Raccourci Secret',
            'rule',
            'Vous passez devant le joueur en tête. Vous prenez la première place.'
        ],
        [
            'Chemin des Cactus Sympathiques',
            'rule',
            'Ils vous ouvrent la voie. Avancez de 4 cases et ignorez la prochaine pénalité.',
            4
        ],
        [
            'Saute-Mouton',
            'rule',
            'Vous bondissez par-dessus le joueur devant vous. Vous le faites reculer de 1 case.'
        ],
        [
            'Saut Quantique Non Prévu',
            'rule',
            "La physique applaudit. Avancez jusqu'à la prochaine case multiple de 5."
        ],
        [
            'Chemin de Traverse',
            'rule',
            'Vous prenez un passage oublié. Avancez de 3 cases et rejouez.',
            3
        ],
        [
            'Trompe-lʼŒil du Décor',
            'swap',
            'Vous apparaissez plus loin que prévu. Avancez de 2 cases et échangez votre position avec un joueur de votre choix.',
            2
        ],
        [
            'Trappe Bienveillante',
            'move',
            'On vous transporte plus loin, sans explication. Avancez de 5 cases.',
            5
        ],
        [
            'Virage à 90° Trop Efficace',
            'move',
            'Vous coupez net. Avancez de 3 cases.',
            3
        ]
    ];
    dEntries.forEach(([title, kind, text, delta], index)=>push(33 + index, title, 'd_special', kind, text, delta));
    const chaos = [
        [
            "La Trompette de l'Univers",
            'global',
            'Tous les joueurs changent de place au hasard. Mélangez toutes les positions.'
        ],
        [
            'Course en File Indienne',
            'global',
            "Le dernier devient premier. Inverser l'ordre du classement."
        ],
        [
            'Pause Hydratation Collective',
            'global',
            'Personne ne se déplace ce tour-ci. Tour commun perdu.'
        ],
        [
            'Concours de Fières Postures',
            'global',
            'Chacun avance dignement. Tout le monde avance de 1 case.'
        ],
        [
            'Le Sol Est Un Peu Trop Élastique',
            'global',
            'Le sol penche dangereusement en arrière. Tout le monde recule de 2 cases.'
        ],
        [
            'Brise de Sérénité',
            'neutral',
            "Rien n'arrive. Absolument rien. Aucun effet."
        ],
        [
            'Appel du Koala Intérieur',
            'global',
            'Tout le monde se repose. Tout le monde passe un tour.'
        ],
        [
            'Applaudissements Inattendus',
            'global',
            'Ça motive tout le monde. Tout le monde avance de 1 case.'
        ],
        [
            'Brouhaha Inexplicable',
            'global',
            'Tous les joueurs échangent leur place avec celui juste derrière lui. Décalage général !'
        ],
        [
            'La Danse des Mollets Heureux',
            'global',
            'Bonne humeur générale. Tout le monde relance le dé.'
        ]
    ];
    chaos.forEach(([title, kind, text], i)=>push(41 + i, title, 'e_chaos', kind, text));
    const f = [
        'Si vous êtes en tête, vous reculez de 2 cases. Sinon vous avancez de 2.',
        'Si vous êtes dernier, avancez de 3 cases. Sinon, rien ne se passe.',
        'Si vous venez de reculer, avancez de 3 cases. Sinon rien.',
        "Si vous devez passer un tour, vous l'annulez.",
        'Si vous êtes sur une case multiple de 5, avancez de 4 cases. Sinon reculez de 1.',
        "Si vous n'avez pas bougé depuis 2 tours, avancez de 5 cases.",
        "Si vous êtes à égalité avec quelqu'un, avancez tous les deux de 2 cases.",
        'Rejouez immédiatement votre tour !',
        "Si vous arrivez juste derrière quelqu'un, rejoignez-le.",
        "Si vous dépassez un joueur d'une case ce tour-ci, avancez encore de 1."
    ];
    f.forEach((text, i)=>push(51 + i, 'Condition ' + (i + 1), 'f_conditionnel', 'conditional', text));
    const g = [
        'Vous devez lancer le dé deux fois, et avancer le total obtenu.',
        'Piochez une carte au hasard.',
        'Votre prochain déplacement est doublé.',
        'Reculez de 3 cases puis avancez de 2.',
        'Votre prochain recul est ignoré.',
        'Avancez de 3 cases puis reculez de 1.',
        'Choisissez qui joue après vous ce tour-ci.',
        'Vous décidez si le prochain joueur recule ou avance de 1.',
        'Votre prochain lancer de dé compte double.',
        'Choisissez un joueur : Votre prochain lancer de dé devient égal au sien.'
    ];
    g.forEach((text, i)=>push(61 + i, 'Règle idiote ' + (i + 1), 'g_regles', 'rule', text));
    const h = [
        'La Brise Chante. Même le vent a mis ses chaussettes rigolotes ce matin.',
        'Un Oiseau Observe la Course. Il a parié sur vous, ou pas on ne sait jamais.',
        'Le Sol Ouvre un Souvenir. Attention, il pourrait se rappeler de vos étranges pensées !',
        "Une Clochette Lointaine. On dirait qu'un chat joue de la trompette au loin.",
        'Le Monde Vous Regarde avec Tendresse. Il rit un peu de vos chaussettes dépareillées.',
        "Une Vague d'Optimisme Passe. Elle porte des lunettes de soleil et un sourire géant.",
        'Les Montagnes Encouragent Silencieusement. Elles hochent la tête comme des grands sages possédés.',
        "Un Souffle de Forêt Vous Entoure. Il sent l'herbe, la mousse et un peu de biscuits disparus.",
        'La Course Est Belle, Tout Simplement. Même les escargots applaudissent avec leurs antennes.',
        'Moment de Paix entre Deux Pas. Silence sauf si un lapin fait du breakdance !'
    ];
    h.forEach((text, i)=>push(71 + i, 'Ambiance ' + (i + 1), 'h_ambiance', 'neutral', text));
    return cards;
}
