# Déploiement local Linux avec `updatecmd`

`updatecmd` remplace le déploiement GitHub Actions pour le backend et le client
wx Windows. Le dossier source présent sur le serveur est la source de vérité :
la commande ne lance ni `git pull`, ni `git clone`, ni workflow distant.

## Installation initiale

Sur Debian/Ubuntu :

```bash
sudo ./updatecmd bootstrap
```

Le bootstrap installe MinGW, NSIS, osslsigncode et un CMake récent, puis prépare
vcpkg/wxWidgets et BASS dans `/var/cache/lemonde-de-lila/updatecmd`. Cette étape
unique peut être longue. Les builds normaux réutilisent ensuite les sources et
binaires déjà compilés. Le téléchargement vcpkg initial utilise une archive
versionnée, jamais un clone Git.

Les secrets GitHub ne sont pas exportables. Il faut donc importer une fois les
deux fichiers d'origine qui servaient déjà au workflow :

```bash
sudo tools/updatecmd/import-signing-secrets.sh \
  /chemin/wx-update-private.pem \
  /chemin/wx-codesign.pfx
```

Sur ce serveur la clé de manifeste existante a déjà été récupérée et vérifiée.
Il suffit donc d'importer le PFX Authenticode d'origine :

```bash
sudo tools/updatecmd/import-signing-secrets.sh /chemin/wx-codesign.pfx
```

Il est impératif de réutiliser la clé RSA et le PFX existants : les clients déjà
installés épinglent ces identités. Le bootstrap crée ou reprend automatiquement
le token privé de publication et le place à la fois dans `backend.env` et dans
le fichier consommé par `updatecmd`.

Vérifier ensuite la configuration :

```bash
sudo updatecmd doctor
```

La configuration privée se trouve dans
`/etc/lemonde-de-lila/updatecmd.conf`. L'environnement backend est conservé hors
de la source dans `/etc/lemonde-de-lila/backend.env`.

## Utilisation courante

Après avoir modifié ou synchronisé les fichiers locaux :

```bash
sudo updatecmd all
```

Mesures effectuées sur le serveur le 25 août 2026 : build WX complet depuis un
cache CMake vide en 2 min 22 s, déploiement backend compilé/testé en 12 s, et
commande backend sans changement en environ 1 s. Les empreintes backend et WX
sont distinctes : une modification du client ne redémarre donc pas le backend.

Commandes ciblées :

```bash
sudo updatecmd backend
sudo updatecmd wx
sudo updatecmd status
sudo updatecmd all --force
sudo updatecmd all --source /chemin/absolu/vers/lemondeDeLila
```

Le backend est copié dans une release isolée, puis `npm ci`, le build et les
tests sont exécutés pendant que l'ancienne release continue de servir. Les
migrations sont lancées avant une bascule de lien symbolique atomique. Après le
redémarrage, `/health/info` doit annoncer le hash SHA-256 local attendu et
`/health` doit confirmer que PostgreSQL et Redis sont disponibles. Sinon, le
lien et le service reviennent automatiquement à la release précédente.

Quand Redis local est protégé par `requirepass`, `updatecmd backend` et
`updatecmd all` synchronisent automatiquement ce secret dans les URL Redis de
`backend.env`, sans l'afficher. Une sauvegarde unique est conservée dans
`/etc/lemonde-de-lila/backend.env.pre-local-redis-auth`.

Les migrations doivent rester compatibles avec la version précédente : une
migration de base de données appliquée ne peut pas être annulée de façon sûre
par un simple rollback applicatif.

Le client wx est cross-compilé en Windows x64 sur Linux. Les exécutables et
l'installateur NSIS sont signés, l'archive est signée avec la clé de manifeste,
puis les deux fichiers sont envoyés par chunks à l'API backend locale. Le
numéro de version et la séquence restent strictement croissants, même après un
redémarrage.

Les workflows GitHub restent disponibles uniquement en déclenchement manuel de
secours. Ils ne partent plus automatiquement lors d'un push.

## Emplacements persistants

- releases backend : `/opt/lemonde-de-lila/releases`
- release active : `/opt/lemonde-de-lila/current`
- cache de build : `/var/cache/lemonde-de-lila/updatecmd`
- état des versions wx : `/var/lib/lemonde-de-lila/updatecmd`
- mises à jour publiées : `/var/lib/lemonde-de-lila/client-updates/client-wx`
- secrets : `/etc/lemonde-de-lila/secrets` (root uniquement)

Les cinq dernières releases backend sont conservées par défaut. Ce nombre est
configurable avec `BACKEND_KEEP_RELEASES`.
