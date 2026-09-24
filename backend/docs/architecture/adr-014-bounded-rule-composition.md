# Composition bornée des règles — API auteur 10, extension 2

La liste du 24 septembre demande des calculs, sélections et victoires composables. Les primitives existantes ne permettent pas de calculer un montant à partir de l'état sans callback TypeScript. L'ajout utilise les instructions, conditions et composants existants ; aucun champ racine métier n'est ajouté au JSON.

Les montants de gain/perte/transfert de ressources et de score acceptent désormais un nombre ou une expression typée. Les lectures autorisées portent uniquement sur les contrôleurs canoniques. L'évaluation est déterministe, sans hasard, accès arbitraire à des propriétés, boucle ou fonction utilisateur. Elle rejette les divisions par zéro, résultats non finis, dépassements numériques, plus de 256 nœuds ou plus de 16 niveaux.

Les prédicats des sélecteurs et des victoires évaluent chaque candidat localement. Les choix interactifs et les cibles aléatoires y sont interdits. Propriétaires et occupants se composent à partir des conditions de propriété et de position : ils ne nécessitent pas de nouvel algorithme métier.

Les ressources bornées sont des composants `resource.pool`. Les bornes restent dans la définition ; les valeurs restent exclusivement dans `playerValues.resources`. Les paiements séparent devis, mutation et décision d'élimination. Les politiques disponibles sont `cancel`, `debt`, `partial`, `eliminate`. Les bornes explicites restent applicables, y compris à une politique de dette.

## Migration

Les patterns `trigger` écoutent une action ou un événement connu, filtrent ses champs scalaires et exécutent les primitives existantes. Le moteur conserve l'ordre déterministe, limite les exécutions à 256 et les événements à 512, et annule la commande entière en cas de cycle. Une pile séparée préserve les choix en cours ; les effets interactifs sont interdits dans ces déclencheurs.

Les statuts peuvent porter une source, des charges et des catégories de protection. Une interception consomme une charge avant la mutation ; l'expiration par tour reste indépendante. Les déplacements de cartes utilisent les conteneurs canoniques et valident les deux extrémités avant toute mutation. L'événement `card.moved` masque l'identité de la carte lorsque les deux conteneurs sont privés.

La recette `resourceDeltaEffects`, extérieure au runtime, remplace des boucles dans La parade sucrée et Primalis. Leurs politiques respectives de dette et de paiement partiel sont préservées. Cette extraction ne promeut aucun des 38 packs spécifiques.

Les contenus utilisant des montants numériques continuent de fonctionner. Les intégrations qui lisent `instruction.amount` doivent désormais discriminer `typeof amount === 'number'` avant leur propre présentation arithmétique. Les unions de conditions, cibles, composants et victoires comportent de nouvelles variantes : mettre à jour les `switch` exhaustifs. Cette évolution justifie une version majeure de l'API auteur (10.0.0) et des contrats d'extension (2.0.0), avec comparaison des déclarations transitive conservée.

L'absence d'option `insufficient` conserve le rejet historique d'une perte impossible. Une politique `cancel` explicite annule seulement le paiement. `allowPartial` reste accepté pour les anciens contenus. Une définition de ressource n'est nécessaire que pour préciser ses bornes et sa valeur initiale.

Les snapshots des six rejeux historiques restent inchangés. Le corpus s'étend à tous les jeux, sur trois graines communes, avec comparaison de l'état, des commandes et des restaurations. Les snapshots supplémentaires doivent être revus puis vérifiés sans option de mise à jour.
