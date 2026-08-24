# Architecture de `shared`

`shared` contient uniquement les capacités techniques utilisées par plusieurs modules. Une logique métier propre à une fonctionnalité doit rester dans `src/modules/<module>`.

## Règles de dépendance

1. `domain` contient les modèles, politiques et valeurs sans dépendance vers wxWidgets ou Windows.
2. `application` orchestre un cas d'usage partagé et dépend du domaine ou d'interfaces.
3. `infrastructure` contient les accès au système, au réseau, aux fichiers et aux bibliothèques natives.
4. `presentation` contient les contrôles wxWidgets, le focus, les textes et le thème.
5. Une capacité n'a pas de dossier vide : seules les couches réellement nécessaires sont créées.
6. Aucun ancien chemin d'inclusion n'est conservé au moyen d'un en-tête relais.
7. Un fichier d'implémentation dépassant environ 250 lignes doit être séparé par responsabilité.

## Responsabilités

| Capacité | Structure | Responsabilité |
| --- | --- | --- |
| `accessibility` | `application`, `presentation` | Plans et transitions de focus, navigation clavier, adaptateurs accessibles wxWidgets. |
| `cache` | `application` | Déduplication et partage des chargements concurrents. |
| `concurrency` | `application` | Pool de workers, priorités, annulation et tâches asynchrones. |
| `config` | `domain`, `generated`, `infrastructure` | Valeurs de configuration, métadonnées générées et chemins locaux. |
| `data` | `json`, `time` | Lecture JSON défensive et conversions de dates. |
| `domain` | `identifiers` | Identifiants fortement typés communs aux modules. |
| `errors` | `domain`, `catalog`, `presentation` | Erreur structurée, messages stables et formatage destiné à l'utilisateur. |
| `logging` | `application`, `infrastructure` | API de journalisation et sortie de diagnostic vers la plateforme. |
| `network` | `domain`, `application`, `infrastructure` | Politiques et messages, protocole temps réel, transports HTTP/WebSocket WinHTTP. |
| `persistence` | `infrastructure` | Écriture atomique et stockage JSON local. |
| `security` | `domain`, `infrastructure` | Charge utile JWT et primitives cryptographiques Windows. |
| `text` | `domain`, `presentation/encoding`, `presentation/catalog`, `presentation/status` | Opérations de chaînes pures, conversion wxWidgets, catalogue de textes UI et libellés d'état. |
| `ui` | `application`, `presentation` | Adaptation des tâches à l'UI, contrôles, navigation visuelle et thème. |

## Découpage des composants volumineux

- `NavigationController.cpp` contient les algorithmes; `NavigationBindings.cpp` contient les liaisons wxWidgets.
- `BackgroundExecutor.cpp` contient le pool de workers; `BackgroundTasks.cpp` contient l'installation et les tâches annulables.
- `VerticalMenu` est séparé entre état public, disposition, événements, entrées et contrôle d'entrée.
- `AccessibleListBox` sépare la lecture de l'arbre accessible des actions et de la configuration.
