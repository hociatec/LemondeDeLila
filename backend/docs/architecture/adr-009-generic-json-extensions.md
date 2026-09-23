# ADR-009 — Entrée générique des extensions JSON

Date : 2026-09-23. Statut : accepté.

Les composants, actions, effets et phases restent le premier choix pour composer
un jeu. Les programmes historiques comportent encore des contrats spécifiques ;
leur transport à la racine oblige chaque ajout à modifier la forme du document.
Une unique clé `extensions` remplace cette croissance structurelle pour les
nouveaux documents : `[{ "type": "nomDuContrat", "config": { ... } }]`.

Le catalogue construit une union discriminée fermée. Un type inconnu, une config
invalide, un champ supplémentaire ou un doublon est refusé. Sans catalogue,
seule une liste vide est autorisée. `extensions` est réservé et ne peut pas
être enregistré comme nom de contrat.

Après validation, le parseur normalise les entrées vers la représentation interne
historique. Les deux écritures produisent donc les mêmes données compilées et
empreintes de contenu ; les anciens documents restent compatibles. Une entrée
présente aussi à la racine est refusée, sans priorité implicite. Les diagnostics
de schéma utilisent le chemin du document reçu.

Cette syntaxe ne rend pas les programmes composables par elle-même : le contrôle
actuel d'un programme de jeu par définition reste actif. La composition de
plusieurs gestionnaires demande encore le travail des points 6 et 11. Les
consommateurs TypeScript internes continuent à recevoir le document normalisé.

Migration du catalogue : les 38 documents specialises sont migres vers
extensions; le 39e reste une composition des primitives. Le schema public ne
publie plus aucune racine de pack. Un schema de compatibilite interne conserve
la lecture des anciennes sources et des donnees normalisees. La gouvernance
refuse toute nouvelle source de production utilisant une racine historique.
Les tests historiques reconstruisent explicitement leur ancienne forme, tandis
que les contrats des 39 jeux compilent les sources de production migrees. Les
deux transports ont la meme empreinte mecanique pour l'audit de reutilisation.

Composition effective du catalogue : sept cartes de Ca Derape utilisent
desormais les primitives conditional/has-status/remove-status/skip-turn,
add-status et extra-turn. Quatre comportements ne dependent donc plus de
resolutions specialisees dans le nouveau contenu. La version de contenu passe
de 2 a 3. Les anciens handlers restent disponibles pour les contenus historiques
et leurs rejeux. Aucune nouvelle primitive ni cle de pack n'a ete ajoutee.

directional-hazard-primitives-parity.spec.ts compare chaque carte a son ancien
handler dans deux situations (avec et sans bouclier), puis rejoue chaque partie.
Seules l'empreinte du contenu et l'identite d'une restauration independante sont
exclues de la comparaison entre sessions. Le test compare tout l'etat de jeu,
les files d'effets, les evenements en attente, le hasard et les tours.
Il fait partie de engine:merge-contracts. La decomposition complete des packs
et la composition de plusieurs programmes restent du ressort du point 6.
