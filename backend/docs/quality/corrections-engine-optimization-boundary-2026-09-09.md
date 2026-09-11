# Frontière des optimisations du moteur

Les points 648, 649 et 650 sont clôturés sur le périmètre des 38 jeux installés.

- La préparation des champs, options et sous-parseurs appartient aux fabriques
  de schémas du runtime. Elle n'ajoute aucune branche conditionnée par un jeu.
  Les définitions compilées capturent les composants, règles et priorités.
- Les jeux importent uniquement le SDK public et leurs fichiers locaux. L'audit
  suit imports, réexports, imports de types et auxiliaires ; un import dynamique
  non statique est refusé. Le contexte auteur ne donne pas accès au stockage ni
  aux méthodes privées d'orchestration. Les tests négatifs vérifient ces frontières.
- Les optimisations de parsing n'ajoutent aucun paramètre, mode rapide ni option
  de cache à l'API auteur. Les signatures sont contrôlées par la référence SDK ;
  les évolutions 5.0/5.1 sont documentées séparément et ne résultent pas des
  optimisations. Les règles continuent à utiliser les mêmes fabriques de schémas.

Le microbenchmark et ses limites sont consignés dans
[corrections-schema-compilation-2026-09-09.md](corrections-schema-compilation-2026-09-09.md).
La politique de modification est dans
[engine-performance.md](../architecture/engine-performance.md).

Validation actuelle : 27 tests d'audits/générateurs, audit des jeux sans violation,
contrat SDK, typage, lint et quality:check réussis. Les 266 suites / 1 193 tests
passent. La campagne antérieure de 152 parcours / 7 087 commandes compare les
résultats déterministes ; elle ne constitue pas une mesure de débit serveur.
Les points 641–643 sur les coûts et allocations restants restent ouverts.
