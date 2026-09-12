# Pipeline indépendant des contenus

Le binaire backend et le contenu éditorial ont des cycles distincts. Le backend
charge normalement son contenu embarqué. Lorsque `LILA_CONTENT_RELEASE_DIR`
pointe vers une release, chaque jeu présent dans son manifeste charge le payload
externe avant de passer par le même schéma métier que le contenu embarqué.

Une release est immuable. Son manifeste `lila.content-release` version 1 associe
chaque jeu à un JSON, un SHA-256 et une `contentVersion` égale au SHA-256. Un
checksum incorrect, un chemin sortant de la release, une version de manifeste
inconnue ou un payload rejeté par le runtime bloque la publication ou le
démarrage.

Le répertoire de releases est un stockage historique, pas un cache. La commande
de publication crée une release par écriture exclusive et ne supprime aucune
ancienne version ; rollback ne fait que déplacer le lien atomique `current`.
Il n'existe volontairement aucune commande de purge. La sauvegarde du répertoire
complet fait partie du déploiement. Une release ne peut être retirée qu'après
une requête d'exploitation prouvant qu'aucune ligne active de `game_sessions`
ni aucun snapshot Vault ne référence une de ses `contentVersion`. En l'absence
de cette preuve, elle est conservée.

Les migrations déclarées dans `snapshotMigrations` sont des données statiques
du paquet, exécutées sans horloge, réseau, base de données ni état global. Leur
source et leur destination sont explicites et le chargeur ne cherche jamais une
conversion selon la version courante du serveur.

## Publication

Après construction initiale du backend, exporter une base éditable :

```bash
npm run content:export -- /srv/lila-content/work
```

Les éditeurs modifient uniquement `work/games/*.json`. La publication valide les
JSON avec le binaire déjà installé, crée une release adressée par son checksum et
bascule atomiquement le lien `current` :

```bash
npm run content:publish -- /srv/lila-content/work /var/lib/lemonde-de-lila/content-releases
```

Le service utilise
`LILA_CONTENT_RELEASE_DIR=/var/lib/lemonde-de-lila/content-releases/current`.
Un redémarrage recharge la nouvelle release sans reconstruction du backend.

## Rollback

```bash
npm run content:rollback -- /var/lib/lemonde-de-lila/content-releases RELEASE_ID
```

Le lien `current` revient atomiquement sur la release immuable indiquée, puis le
service est redémarré. Les sessions dont la `contentVersion` diffère restent
rejetées : aucun état en cours n'est silencieusement interprété avec un autre
contenu.
