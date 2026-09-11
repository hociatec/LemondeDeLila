# Passe sur les points restants du 11 septembre 2026

Cette passe ne clôture pas tout le backlog. Les points ci-dessous ont été
confrontés au code et aux tests actuels ; les autres restent dans `corriger.txt`.
Les numéros désignent les libellés présents au début de cette passe, et non
ceux des anciens rapports dont la numérotation diffère.

## Points clôturés

| Point | Garantie et preuve |
| --- | --- |
| 29 | Les snapshots portent les versions de schéma, règles, contenu et algorithme. Le chargeur exige une compatibilité explicite, applique les migrations sur une copie et rejette les versions incompatibles. Tests `game-state-loader.spec.ts`, `engine-snapshot-migrations.spec.ts`, `content-snapshot-migrations.spec.ts`. Cela permet de reconnaître et migrer un format ; cela ne promet pas d'exécuter une version future sans son runtime. |
| 167 | Les releases de contenu sont vérifiées par SHA-256 ; leur version doit correspondre au hash. Les updates disposent également de contrôles d'intégrité et de signature. Tests `external-content-release.spec.ts`, `wx-update-release.service.spec.ts`. Le manifest de contenu rejette maintenant aussi les champs inconnus et les identifiants invalides. |
| 169 | Les journaux structurés et textuels passent par les sanitizers. Tests `log-sanitizer.spec.ts`, `validate-environment.spec.ts` et audit des frontières des logs. |
| 170 | Les valeurs distinctes des labels sont plafonnées pendant toute la vie du registre : 256 types WS/routes, 16 ressources/files, puis une valeur de repli. Les dimensions d'erreur du moteur réutilisent la même primitive. Tests sur 300 valeurs entrantes et 2 000 erreurs moteur ; la longueur seule ne suffisait pas. |
| 172 | L'arrêt ferme les admissions, arrête les sources, attend les mutations, ferme les sockets, attend leurs écritures de déconnexion, puis ferme les ressources. Tests du coordinateur, de l'arrêt WebSocket et des requêtes HTTP abandonnées, plus `operability-audit`. |
| 176 | Les refresh tokens sont indexés par digest, expirent, sont révoquables et l'ancien token est consommé atomiquement avant rotation. Tests `redis-refresh-token.service.spec.ts`. |
| 177 | La validation de production impose les secrets et dépendances nécessaires, rejette les placeholders et les configurations permissives. Tests `environment-validation.spec.ts` et `validate-environment.spec.ts`. |
| 192 | L'audit compare les structures de fonctions après normalisation des identifiants et signale la duplication dès un second jeu. Les séquences d'appels sont aussi recensées pour revue. Tests des outils de duplication et métriques ; aucun groupe détecté dans les 39 jeux. Ce contrôle ne prouve pas l'absence de toute similarité conceptuelle. |
| 193 | Le rapport mesure chaque jeu et calcule `declarativeShare`, hors assets de contenu. `game.json` compte désormais comme programme déclaratif. Le ratio reste un indicateur par catégorie de fichier, pas une preuve de pureté déclarative. Un écart de croissance est attendu pour Course des étoiles à cause de cette correction de classement. |

## Corrections supplémentaires

- Les huit écarts de taille de fichiers/fonctions détectés au départ sont
  supprimés sans élargir les seuils ni ajouter de baseline. La composition
  des définitions et le calcul de version de contenu ont leurs fichiers ;
  les validateurs distinguent les unions, scalaires et réactions. La
  persistance du journal reste dans la transaction CAS existante.
- `joinRoom` ne duplique plus le traitement du participant déjà présent.
- L'audit WebSocket utilise le service de profil actuel. Six nouveaux tests
  vérifient identité authentifiée, cible distincte, accès privé et rôle admin
  côté serveur. Ils ne suffisent pas à clôturer à eux seuls toute
  l'autorisation métier des points 173 et 174.
- Le kit Inventory rejette les échanges invalides avant modification :
  échanger un objet avec lui-même conserve cet objet, et un inventaire inconnu
  ne crée plus d'état résiduel lors d'un swap. Trois tests couvrent ces cas.
- Panier Express délègue au kit son contrôle de possession avant échange et
  partage la résolution des pioches événements/échanges. Il conserve cinq
  effets spécifiques et 1 195 lignes TypeScript spécifiques ; le point 112
  reste ouvert.
- Le test de rechargement de tous les contenus vérifie un registre non vide
  avec identifiants uniques au lieu d'imposer un nombre figé de 38 jeux.
- Les capacités du plan sont résolues uniquement depuis les propriétés
  propres des catalogues. Le graphe interdit également les dépendances
  d'exécution vers le compilateur du plan et la composition des définitions.

## Limites toujours ouvertes

Le schéma JSON ne couvre pas encore toutes les mécaniques de Panier Express.
Les versions de contenu explicitement déclarées et la disponibilité d'anciens
contenus demandent encore une solution complète pour le point 31. Les
garanties cross-domain de livraison, la revue exhaustive des projections et
les passes finales après les refactors restent au backlog.

Les vérifications de cette passe sont locales. Aucun déploiement ni test
d'intégration contre des services de production n'a été effectué.

## Validation

- Suite complète après les extractions : 283 suites, 1 363 tests réussis.
- Vérification des dernières modifications : 12 suites, 78 tests réussis.
- TypeScript sans émission et lint ciblé : réussis.
- Build : 1 673 fichiers compilés ; chargement de l'AppModule compilé réussi.
- Architecture, structure, sécurité, placement, séparation du runtime : OK.
- Contrat SDK inchangé : 108 fichiers de déclarations.
- Tests Node des métriques, de la duplication et du graphe : 12 réussis.
- Bilan : 65 points au départ, 9 clôturés, 56 encore ouverts.
