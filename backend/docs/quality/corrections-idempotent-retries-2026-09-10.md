# Retries limités aux effets idempotents

Le point 583 est couvert par le scheduler de tâches de jeu : le retry BullMQ
est réservé aux tâches automatiques dont l'exécution passe par un identifiant de
commande stable et le chemin de commit idempotent. Les effets métier ne sont
jamais rejoués directement par l'infrastructure. Les tâches invalides sont
marquées irrécupérables et les échecs finaux sont envoyés en dead-letter.

La constante `IDEMPOTENT_TASK_ATTEMPTS` rend cette hypothèse explicite dans le
code. Les tests d'automatisation couvrent la livraison répétée après échec du
publisher sans double commit.
