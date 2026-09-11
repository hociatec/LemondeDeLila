# Suite du traitement des 56 points

## Clôtures vérifiées

- **31 — identité du contenu sauvegardé** : une empreinte SHA-256 calculée à
  compilation est inscrite dans le snapshot. Réutiliser le même numéro de
  version avec un contenu différent provoque un rejet avant exécution. Les
  migrations explicites restent possibles et ne modifient pas le snapshot
  source. Une migration d'algorithme ne peut pas substituer cette empreinte.
- **181 — propriétaire unique des tables** : le registre de composition
  couvre toutes les entités exactement une fois ; le test vérifie aussi
  l'unicité des noms de tables explicites et le placement des fichiers dans
  leur domaine propriétaire. Le registre et son test restent sous
  `src/app/database`, pas à la racine de `src`.

Le backlog passe de 56 à **54 points ouverts**.

## Avancées sur les points encore ouverts

- **19, 121 et 148** : la primitive `thresholdVictory` décrit les seuils de
  score/ressources et leur sélection des gagnants. Le schéma JSON accepte ces
  politiques et rejette les noms inconnus. Le compilateur JSON, Olympia et
  Nawak l'utilisent ; leurs politiques d'égalité et le moment de résolution
  sont préservés. Les autres conditions standard restent à examiner.
- **143** : l'audit des règles interdit les références aux capacités réseau
  globales, timers, microtasks, promesses, fonctions asynchrones et accès aux
  objets globaux. Il reconnaît les alias d'accès global et distingue les
  symboles locaux/importés (notamment le sélecteur `self`) et les propriétés
  de contenu. Les tests d'intégration peuvent rester asynchrones. Ce contrôle
  statique n'est pas un sandbox de code hostile ni un audit complet des I/O
  cross-domain ; le point reste ouvert.
- **191** : la primitive de seuil a trois usages réels ; le calcul
  d'empreinte répond au contrat fondamental de restauration.

## Compatibilité

Le contrat de déclarations SDK passe à **6.1**, avec 81 exports publics et
109 fichiers de déclarations suivis. Les deux nouveaux exports sont
`thresholdVictory` et `ThresholdVictory`. Les références et leur version ont
été mises à jour ensemble.

**Les anciennes sauvegardes sans empreinte sont refusées**, sauf migration
de contenu explicite vers une version différente. Conserver leur ancien
runtime/contenu ou préparer une migration vérifiée avant déploiement. Aucun
snapshot persistant n'a été modifié pendant cette passe.

Voir [le contrat de restauration et de victoire](../architecture/content-identity-and-threshold-victory.md).

## Vérifications locales

- Suite complète : **288 suites, 1 386 tests réussis**, aucune régression.
- Restauration, empreinte, migrations et runtime : 47 tests réussis.
- Victoires et contrat des 39 jeux : 75 tests réussis.
- Schéma JSON enrichi et propriété des tables : 37 tests réussis.
- Audit des règles : 26 tests Node réussis après ajout des garde-fous.
- Contrat SDK, graphes et architecture moteur : 38 tests Node réussis avant
  les deux nouveaux tests des garde-fous.
- TypeScript, lint ciblé, structure, architecture, placement, séparation du
  runtime et contrat SDK : réussis.
- Build : 1 677 fichiers compilés ; AppModule compilé chargé avec succès.

Ces ensembles de tests se recoupent ; leurs totaux ne doivent pas être
additionnés comme un nombre de tests distincts. Aucun déploiement ni test
contre les services de production n'a été effectué.
