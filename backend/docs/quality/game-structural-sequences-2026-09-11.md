# Audit des séquences structurelles des jeux — 11 septembre 2026

L’audit porte sur les 33 jeux qui contiennent encore du TypeScript : 197 fichiers et 1364 fonctions/callbacks avant extraction. Il complète le contrôle des clones par tokens normalisés. Il parcourt l’AST TypeScript, extrait les appels aux capacités moteur et cherche des séquences de 3 à 6 appels partagées par au moins deux jeux, en conservant les branches et l’ordre des appels. Les noms locaux, valeurs littérales et messages intercalés ne masquent pas une ressemblance. Chaque callback est examiné séparément.

Ce sont des candidats à examiner : l’audit ne prouve pas l’équivalence métier et ne suit pas les alias dynamiques, les appels indirects ou les branches exécutées. Il ne constitue pas un contrôle exhaustif de toutes les équivalences possibles. Les points 1, 3, 5, 8 et 11 suivent encore les migrations/extractions, distinctes de cet inventaire.

| Famille repérée | Jeux | Décision après lecture |
| --- | --- | --- |
| Distribution avec cartes écartées puis remises au-dessus | Entre Rites et Lumières ; Les Mains de la Terre | Même séquence, seule la sélection des cartes et la taille de main diffèrent. Extraite vers cards.hands.initialDeferredCardIds ; deux setup-rules.ts supprimés. Six sous-séquences disparaissent. |
| Complément de main par pioche/recyclage | Cercles Sacrés ; Gérard Président | Boucles supprimées : les quatre sites utilisent cards.drawManyToHand avec déficit de main et recyclage. Six traces antérieures conservées, 32 tests réussis (logs/json134-refill-parity.json). |
| Consommer une continuation puis terminer le tour si aucun choix ne reste | En Attendant Minuit ; Mission Galaxie ; Sac à Malices ; Voyage en Terre de Brumes | Cycle commun déjà fondé sur choice/turn.complete, mais résolution interne différente (quiz, achat, échange). Conserver les validations métier, poursuivre la déclaration des continuations (points 8/11). |
| Lire et réécrire un compteur | Sac à Malices ; Voyage en Terre de Brumes | Ressemblance syntaxique : collecte d’un pot contre décompte d’arrivée avec classement. Aucune extraction commune de ces fonctions entières. |
| Piocher puis garder ou défausser selon catégorie | Dame Nature ; Grande Mine de Barbak | Squelette commun, mais Dame Nature déclenche aussi pollution/victoire. Ne pas supprimer ces règles ; déclaration des effets et filtres à poursuivre (points 3/6/11). |

Après extraction : 195 fichiers, 1362 fonctions, 4 séquences candidates restantes. Les cinq tests de l’outil couvrent le renommage, les valeurs distinctes, les messages intercalés, l’ordre, les branches, les callbacks et les entrées invalides. Ils sont intégrés à game:metrics:test, exécuté par quality:check. Commande de reproduction : npm run game:generic-sequences:audit.

Jeux examinés : a-fond-les-ballons, arche-de-mnemosyne, ca-derape, cat-pattes, cercles-sacres, contes-et-cacahuetes, corridor, dame-nature, en-attendant-minuit, entre-rites-et-lumieres, foulees-fantastiques, frousse-party, galopons-ensemble, gerard-president, jeu-oie, la-bande-a-banane, la-grande-mine-de-barbak, la-parade-sucree, lama, le-marche-des-merveilles, les-mains-de-la-terre, mission-galaxie, mon-village-mon-histoire, nawak, olympia, pimp-my-ride, pirates-en-vadrouille, primalis, sac-a-malices, taxi-express, tout-pres-de-maman, voyage-en-terre-de-brumes, zig-et-zag.

Rapports détaillés avec fichiers et lignes : logs/json134-structural-sequences.json et logs/json134-structural-sequences-after.json.
