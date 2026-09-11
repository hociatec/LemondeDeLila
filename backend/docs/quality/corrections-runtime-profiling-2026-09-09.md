# Profilage des parcours — 9 septembre 2026

Point 647 clôturé après profilage réussi, vérification syntaxique et quality:check.
Le fichier de travail conserve 252 points ouverts.

`npm run profile:game-replay -- gerard-president 65535 64` produit un profil CPU
V8 exploitable et un résumé JSON, après chargement des modules. L'outil vérifie
le jeu installé et les bornes des paramètres. Il ferme la session de profilage
même en cas d'échec et propage l'échec du parcours.

La première exécution réussit avec 64 commandes et cinq types d'action. Les
coûts principaux sont les copies d'état et la validation récursive des valeurs
sérialisables ; les comparaisons JSON du test sont identifiées séparément.
La charge, les durées et les limites de la mesure sont documentées dans
`docs/architecture/engine-performance.md`.

Preuves conservées : `logs/corrections-replay-profile.log`,
`logs/corrections-gerard-65535-64-profile.json` et
`logs/corrections-gerard-65535-64.cpuprofile`. Le profil localise un coût ; il ne clôture pas
les exigences 641–643 concernant les optimisations et allocations du moteur.
