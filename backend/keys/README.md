Ce dossier ne doit pas contenir de cles versionnees.

- Genere les cles localement avec `tools/jwt/generate-rsa-keys.sh`.
- Garde `jwt-private.pem` hors Git.
- Si tu dois distribuer une cle publique au client, fais-le via un secret de build ou un artefact de release, pas via le depot.
