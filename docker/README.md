# Environnement de dÃ©veloppement conteneurisÃ©

Ce dossier fournit une configuration Docker destinÃ©e Ã  uniformiser l'environnement de travail
pour l'application Â« Les mondes de Lilas Â». Le conteneur principal regroupe les outils nÃ©cessaires
au back-end Symfony, au client Java et aux utilitaires front (Node/Yarn).

## Contenu des services

| Service    | Description                                                                                  |
|------------|----------------------------------------------------------------------------------------------|
| `app`      | Image de dÃ©veloppement (PHP 8.2, Composer, Symfony CLI, OpenJDK 21, Maven, Node 18, Yarn).   |
| `database` | MySQL 8.0 pour les besoins du back-end.                                                      |

Les caches Maven/Composer sont montÃ©s dans des volumes Docker pour accÃ©lÃ©rer les compilations.

## PrÃ©requis
- Docker Desktop lancÃ© (ou le daemon Docker actif sous WSL2).
- Terminal avec droits suffisants (PowerShell/WSL en mode administrateur si besoin).

## DÃ©marrage

Depuis la racine du dÃ©pÃ´t :

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Cela dÃ©marre les conteneurs en tÃ¢che de fond. Le service `app` reste en attente (`sleep infinity`)
afin de servir de Â« dev shell Â».

## AccÃ©der au shell de dÃ©veloppement

```bash
docker compose -f docker/docker-compose.dev.yml exec app bash
```

Toutes les commandes ci-dessous sont Ã  lancer Ã  l'intÃ©rieur du shell.

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

Le serveur Symfony est exposÃ© sur le port `8000` de l'hÃ´te.

Pour relancer la base :

```bash
docker compose -f docker/docker-compose.dev.yml restart database
```

## ArrÃªt et nettoyage

```bash
docker compose -f docker/docker-compose.dev.yml down
```

Pour supprimer les volumes (cache Maven, Composer, base de donnÃ©es) ajoutez `-v`.

## Notes

- Le client Java est une application Swing : l'affichage graphique nÃ©cessite toujours l'environnement
  hÃ´te (le conteneur sert au build, pas Ã  l'exÃ©cution graphique).
- Les variables d'environnement de la base peuvent Ãªtre adaptÃ©es dans `docker/docker-compose.dev.yml`.

