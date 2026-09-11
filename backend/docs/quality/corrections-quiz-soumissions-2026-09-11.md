# Quiz et soumissions — 11 septembre 2026

Cette passe poursuit les points 156 et 157 sur les projections imbriquées,
ainsi que le suivi générique des participants du point 132. Le backlog conserve
52 points ouverts : ces corrections ne constituent pas un audit complet de
toutes les projections ou de tous les workflows.

Les questions de quiz sont désormais construites avec les seuls champs `id`,
`prompt` et `choices`. Cette règle s'applique à la projection des kits et aux
résultats `next` et `ask` du contrôleur. Un champ ajouté au contenu, par exemple
une explication révélant la réponse, n'est plus transmis automatiquement.
Les choix sont copiés afin que le résultat ne conserve pas de référence vers
le catalogue. La réponse correcte reste publiée par le contrat de session
lors de la révélation, sans modifier les règles de score.

La projection des soumissions conserve désormais les identifiants négatifs des
bots dans les listes des participants, des réponses reçues et des réponses
attendues. Elle conserve le filtrage des identifiants nuls ou non sûrs. Les
valeurs secrètes restent accessibles à leur propriétaire uniquement jusqu'à
la révélation ; les spectateurs voient la progression sans les réponses.

Les tests couvrent les champs de quiz supplémentaires, les deux résultats du
contrôleur, la copie des choix, la révélation, les participants bots et humains,
les spectateurs et l'absence de mutation des soumissions internes.

Validation : première passe de 3 suites et 48 tests réussis, dont le contrat
des 39 jeux. Les tests ciblés sont ensuite relancés avec la couverture des
résultats du contrôleur. Audits de structure et moteur réussis ; contrat SDK
inchangé avec 109 déclarations suivies. Pas de migration ni de déploiement.

Vérification finale : 2 suites et 9 tests ciblés réussis ; TypeScript et lint
ciblé réussis. Build de 1 684 fichiers et chargement du module compilé réussis.
Les ensembles se recoupent et ne doivent pas être additionnés. La suite complète
du backend n'a pas été relancée pendant cette passe.
