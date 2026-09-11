# Parcours rejoués des jeux — 9 septembre 2026

Point 58 clôturé après validation des parcours et contrôles communs.
Le fichier de travail conserve 248 points ouverts.

L'ancien test all-games.scenario-coverage sautait son parcours quand MySQL était
absent. Son registre était en outre remplacé par un mock vide, et il ne vérifiait
pas qu'un jeu avait été découvert. Il ne constituait donc pas une preuve de
parcours des jeux installés. Une copie est conservée dans
logs/all-games.scenario-coverage-before-20260909.ts.

Le remplacement charge le registre réel généré, exige une découverte non vide
et autant de définitions que de packages. Pour chaque jeu, quatre seeds
(0, 1, 17, 65535) pilotent jusqu'à 64 commandes. Une seconde instance du runtime
reçoit les mêmes commandes et les mêmes instants. Les représentations JSON des
états et des vues doivent coïncider ; chaque état rejoué traverse un aller-retour
JSON avant la commande suivante. Les états sources ne doivent pas être mutés
par l'énumération, l'exécution ou les projections. Aucun serveur DB n'est requis.

Les premières campagnes ont révélé plusieurs défauts corrigés :

- Les horloges explicites étaient utilisées à l'exécution, mais perdues lors de
  certaines validations, énumérations et projections. Le contexte d'exécution
  est maintenant transmis explicitement à ces chemins, y compris aux candidats
  de bots et aux lectures du GameTestKit. La même échéance gouverne le refus
  avant expiration et l'acceptation à l'échéance.
- Les données auteur d'un choix partageaient l'objet des métadonnées moteur.
  Des champs comme kind étaient écrasés, empêchant certaines résolutions de
  Ça Dérape et Contes et Cacahuètes. Elles résident désormais dans
  continuationData, sont conservées après résolution et restent séparées du
  prochain choix de la file. Cette continuation interne est retirée de la vue
  publique du pending. Les choix multiples annoncent une sélection minimale
  valide, au lieu d'une liste vide lorsque leur minimum est positif.
- Les échanges de cartes objets comparaient des copies par référence. Le
  contrôleur compare maintenant les identités persistées ; la campagne ciblée
  de Gérard Président passe. Voir corrections-card-exchanges-2026-09-09.md.
- La Bande à Banane répétait une défausse en lisant toujours la longueur d'une
  ancienne copie de main : une fois la main vide, la boucle ne finissait jamais.
  La Grande Mine de Barbak réutilisait la dernière carte d'une copie et refusait
  sa seconde défausse. Les parcours ciblés ont reproduit ces deux défauts puis
  passent après remplacement par une itération bornée sur les cartes en excès.
  Le test limite les appels aux défausses afin de signaler la régression sans
  bloquer le processus de tests. Journaux : corrections-hand-limit-{before,after}.log.
- Le contrôle global des dés refusait certaines politiques autorisées par le
  contrôleur. Voir corrections-dice-validity-2026-09-09.md.
- Le bonus de capture de Zig et Zag relisait la première carte d'une ancienne
  copie de main. Il parcourt maintenant les cartes à transférer une seule fois.
  La régression avec la graine zéro échoue avant correction et passe ensuite,
  avec conservation des 54 cartes et replay de la partie persistée.

Les snapshots anciens sans continuationData gardent le lecteur de données à
plat. Un champ auteur déjà écrasé dans un ancien snapshot ne peut pas être
reconstitué de manière générale : cette correction ne prétend pas migrer des
données disparues. Les nouvelles écritures utilisent uniquement la continuation
séparée, sans dupliquer l'état auteur dans deux emplacements.

Validation des parcours : **38 jeux, 152 campagnes, 7 087 commandes logiques
rejouées**. 65 campagnes terminent la partie ; 87 atteignent les 64 commandes
prévues. Aucune ne s'arrête prématurément sans action disponible. Une pause
entre deux questions de Mnémosyne fait avancer l'horloge de test jusqu'à la
prochaine échéance, puis l'énumération reprend. Ce comportement est vérifié
sur les quatre graines ; seul ce jeu déclare des timers sans action.

La campagne générale valide 37 jeux et révèle l'erreur de Zig et Zag. Après
correction, les quatre graines de Zig et Zag et les quatre parcours étendus
de Mnémosyne passent séparément. Le rapprochement vérifie exactement quatre
graines distinctes par jeu dans logs/corrections-replay-validated-results.json.
Les journaux d'échec sont conservés. Contrôles communs réussis : 259 suites / 1 129 tests hors
campagne longue, typage, lint, build/AppModule, quality:check et verify:dist. Ces parcours ne prouvent pas l'exploration exhaustive de toutes
les branches ni l'absence de tout bug.

La campagne antérieure a été interrompue dans sa boucle infinie, après
vérification du PID et de sa ligne de commande ; son journal n'est pas un
résultat global réussi. La nouvelle campagne écrit chaque début et fin de
graine dans logs/game-replay-progress.ndjson. Son journal est
logs/corrections-replay-final-campaigns.log.

Preuves : logs/corrections-replay-{regressions,clock-regressions,three-games,all-campaigns}.log
et logs/game-replay-campaign-results.json.
