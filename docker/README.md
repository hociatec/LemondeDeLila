# Environnement de développement conteneurisé

Ce dossier fournit une configuration Docker destinée à uniformiser l'environnement de travail
pour l'application « Le Monde de Lila ». Le conteneur principal regroupe les outils nécessaires
au back-end Symfony, au client Java et aux utilitaires front (Node/Yarn).

## Contenu des services

| Service    | Description                                                                                  |
|------------|----------------------------------------------------------------------------------------------|
| `app`      | Image de développement (PHP 8.2, Composer, Symfony CLI, OpenJDK 21, Maven, Node 18, Yarn).   |
| `database` | MySQL 8.0 pour les besoins du back-end.                                                      |

Les caches Maven/Composer sont montés dans des volumes Docker pour accélérer les compilations.

## Prérequis
- Docker Desktop lancé (ou le daemon Docker actif sous WSL2).
- Terminal avec droits suffisants (PowerShell/WSL en mode administrateur si besoin).

## Démarrage

Depuis la racine du dépôt :

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Cela démarre les conteneurs en tâche de fond. Le service `app` reste en attente (`sleep infinity`)
afin de servir de « dev shell ».

## Accéder au shell de développement

```bash
docker compose -f docker/docker-compose.dev.yml exec app bash
```

Toutes les commandes ci-dessous sont à lancer à l'intérieur du shell.

## Configuration Symfony

Dans le conteneur :

```bash
cd /workspace/backend
echo 'DATABASE_URL="mysql://lila:lila@database:3306/le_monde_de_lila?serverVersion=8.0.36&charset=utf8mb4"' > .env.local
composer install
symfony console doctrine:database:create --if-not-exists
symfony console doctrine:migrations:migrate --no-interaction
```

## Client Java

```bash
cd /workspace/java-client
mvn clean install
```

## Lancer les services applicatifs

```bash
# Toujours dans /workspace/backend
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
- Les variables d'environnement de la base peuvent être adaptées dans `docker/docker-compose.dev.yml`.
