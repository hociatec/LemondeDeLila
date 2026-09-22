# Paramétrage des modules restants — 22 septembre 2026

Les associations fixes relevées dans les modules de règles ont été remplacées
par des paramètres et des opérations déclarés dans les contenus. La revue
couvre les [38 modules](../architecture/game-mechanism-review.md) ; le contrat
et les limites sont décrits dans
[les mécanismes paramétrables](../architecture/parameterized-game-mechanisms.md).

## Changements vérifiés

- Catégories de collections, régions, faces de dés et types de cases libres.
- Correspondances entre cartes spéciales et opérations génériques explicites.
- Distances, seuils, protections, tailles de mains, règles de classement,
  progression des pions et échanges entre familles configurables.
- Continuations de questions associées à leur véritable pioche ; compatibilité
  des anciennes continuations via une pioche de repli déclarée.
- Nombre de réponses variable pour le vote anonyme.
- Protocole des effets directionnels déplacé dans son module extérieur au noyau.
- Migrations de contenu conservant les identifiants persistés des cartes,
  effets, statuts et choix.

Deux oublis de paramétrage ont été corrigés pendant la revue : le déplacement
conditionnel restait fixé à 1 et un calcul de palier utilisait encore 5.
Les tests exécutent désormais des distances et paliers différents pour éviter
ces régressions. Une référence de ressource absente dans un jeton est également
refusée à la compilation. La dernière revue a aussi évité un événement de
variation de ressource sans effet lorsqu'une perte cible un solde nul ; un test
vérifie le journal et le replay de ce cas.

## Preuves

| Contrôle | Résultat | Trace dans `backend/logs/` |
| --- | --- | --- |
| Jeux, modules, parité et nouvelles variantes | 58 suites, 256 tests réussis | `remaining-mechanisms-game-regression.log` |
| Nouveaux tests ciblés, inclus dans la ligne précédente | 3 suites, 53 tests réussis | `remaining-mechanisms-final-targeted.log` |
| Dernière correction des pertes sur solde nul | 3 suites, 14 tests réussis, dont un nouveau test | `remaining-mechanisms-final-resource.log` |
| Reconfiguration du catalogue | 39 jeux compilés sous une autre identité ; 16 profils modifiés par les variantes ; replay jusqu'à 8 commandes | `parameterized-catalog.spec.ts` dans la régression |
| Typage complet | Réussi | `remaining-mechanisms-typecheck.log` |
| Lint complet et contrôle final des derniers fichiers modifiés | Réussis | `remaining-mechanisms-lint.log`, `remaining-mechanisms-lint-final.log` |
| Build et chargement d'AppModule | Réussis, 1 848 fichiers compilés | `remaining-mechanisms-build.log` |
| Qualité globale | Réussie | `remaining-mechanisms-quality.log` |
| Frontière moteur | 220 fichiers ; aucune dépendance interdite ni référence à un jeu | contrôle `engine:boundary:audit` dans la qualité globale |
| SDK public | 111 fichiers de déclarations inchangés | contrôle `sdk:contract` dans la qualité globale |
| Structure | Aucune nouvelle dette ni aggravation | `remaining-mechanisms-structure.log` |
| Gouvernance des modules | 38 modules, aucun import d'implémentation entre modules | `remaining-mechanisms-governance.log` |

La suite complète initiale a exécuté 437 suites et 2 574 tests : 436 suites
et 2 573 tests ont réussi, et une campagne a échoué sur une version intermédiaire
du module de collection en course (`isDeckKind` retiré avant le remplacement
complet de son appel). La correction était déjà présente sur disque, mais cette
exécution avait chargé l'ancien module. Le journal original est conservé dans
`remaining-mechanisms-full-tests.log` et porte donc un code de sortie 1.

La campagne concernée a été relancée avec succès sur la correction, pour ses
quatre graines : `remaining-mechanisms-pirates-replay.log`. Les 38 autres jeux
avaient réussi leur campagne complète. Cela couvre 156 simulations au total,
avec un plafond de 64 commandes par simulation ; ce plafond n'implique pas
que toutes les parties soient terminées.

Les trois nouveaux fichiers de tests, absents de la découverte initiale de Jest,
ajoutent 54 tests distincts. Le bilan consolidé est donc de **440 suites et
2 628 tests validés après relances ciblées**, sans échec observé restant. Ce
nombre ne décrit pas une unique exécution complète terminée avec un code 0.
Les 256 tests de régression des jeux incluent des tests de la suite complète
et ne sont pas additionnés une seconde fois.

Après la dernière correction, les 14 tests ciblés, le typage, le lint des
fichiers concernés, le build, le chargement applicatif et les audits de structure
et de frontière ont été revérifiés. La qualité globale était déjà verte ; les
budgets de structure et les interfaces n'ont pas changé avec cette correction.

Les budgets de lignes ont été réévalués explicitement après revue des
descripteurs configurables : 1 201 lignes de contrats et 13 583 lignes de
production, dont 13 507 hors métadonnées. La limite de 13 500 octets par fichier
reste inchangée. La fonction qui dépassait la limite de longueur a été divisée,
sans relever cette limite.

## Compatibilité et portée

Le relevé SHA-256 comparé à l'état précédant la séparation trouve 106 JSON
identiques sur 122. Les 39 manifestes sont inchangés. Les modifications portent
sur 15 documents de jeu et sur le contenu de la course à obstacles déjà modifié
lors de l'étape précédente. Le détail est enregistré dans
`remaining-mechanisms-json-changes.json`.

Les tests de reconfiguration prouvent des comportements et des parcours précis,
pas une couverture exhaustive de toutes les combinaisons de données. Les
programmes restent des familles de mécanismes et un document active un seul
programme complet. Une mécanique inédite peut nécessiter une nouvelle opération
générique ; le noyau n'a pas à connaître l'identité du jeu qui l'utilise.
