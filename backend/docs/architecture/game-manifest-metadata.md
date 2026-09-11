# Métadonnées canoniques des jeux

`manifest.json` possède `code`, `name`, `summary`, `minPlayers` et `maxPlayers`.
Les 38 `game.ts` et `content.ts` importent ce fichier. Les champs de composition
et l'identifiant du contenu dérivent de ses propriétés ; ils ne recopient pas
leurs valeurs. Les versions de schéma, de règles et de contenu appartiennent
à leurs contrats respectifs et ne sont pas répétées dans le manifeste.

Le champ historique `engine` doit correspondre à `code` ; les alias
`board-mission` de Taxi et `la-grande-mine` de Barbak sont retirés.
Panier annonce six joueurs, conformément aux pions disponibles.

La génération du registre vérifie l'identité des packages, les doublons et la
présence de `rules.md` avant d'écrire le résultat. Le registre contient les
manifestes importés et les définitions compilées. La découverte vérifie leur
cohérence avant de construire les runtimes. Le registre applicatif applique
la même validation aux manifestes lus dans le catalogue installé : nom,
description, identifiants et limites doivent correspondre au runtime.

Cette composition produit aussi l'index JSON des emplacements du catalogue.
L'infrastructure lit uniquement les packages indexés, sans parcourir les dossiers
pour découvrir d'autres jeux. Sa racine par défaut appartient au package exécuté
et ne dépend pas du répertoire courant. `GAME_MODULES_ROOT`, vide par défaut,
permet de fournir explicitement une autre racine ayant la même disposition.

Les réglages administratifs restent une couche explicite de présentation et
de disponibilité. Les limites de joueurs peuvent restreindre la plage prise
en charge ; elles ne peuvent pas étendre les capacités du moteur. Les valeurs
non entières sont ignorées et les bornes publiées restent cohérentes.

Le générateur crée six fichiers : `game.ts`, `rules.ts`, `content.ts`,
`game.spec.ts`, `manifest.json` et `rules.md`. Ses six modèles sont compilés
contre le SDK réel et testés avec la génération du registre. Le fichier de
règles est un brouillon à compléter avant publication.

L'audit AST refuse la recopie des métadonnées dans les compositions, même
lorsque les valeurs copiées sont encore identiques. La validation à l'exécution
empêche une source de catalogue différente de présenter un jeu incompatible.
