# Essais de second jeu des 38 effect-packs

Chaque essai conserve le TypeScript du pack et son contrat de configuration.
Il remplace l'objectif terminal par dix manches suivies d'un classement des scores.
Ce changement de condition de fin constitue une difference mecanique, et non un renommage.
Les configurations sources sont clonees a partir du catalogue charge et valide.

Preuve executable : `second-game-catalogue.spec.ts`, executee par `engine:merge-contracts`.
La matrice est exhaustive sur les cles du registre, au typage et a l'execution.

37 contrats refusent cet objectif sur `game.json.victory.kind`. Le 38e,
`chainedTileRace`, compile, mais le test d'execution atteint sa case de fin
et observe une victoire prematuree. Le rejeu reproduit cette fin.
Ces echecs justifient le maintien des 38 compositions dans `game-specific`.
Ils ne signifient pas qu'aucun autre jeu ne peut employer ces contrats.

Exception documentee : `directionalHazardRace` refuse l'objectif avec son mode
historique, mais son mode explicite `external` permet deja le rallye a trois
points de controle. `directional-hazard-reuse.spec.ts` execute ce second jeu et
son temoin a primitives jusqu'a la victoire avec rejeu. Cela ne promeut pas le pack entier.

| Contrat | Second jeu essaye |
| --- | --- |
| pawnRace | Relais de pions : classement apres dix manches, sans victoire au retour du dernier pion. |
| eventRace | Expedition chronometree : classement des ressources apres dix manches, sans victoire a l'arrivee. |
| deliveryRace | Tournee de livraison : classement des livraisons apres dix manches, sans seuil de fin immediat. |
| gooseRace | Randonnee a etapes : classement de distance apres dix manches, sans fin sur la derniere case. |
| trackZoneCollection | Recolte saisonniere : comparer les collections apres dix manches, sans fin de parcours. |
| resourceTrackRace | Exploration de duree fixe : classement des ressources apres dix manches, sans objectif de piste. |
| treasureTrackRace | Chasse chronometree : classement des tresors apres dix manches, sans collection terminale. |
| parade | Defile de duree fixe : classement apres dix manches, sans epuisement terminal du paquet. |
| familyRequest | Bibliotheque : demandes de familles pendant dix manches, classement sans attendre toutes les familles. |
| carAssembly | Atelier : classement des assemblages apres dix manches, sans fin au premier assemblage. |
| marketExchange | Foire saisonniere : classement apres dix manches, sans objectif commercial terminal. |
| pairedPawnRace | Relais cooperatif par paires : classement apres dix manches, sans victoire de rencontre. |
| cardCircles | Exposition : classement des cercles apres dix manches, sans victoire de collection complete. |
| publicDomainCards | Musee : classement des collections apres dix manches, sans victoire au catalogue complet. |
| protectedHauntedRace | Patrouille : classement des survivants apres dix manches, sans sortie terminale. |
| bidirectionalCollisionRace | Joute : collisions pendant dix manches, classement sans victoire d'arrivee. |
| familyEffects | Echanges saisonniers : classement des familles apres dix manches, sans victoire de collection complete. |
| teamPawnRace | Capture en equipe : classement apres dix manches, sans retour terminal des pions. |
| quizEventRace | Rallye de questions : classement apres dix manches, sans victoire a l'arrivee. |
| bounceQuizRace | Tournoi de rebonds : classement apres dix manches, sans fin sur la case objectif. |
| speciesTroops | Reserve naturelle : classement des troupes apres dix manches, sans completion terminale. |
| directionalHazardRace | Rallye : trois points de controle sur un circuit ferme au lieu d'une arrivee terminale. |
| chainedTileRace | Circuit a reactions : dix manches de cases enchainees, sans fin sur l'ancienne arrivee. |
| chapterEncounter | Chroniques : classement des rencontres apres dix manches, sans chapitre terminal. |
| pawScoring | Decathlon : classement apres dix manches simultanees, sans premier joueur au seuil. |
| themeNameCards | Festival : classement apres dix manches de noms et themes, sans epuisement terminal. |
| ritualPhases | Calendrier : classement apres dix manches rituelles, sans seuil de lumiere terminal. |
| propertyEconomy | Urbanisme : classement apres dix manches de transactions, sans dernier joueur solvable. |
| anonymousVote | Conseil : classement apres dix votes, sans seuil de victoire anticipee. |
| sharedPrestigeCards | Academie : classement apres dix manches, sans seuil de prestige terminal. |
| battleTies | Championnat : dix manches de batailles, sans capture terminale du paquet. |
| simultaneousQuiz | Examen : dix manches simultanees, sans victoire au seuil de bonnes reponses. |
| pathWalls | Siege : classement apres dix manches de murs et deplacements, sans arrivee terminale. |
| storyChallenge | Anthologie : dix manches de branches narratives, sans case de fin terminale. |
| discardPenaltyCards | Tournoi de defausse : dix manches, sans sortie terminale au seuil de penalite. |
| judgedCards | Concours : dix manches jugees, sans premier joueur au seuil de points. |
| grid | Mosaique : dix manches de placements, sans victoire immediate par alignement. |
| board | Expedition de plateau : dix manches de deplacements et echanges, sans objectif terminal de piste. |
