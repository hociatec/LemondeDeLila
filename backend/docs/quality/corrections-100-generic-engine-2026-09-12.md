# Clôture des 100 points sur la généricité du moteur

Statut : **100 points traités et vérifiés**.

| Points | Correction et preuve                                                                                                                                                                                                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–43   | Les 45 fichiers de recettes, effets et helpers portant un nom de jeu ont quitté `runtime/recipes/gameplay`. Ce dossier contient désormais uniquement 20 primitives génériques sur liste blanche. Toute logique unique réside dans une extension explicitement classée et justifiée.                                               |
| 44–47  | Gérard, Cat Pattes, Contes et Sac composent les contrats et capacités communs du moteur ; leurs workflows résiduels sont encapsulés dans leurs modules d'extension respectifs au lieu d'être exposés comme recettes génériques.                                                                                                   |
| 48–50  | Les contrats réutilisables et mono-consommateur ont des marqueurs distincts. Le catalogue donne à chaque profil spécifique une justification mécanique et l'audit bloque toute hausse des plafonds de dette.                                                                                                                      |
| 51–63  | Les packs d'effets JSON, les schémas et les compilateurs sont dérivés d'un registre statique et figé. Chaque `effect-pack.ts` possède schéma, compilation, actions, handlers et validation. Le noyau central n'a plus de table ni de branche par jeu. Le registre n'utilise ni découverte de fichiers, ni import dynamique, ni I/O. |
| 64–69  | Les paquets JSON restent modulaires et leurs références sont validées à la compilation. Le garde existant limite chaque `game.json` à 301 lignes.                                                                                                                                                                                 |
| 70–77  | Le test global du graphe TypeScript et le garde zéro TypeScript dans `game/games/**` sont bloquants. La gouvernance recalcule et publie `extension → consommateurs`, exige une justification, distingue les profils réutilisables et refuse une croissance non revue.                                                             |
| 78–83  | Les gardes existants maintiennent le DSL fermé, les textes inertes, la compilation préalable du JSON et la sérialisabilité des contrats.                                                                                                                                                                                          |
| 84–89  | Les invariants existants maintiennent les définitions figées, les versions, migrations, rétention de contenu, snapshots validés et jobs restaurés.                                                                                                                                                                                |
| 90–99  | Les audits et tests existants maintiennent la convergence, le RNG moteur, l'ordre déterministe, l'atomicité, les frontières des effets externes, les projections, les API, l'absence de doubles casts et l'horloge métier injectée.                                                                                               |
| 100    | La dette résiduelle est maintenant bornée, visible et isolée dans les extensions. Les nouveaux jeux utilisant les capacités existantes restent 100 % JSON ; toute nouvelle mécanique doit passer la revue automatique du registre et du catalogue.                                                                                |

La preuve comportementale couvre les 39 jeux déclaratifs. Le test du registre
vérifie ses 38 clés, leur ordre, leur unicité, leur immutabilité et le contrat de
contribution complet. Les audits `runtime:separation:audit`,
`engine:effects:audit`, `game-engine:audit`, `architecture:test`,
`invariants:audit`, le typecheck, le lint et les suites Jest valident ensemble la
clôture avant suppression de `corriger.txt`.
