# Découverte unique des packages de jeux

Point **620 clôturé et retiré** ; 276 points restent ouverts.

Validation : 3 suites ciblées / 13 tests réussis ; typage, lint, build/AppModule,
quality:check, verify:dist et contrôle du diff réussis. Les 38 packages compilés
et leurs règles sont retrouvés depuis le dossier temporaire système.
La dernière suite globale précédente comptait 230 suites / 887 tests réussis ;
elle n’est pas présentée comme une nouvelle exécution après cette correction.

La composition du build énumère les packages une seule fois. Elle produit le
registre des définitions/manifestes et un index JSON des emplacements destiné
au lecteur de catalogue. Le lecteur d'infrastructure parcourt cet index ; il
ne découvre plus récursivement les dossiers de jeux. Des dossiers supplémentaires
ne peuvent donc pas ajouter silencieusement un manifeste au catalogue.

La racine par défaut est relative au module exécuté : source en développement,
`dist/game/games` dans le package compilé. `GAME_MODULES_ROOT` reste une option
explicite pour remplacer cette racine, avec les mêmes emplacements indexés.
L'exemple de configuration laisse cette option vide. Un package indexé absent
ou une identité de manifeste remplacée produit une erreur explicite.

L'index est empaqueté par Nest avec les artefacts. Les tests vérifient la
génération à partir des six modèles, le refus des emplacements invalides et
des packages manquants, ainsi que l'ignorance des dossiers non indexés.
Le script `logs/check-installed-catalogue.cjs` vérifie les 38 jeux compilés
depuis un répertoire courant extérieur au projet.

L'audit interdit un second parcours de dossiers dans les couches de jeu hors
composition. Aucun changement de baseline ou de seuil de dette.
