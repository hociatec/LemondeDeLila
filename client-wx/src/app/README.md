# Architecture de `app`

`app` est la couche de composition de l'exécutable. Elle relie les modules sans
réimplémenter leur logique métier.

## Capacités

| Capacité | Responsabilité |
| --- | --- |
| `entrypoint` | Déclarer l'application wxWidgets. |
| `lifecycle` | Démarrer et arrêter les services et protéger le démarrage natif. |
| `navigation` | Composer les vues, gérer leur cycle de vie et les transitions. |

## Couches

- `domain` contient les identifiants et états sans dépendance wxWidgets.
- `presentation` contient les fenêtres, le focus et la composition des vues.
- `infrastructure` isole le code dépendant de la plateforme.

## Règles

- Aucun fichier source ne doit devenir un registre général de responsabilités.
- Une unité d'implémentation est découpée avant de dépasser 250 lignes.
- La création d'une vue reste séparée de sa navigation et de son cycle de vie.
- Les détails Windows ne doivent pas remonter dans la classe `Application`.
