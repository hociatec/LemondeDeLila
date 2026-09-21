# Audit ciblé du moteur backend — 21 septembre 2026

Revue du code courant, comprenant les corrections réalisées dans cette session.
Aucune correction du moteur n'est effectuée pendant cette passe. Les reproductions
utilisent des dépôts simulés ou des fichiers temporaires ; aucune base de production
n'a été interrogée ou modifiée. Cet audit n'est pas exhaustif.

## 1. Réutilisation des numéros d'événement après 10 000 événements — priorité haute

`game-session-typeorm.store.ts`, méthode `timeline`, charge les 10 000 premiers
événements dans l'ordre croissant. `compareAndSet` utilise cette lecture pour
ajouter un commit. `appendGameTimelineCommit` calcule le numéro suivant à partir
du dernier événement chargé, et non du dernier événement réellement enregistré.

Reproduction avec le véritable dépôt et un gestionnaire TypeORM simulé contenant
10 001 événements : le commit suivant est accepté et produit à nouveau la
séquence 10 001. Cette séquence fait partie de la clé primaire de la table ; un
`save` peut donc réécrire un événement existant. Le replay et l'historique sont
menacés. Le chargement des snapshots est aussi limité aux 1 000 premiers.

Correction proposée : conserver une séquence transactionnelle fiable et lire
les événements nécessaires depuis le snapshot pertinent, avec pagination.
Tester explicitement le franchissement des deux limites et la reconstruction
de l'état après ce franchissement.

## 2. Catalogue éditable invalide : panne de description et de présentation — priorité haute

`content-backed-runtime.ts`, `getDescriptor`, relit et compile le catalogue
courant. La mise à la corbeille de la dernière question validée est autorisée
par le stockage administratif, mais laisse un catalogue non jouable.

Reproduction : après ce changement, `GameRegistryService.listDescriptors()`
lève une erreur de configuration au lieu de retourner les descriptions des jeux.
Le présentateur WebSocket appelle aussi `handler.getDescriptor()` pour chaque
état. La copie de contenu conservée dans la partie ne suffit donc pas à isoler
sa présentation des modifications ultérieures du catalogue.

Ce défaut provient du branchement de catalogue ajouté dans cette session.
Correction proposée : séparer les métadonnées stables des configurations jouables
et utiliser le contenu de la session pour sa présentation ; isoler le jeu
indisponible sans faire échouer le catalogue global.

## 3. Limites incompatibles entre catalogue et état de partie — priorité haute

L'administration accepte un catalogue de 4 Mio et jusqu'à 5 000 questions.
`contentBackedRuntime` copie le document complet dans chaque état initial alors
que la politique de persistance limite un état à 1 000 000 octets.

Reproduction avec 650 questions valides de 1 600 caractères : catalogue JSON
formaté de 1 229 139 octets, état initial de 1 183 379 octets ;
`assertGameStateSize` refuse cet état avec « État de partie trop volumineux ».
Les limites de longueur des questions et de taille du catalogue sont respectées.

Ce défaut découle également de l'ajout récent de la copie de contenu.
Correction proposée : conserver les versions immuables de contenu séparément
et ne persister dans la partie que leur référence durable, avec une stratégie
de restauration et de rétention. Une limite cohérente à l'édition doit aussi
empêcher d'accepter un catalogue impossible à utiliser.

## 4. Éditions perdues entre instances du stockage administratif — priorité moyenne

`MnemoQuizStoreService` charge son fichier une fois, puis réécrit intégralement
son état en mémoire. L'écriture atomique protège le fichier contre une écriture
partielle, mais ne détecte pas une version périmée.

Reproduction avec deux instances partageant le même fichier : A modifie une
question ; B renomme ensuite une catégorie. Le renommage est enregistré mais
la modification de question disparaît. Ce scénario concerne notamment un
déploiement avec plusieurs processus partageant le catalogue.

Correction proposée : stockage transactionnel partagé avec versionnement ou
verrou couvrant la lecture, la modification et l'écriture.

## 5. Coût croissant de chaque action — dette de performance

Chaque commit TypeORM recharge et clone l'historique et les snapshots, même
lorsqu'il ajoute un seul événement. Le coût croît avec la durée de la partie.
Le catalogue copié dans les snapshots augmente encore le volume manipulé.
Le runtime éditable sérialise et hache aussi le document complet à chaque
délégation ; sa description fait des lectures synchrones de fichier.

Ces parcours sont confirmés par lecture du code ; leur latence réelle n'a pas
été mesurée sous charge. Profilage recommandé sur des parties longues et avec
plusieurs versions de catalogue simultanées, puis écriture incrémentale et cache
indexé par une identité de contenu stable.

## 6. Couplage et complexité — dettes confirmées par les audits

`game-engine-architecture-check.cjs` signale 10 violations : quatre imports de
données d'un jeu concret depuis la composition ajoutée dans cette session et
six violations dans des tests existants. Le catalogue éditable doit passer par
un mécanisme générique respectant les frontières du moteur.

`structural-quality-check.cjs` signale sept dépassements, dont six dans le moteur
et un dans le module sons. Le présentateur des messages atteint notamment
524 lignes de classe et 24 méthodes. Les recettes quiz et paw-scoring dépassent
aussi certains seuils. Ces mesures indiquent des responsabilités à séparer,
sans constituer à elles seules une preuve de bug fonctionnel.

## Vérifications

- Reproductions isolées des points 1 à 4 : défauts observés.
- Cinq suites existantes, 51 tests réussis : événements, sérialisation des
  snapshots, automatisation, récupération et catalogue éditable.
- Audits de séparation runtime, propriété des états, sécurité et retries : OK.
- Audits d'architecture du moteur et de structure : échecs détaillés ci-dessus.
- Pas de test de charge, de test MySQL réel ni d'audit exhaustif de tous les jeux.
