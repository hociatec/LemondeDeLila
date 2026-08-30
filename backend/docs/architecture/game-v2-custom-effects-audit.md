# Audit des effects spécifiques — Game Engine V2

Statut : validé.

Les contenus peuvent déjà porter directement des séquences de
`GameEffectInstruction` et des recipes. Les neuf fichiers ci-dessous restent
car leurs resolvers appliquent au moins une règle de domaine, une transition ou
une sélection propre au jeu; ils ne sont pas de simples alias d'une primitive.

| Jeu                       | Justification du resolver spécifique                                |
| ------------------------- | ------------------------------------------------------------------- |
| Ça Dérape                 | boucliers de pénalité, cases spéciales, miroir et victoire de piste |
| Contes et Cacahuètes      | tirages par familles, cadeaux, abondance et règles de conte         |
| Panier Express            | résolution de stands, quiz et échange stratégique                   |
| Sac à Malices             | économie immobilière, infrastructure et déplacements nommés         |
| Voyage en Terre de Brumes | perte aléatoire, dernier joueur et ciblage différé                  |
| Cat'Pattes                | obstacles, parades, pouvoirs et fin conditionnelle de déplacement   |
| Entre Rites et Lumières   | collecte de familles, résurrection et cycle de l'aube               |
| Gérard Président          | jury, thèmes secrets, soumissions et cartes spéciales               |
| Grande Mine de Barbak     | domaines, trésors, défausse, effondrement et fin de mine            |

Les effets standards (`move`, `draw`, `discard`, ressources, score, status,
skip/extra turn) restent déclarés directement dans le contenu dès que leur
sémantique suffit. Le contrôle de type s'arrête à la sérialisation de
`custom.data`; après lookup, `defineEffect` parse le schéma et remet une donnée
typée au resolver.
