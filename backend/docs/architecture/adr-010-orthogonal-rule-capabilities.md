# ADR-010 — Capacites independantes des compositions de jeux

Date : 2026-09-23.

Les packs restent des compositions metier classees `game-specific`. Les capacites
independantes utilisent les composants du moteur ou des recettes sans identite
de jeu. Extraire une capacite ne promeut pas son pack d'origine.

| Capacite | Implementation independante | Composition metier restante |
| --- | --- | --- |
| Propriete | `GameOwnershipController` | Groupes immobiliers, hypotheques, liquidations |
| Transaction | `GameResourcesController.transfer`, `GameEconomyController` | Politique de loyer, echange et prix |
| Variation et plancher d'un solde | `rules/recipes/resource-settlement.ts` | La faillite et la victoire du dernier joueur solvable restent dans le pack immobilier |
| Cout de protection et priorite | `rules/recipes/protection-cost.ts` | Avance de la cape narrative, perte de tour de la course |
| Deplacement et depassement | `GameMovementController` | Effets particuliers de chaque case |
| Detection de collision | `rules/recipes/track-collision.ts` | Recul du pion rencontre, recul du joueur ou avance partagee, selon le pack |
| Resolution de case | `resolveLanding`, `moveAndResolve` | La resolution des cartes de course est separee dans `directional-hazard-landing.ts` |
| Statut temporaire | `GameStatusController` et instructions `add-status`, `remove-status` | Noms et consequences declares par le jeu |
| Branchement et selection | Instructions `conditional`, `choice`, cibles et recettes de selection | Regles narratives, options et textes declares par le jeu |
| Pioche et resolution | `drawEvent`, `drawAndResolve`, file d'effets | Effets propres aux cartes |
| Victoire | Evaluateurs standard, mode de course `external` | Victoires internes des compositions non promues |

`settleResourceDelta` n'elimine personne et ne manipule aucune propriete : il
applique une variation, notifie le changement, remet le solde au plancher puis
delegue le deficit. L'ordre conserve celui du pack immobilier, y compris la
contribution au pot avant la faillite. La logique d'insolvabilite est isolee.

`consumeFirstProtection` essaie les couts dans l'ordre et consomme uniquement le
premier disponible. Il ne connait ni cape, ni bouclier, ni deplacement. Le pack
narratif choisit sa priorite statut/ressource/statut et applique l'avance seulement
pour le premier cas. Le pack de course choisit un statut et decide de la penalite.

`independent-capabilities.spec.ts` compose ces deux recettes dans une expedition
sans extension : abri a usage unique, provision puis energie. Un deficit augmente
la fatigue au lieu d'eliminer le joueur. L'autre joueur reste intact et le rejeu
reproduit l'etat. Les tests unitaires couvrent solde exact, deficit, gain, plancher
negatif, priorites et ressources insuffisantes. Les contrats de course et les tests
des packs conservent les regles historiques.

La detection de collision est partagee par les courses directionnelle,
bidirectionnelle et a quiz. Elle conserve l'ordre des joueurs et leur inclusion
historique, exclut le joueur deplace et lit uniquement la piste demandee. Elle
ne deplace personne. Les effets de collision restent chez leurs proprietaires.

Les compositions narratives et immobilieres ne sont pas declarees generiques.
Les objectifs alternatifs refusés et les couplages restants sont documentes dans
`docs/quality/second-game-catalogue.md`. Aucun nouveau pack, aucune nouvelle cle
du DSL, aucun changement de contrat reseau ou de snapshot n'est necessaire.
