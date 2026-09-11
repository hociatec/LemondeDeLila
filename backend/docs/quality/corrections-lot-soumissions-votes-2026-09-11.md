# Lot : attente collective, vote et jugement — 11 septembre 2026

Ce lot clôture les points **132 et 133** du snapshot courant de `corriger.txt`.
Le backlog passe de **49 à 47 points ouverts**.

## 132 — Attente de tous les joueurs

La progression des soumissions est possédée par `GameSubmissionController` :
participants, réponses reçues, liste des joueurs attendus et clôture. Le
contrôleur de tours assure l'attente simultanée. Les jeux consomment ces
résultats pour déclencher leur transition de phase ; ils ne maintiennent pas
un deuxième compteur de soumissions.

- `completeWaiting` retourne désormais faux lorsqu'aucune attente n'est active.
  Répéter la clôture ne fait plus avancer le numéro de tour une seconde fois.
- Une session différente de celle attendue est refusée avant la vérification
  des réponses, même si cette autre session est encore incomplète.
- Réordonner les joueurs attendus exige une permutation sans doublon. Une
  entrée telle que `[-2, -2]` ne peut plus faire disparaître un autre participant.
- Corriger une soumission après clôture et avant révélation ne réémet plus
  `submission.closed`. La correction reste possible selon le contrat existant.

Les tests utilisent des joueurs humains et un bot à identifiant négatif, et
vérifient l'absence de mutation et d'événement lors d'un rejet.

## 133 — Vote et jugement standards

Le workflow standard repose sur `GameSubmissionFlowController`,
`GameVotingController` et `GameJudgeController`. La revue des jeux identifie
Nawak pour la collecte/votation, Les Absurdissimes et Gérard Président pour
les soumissions au juge. Le quiz utilise son propre kit générique de réponses.
Les transitions de phase et règles de score propres aux jeux restent déclarées
dans leurs règles.

- Nawak utilise désormais `voting.tally` pour compter les voix. Le jeu attribue
  le total obtenu à chaque joueur ; il ne recompte plus manuellement les votes.
  Les totaux sont inchangés, mais les événements d'ajout de score sont regroupés
  par destinataire. Le test de partie vérifie le score et le replay.
- Le dépouillement commun conserve son départage explicite par ordre des choix.
- Un juge initial inconnu est refusé avant modification de la rotation. Il
  n'est plus remplacé silencieusement par le premier joueur. La rotation des
  bots et joueurs suit l'ordre déclaré.

Les contrôles `every` encore rencontrés dans les règles concernent notamment
les chemins du plateau de Corridor et la composition de cartes, pas un stockage
parallèle des réponses attendues.

## Vérifications

- 7 suites, **49 tests réussis**, incluant les jeux concernés et le contrat des
  39 jeux.
- Régression finale : 3 suites, **36 tests réussis**, incluant les nouveaux
  invariants et les contrats de composition du moteur.
- TypeScript, lint ciblé, structure, architecture, moteur et audit de dette :
  réussis. Audit des séquences génériques : 252 fichiers examinés.
- Contrat SDK inchangé : 109 déclarations suivies.
- Build : 1 686 fichiers compilés ; module compilé chargé avec succès.
- Gouvernance du backlog validée avec 47 points ouverts.

Les ensembles se recoupent ; ils ne s'additionnent pas. Pas de déploiement,
de migration de données ni de relance de la suite complète du backend.
Les points de délais/fallback (131), d'ordre global (147) et de clôture de manche
déclarative (122) restent ouverts.
