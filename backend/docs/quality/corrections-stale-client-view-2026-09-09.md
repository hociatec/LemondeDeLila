# Refus des vues anciennes dans le client

Le point 603 reste ouvert : la réception ordonnée sur tous les chemins serveur
n'est pas encore établie. La protection du client a toutefois été renforcée.

Pour une même table et un même jeu déjà identifiés et versionnés, une vue sans
identifiant de partie ou sans version ne remplace plus la vue courante. Les
générations et versions anciennes restent refusées. Une première vue non versionnée
reste possible lors du démarrage. Une vue refusée ne réinitialise plus la commande
réessayable et ne modifie plus le suivi des soumissions.

Les tests C++ couvrent les versions absentes, les identifiants absents et les vues
anciennes en partie active, en complément des tests de changement de génération.
Compilation MSVC C++20 et exécution de la cible de contrats de jeu réussies ; les
deux unités d'interface modifiées ont également été compilées avec les en-têtes wx.
Journaux : `logs/corrections-stale-view-targets.log` et
`logs/corrections-stale-view-tests.log`.

La configuration complète du client échoue sur `minizConfig.cmake` absent ; une
cible CMake isolée reprend les sources exactes du contrat de jeu pour ces contrôles.
Le client complet n'a donc pas été lié ni lancé. Aucun déploiement n'a été effectué.
