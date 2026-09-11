# Nettoyage après erreur — point 347

Les écritures atomiques asynchrones nettoient leur fichier de préparation même
si la fermeture du descripteur échoue. La voie synchrone poursuit la suppression
si une seconde fermeture échoue pendant le nettoyage, et conserve l'erreur
d'origine. La destination précédemment publiée n'est jamais supprimée.

L'initialisation d'un upload WX retire le nouveau dossier si les métadonnées
ne peuvent pas être écrites. La finalisation ferme le descripteur puis tente
indépendamment le retrait du verrou, du fichier assemblé et de l'installateur.
L'échec d'un retrait ne masque pas l'erreur de publication et n'empêche pas les
autres nettoyages ; il est signalé par `bestEffort`. Les chunks d'un upload
reprenable restent conservés volontairement jusqu'à reprise ou expiration.

La revue des autres temporaires confirme les blocs de nettoyage dans les
contrôleurs multipart audio/WX, le transcodage, le staging de publication et
l'acquisition du verrou de maintenance. La récupération après arrêt brutal
reste distincte du nettoyage après exception ; le point 359 reste ouvert.

Treize tests ciblés passent : fermetures asynchrone/synchrone défaillantes,
publication concurrente, remplacement refusé, métadonnées non écrites, erreur
de publication avec erreur de nettoyage, succès idempotent et échec de
transcodage. La série générale passe également : 264 suites / 1 180 tests.
Typage, lint, quality:check, build et chargement AppModule réussis. Journaux :
`logs/corrections-temp-cleanup-tests.log`, `logs/corrections-next-points-*.log`,
`logs/corrections-final-typecheck.log` et `logs/corrections-final-lint.log`.
