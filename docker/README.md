# Environnement de développement conteneurisé

Ce dossier fournit une configuration Docker destinée à uniformiser l'environnement de travail
pour l'application « Le Monde de Lila ». Le conteneur principal regroupe les outils nécessaires
au back-end Symfony, au client Java et aux utilitaires front (Node/Yarn).

## Contenu des services

| Service    | Description                                                                                  |
|------------|----------------------------------------------------------------------------------------------|
| `app`      | Image de développement (PHP 8.2, Composer, Symfony CLI, OpenJDK 21, Maven, Node 18, Yarn).   |
| `database` | PostgreSQL 16 pour les besoins du back-end.                                                  |

Les caches Maven/Composer sont montés dans des volumes Docker pour accélérer les compilations.

## Démarrage

Depuis la racine du dépôt :

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Cela démarre les conteneurs en tâche de fond. Le service `app` reste en attente (`sleep infinity`)
afin de servir de « dev shell ».

## Accéder au shell de développement

```bash
docker compose -f docker/docker-compose.dev.yml exec app bash
```

Toutes les commandes ci-dessous sont à lancer à l'intérieur du shell.

## Installation des dépendances

```bash
# Back-end Symfony
cd backend
composer install
symfony console doctrine:migrations:migrate --no-interaction

# Client Java
cd ../java-client
mvn clean install
```

## Lancer les services applicatifs

```bash
# Toujours dans backend/
symfony serve --no-tls --port=8000
```

Le serveur Symfony est exposé sur le port `8000` de l'hôte.

Pour relancer la base :

```bash
docker compose -f docker/docker-compose.dev.yml restart database
```

## Arrêt et nettoyage

```bash
docker compose -f docker/docker-compose.dev.yml down
```

Pour supprimer les volumes (cache Maven, Composer, base de données) ajoutez `-v`.

## Notes

- Le client Java est une application Swing : l'affichage graphique nécessite toujours l'environnement
  hôte (le conteneur sert au build, pas à l'exécution graphique).
- Les variables d'environnement de la base sont définies dans `docker/docker-compose.dev.yml`
  (`lila` / `lila`). Adaptez-les si nécessaire.
