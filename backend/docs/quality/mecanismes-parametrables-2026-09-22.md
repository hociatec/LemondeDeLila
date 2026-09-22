# Paramétrage des mécanismes — 22 septembre 2026

Cette intervention prolonge la séparation du noyau et du catalogue. Elle retire
des associations propres aux jeux dans trois programmes, sans annoncer que les
38 programmes sont maintenant génériques.

## Changements vérifiés

- Course : obstacles, contres, pouvoirs, activation, limites de déplacement,
  quotas indépendants, identifiants de statuts et motif de victoire viennent
  du bloc JSON `mechanics`. Les deux fichiers de constantes félines ont été
  supprimés. Aucun défaut thématique n'est conservé dans le code.
- Économie : les identifiants de variantes sont libres ; la variante par défaut
  peut être déclarée. Les anciens noms ne sont plus requis dans le programme
  ni son schéma.
- Collection : les catégories viennent du JSON ; les références sont validées.
  Le ciblage dépend des effets exécutables, plus du nom de l'action.

Les identifiants historiques du protocole sont conservés. Les règles de la
course gardent les mêmes valeurs et les mêmes statuts persistés. Le contenu
passe de 2 à 3 avec une migration explicite ; les tests restaurent les versions
TypeScript, 1 et 2 avec une ancienne empreinte de contenu.

## Validation

- `logs/mechanisms-regression.log` : 9 suites, **125 tests réussis**, incluant les
  trois jeux, le contenu canonique, les contrats communs du catalogue et la
  politique de versions.
- `logs/mechanisms-final-targeted.log` : 2 suites, **14 tests réussis** après
  renforcement du scénario générique jusqu'à sa victoire et correction d'une
  annotation TypeScript du test de collection. Ces tests sont une relance d'un
  sous-ensemble, pas 14 tests supplémentaires à additionner.
- `logs/mechanisms-typecheck.log` : typage sans erreur après correction.
- `logs/mechanisms-lint.log` : lint des programmes, schémas et tests modifiés.
  `logs/mechanisms-final-lint.log` couvre les deux tests renforcés ensuite.
- `logs/mechanisms-build.log` : compilation de 1 845 fichiers et chargement de
  l'AppModule réussis.
- `logs/mechanisms-quality.log` : chaîne `quality:check` réussie, incluant les
  audits d'architecture, de frontière moteur, de dépendances et de contrats.
- `logs/mechanisms-json-changes.json` : **120 des 122 JSON inchangés**, comparaison
  SHA-256 avec le relevé de la séparation initiale. Seuls le catalogue et le
  document de Cat Pattes changent.

Le lint a d'abord signalé du formatage, puis une variable utilisée seulement
comme type et une conversion implicite dans un test, corrigés. Le typage a
signalé une annotation générique de test, corrigée. Ces vérifications ont été
relancées avec succès. La suite complète de tout le backend n'a pas été relancée
pour cette étape ; les 2 559 tests du rapport précédent restent une preuve de
l'étape précédente, pas de celle-ci.

## Limite explicite

Le noyau reste indépendant des jeux. La bibliothèque extérieure contient
encore des spécialisations ; cette intervention ne clôture pas leur
généralisation. Voir les exemples restants et le contrat du bloc JSON dans
[la documentation des mécanismes](../architecture/parameterized-game-mechanisms.md).
