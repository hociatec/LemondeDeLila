# Architecture de `bootstrap`

`bootstrap` est la racine de composition. Il construit les implémentations,
ordonne leur démarrage puis transmet les dépendances à `app`.

## Capacités

| Capacité | Responsabilité |
| --- | --- |
| `lifecycle/application` | Piloter le démarrage et exposer l'étape courante. |
| `runtime/application` | Ordonner les compositions et créer le navigateur. |
| `composition/application` | Définir le contrat de suivi des étapes. |
| `composition/infrastructure` | Construire les graphes concrets par domaine. |

## Règles

- Chaque domaine possède sa propre composition et son propre header.
- Aucun header global ne regroupe toutes les dépendances de l'exécutable.
- Les implémentations concrètes, notamment WinHTTP, restent dans
  `composition/infrastructure`.
- Une unité d'implémentation est découpée avant de dépasser 250 lignes.
