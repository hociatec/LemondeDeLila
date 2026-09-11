# Contenu statique et sauvegardes — point 123

Les catalogues de cartes identifiées sont enregistrés dans les contrôleurs
reconstruits depuis la définition. Les pioches, défausses, mains et zones
persistées contiennent les identifiants ; les méthodes de lecture réhydratent
les valeurs depuis le catalogue. Les sessions de quiz conservent la banque,
l'identifiant de question, les réponses et leur phase. Elles reconstruisent
la question à la lecture. Les pistes conservent les positions, les grilles
leurs cellules et murs occupés, sans copie des définitions de plateaux.

Les six états auteur encore présents dans les 38 jeux conservent des données de
progression ou d'historique : notamment identifiants de défis, cartes jouées et
indices des voitures terminées. Leurs libellés/descriptions sont reconstruits
dans les vues. Les effets d'une carte en cours de résolution peuvent rester
dans la continuation : il s'agit du travail restant à exécuter, pas d'une copie
de tout le catalogue. Les contenus restent identifiés par leur version de partie.

Le contrôle des contrats de tous les jeux vérifie maintenant les références
persistées à la mise en place et après commande, sur huit graines par jeu.
Il refuse les objets de catalogue dans les quatre stockages de cartes, les
questions réhydratées et les catalogues attachés à l'état moteur. Cinq tests
négatifs prouvent ces refus. Cette garde vise les jeux installés, qui utilisent
des cartes sans état mutable par exemplaire ; l'introduction d'instances
mutables demandera un contrat de persistance explicite et une adaptation du test.

Validation : quatre suites / 53 tests ciblés réussis, typage, lint des fichiers
modifiés et contrôle qualité structurel réussis. Journaux
`logs/corrections-content-storage-*.log`. Les corrections des fixtures de test
ont été revérifiées séparément : cinq tests réussis. Le runtime n'est pas modifié.
Les points 120–122 restent ouverts : l'absence de catalogues copiés ne prouve pas
encore la nécessité de chaque autre champ de progression ou d'historique.
