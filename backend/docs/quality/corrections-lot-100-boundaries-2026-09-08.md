# Lot de 100 points — frontières et contrats — 8 septembre 2026

Ce lot couvre exactement 100 exigences du fichier de travail. Les clôtures regroupent des corrections nouvelles, des garanties déjà présentes relues et testées, des audits demandés et des règles de conception/Definition of Done désormais documentées. Ce ne sont pas 100 nouveaux bugs corrigés. Les exigences de nouveau jeu/module ne signifient pas que tout l'historique est conforme.

Validation finale : **213 suites / 771 tests réussis**, typecheck complet, lint, build et chargement AppModule compilé, verify:dist (38 manifestes / 42 contenus) et quality:check réussis. Aucun budget ni baseline de dette augmenté. Journaux : `logs/corrections-boundaries-jest-final.log`, `logs/corrections-boundaries-typecheck-final.log`, `logs/corrections-boundaries-lint-final.log`, `logs/corrections-boundaries-build.log` et `logs/corrections-boundaries-quality-final.log`.

Les 100 lignes correspondantes sont retirées après validation : **441 clôtures cumulées, 303 points encore ouverts**. Les corrections imposent les types JSON déclarés dans les DTO, une origine navigateur WS autorisée et des dates de ban explicites ; une date persistée corrompue est désormais rejetée au lieu d'être remplacée par l'instant courant.

## Preuves et portée

- [Frontières, sessions et dates](../architecture/boundaries-review-2026-09-08.md) : JSON, DTO, origines WS, refresh tokens, bannissements, dates, limitations restantes.
- [Persistence et migrations](../architecture/persistence-review-2026-09-08.md) : audit N+1/eager, transactions, registre des 26 entités, empreintes des 39 migrations.
- [Guide auteur et frontières](../architecture/authoring-and-boundaries.md) : matrice, vocabulaire corrigé, ownership, kits/patterns, DoD et critères d'abstraction.
- Tests nouveaux : json-input-limits, ws-origin-policy, user-ban.policy, redis-refresh-token.service, date-serialization, chat-message-presenter.service, presence-client-message.service, typeorm-entities et migration-history.
- Audits existants : quality:check, notamment security, persistence, architecture, layout, structure et moteur ; limites sémantiques documentées.

Les points 281/295 (couverture exhaustive de validation), 397/418 (autorisation/revocation de sessions existantes), 409/411/413 (limites des autres chemins WS et distribution), 431/433/440 (migrations historiques), 453/459 (shared technique), 620 et 626–628 (discovery/manifest), 710/718/722 restent ouverts. Aucun déploiement, migration SQL ni campagne MySQL/Redis réelle effectué.

## Détail des 100 clôtures

| Point | Exigence d'origine | Résolution et preuve |
| --- | --- | --- |
| 283 | **Différencier valeurs requises et optionnelles.** | Schéma Joi relu : required, optional et default distinguent les valeurs obligatoires et facultatives ; 281 reste ouvert. |
| 296 | **Ne pas considérer un DTO TypeScript comme validation runtime.** | PayloadValidationService exécute class-validator ; le type TS seul ne suffit pas. Tests de DTO invalides. |
| 297 | **Centraliser les règles de validation communes.** | Normalisation et validation partagées ; garde JSON commune utilisée par HTTP et les quatre chemins WS. |
| 301 | **Définir les invariants des value objects importants dans le domaine.** | Invariants de credentials et d'expiration de ban exprimés dans les policies pures de user. |
| 302 | **Éviter les primitives obsessionnelles lorsqu'un concept a de vraies règles.** | Durées et dates de ban passent par les fonctions de domaine, y compris depuis les use-cases admin. |
| 303 | **Ne pas créer des value objects artificiels sans invariant.** | Fonctions de domaine portant de vrais invariants, sans création de classes value object vides. |
| 308 | **Pour les domaines CRUD simples, ne pas imposer cette séparation artificiellement.** | Revue des CRUD et règle explicite autorisant les records simples ; aucune double hiérarchie imposée. |
| 310 | **Les repositories doivent exprimer des besoins du domaine, pas exposer QueryBuilder au use-case.** | Audit AST interdit QueryBuilder hors adapters ; ports de repository relus. |
| 314 | **Centraliser les transactions dans les adapters/unit-of-work lorsque nécessaire.** | Transactions session/room/stats/rôles derrière les adapters ; saga Vault distinguée. |
| 319 | **Auditer les N+1 potentiels des repositories.** | Audit des collections, boucles et jointures documenté ; les plans SQL réels restent à mesurer. |
| 320 | **Auditer les chargements de relations eager.** | Inventaire des dix relations eager et des relations explicitement non eager ; leur suppression n'est pas affirmée. |
| 324 | **Cependant, garder le read model dans une couche de query explicitement assumée plutôt que casser les domaines silencieusement.** | Read models Room/Social/Messaging possédés par leurs modules et injectés à la racine ; revue documentée. |
| 395 | **Auditer auth sur toutes les frontières HTTP et WS.** | Revue des controllers et handlers, matrice des ressources et audit security ; limites de réévaluation des sessions conservées. |
| 398 | **Séparer authentication et authorization.** | Vérification JWT/ticket distinguée des rôles et policies de ressource dans les flux et la documentation. |
| 403 | **Centraliser les politiques de bannissement.** | Contrat user-ban commun aux bans compte/tchat ; le ban de membership sans date reste une règle Room distincte. |
| 404 | **Éviter plusieurs interprétations du même `bannedUntil`.** | Même statut none/expired/active/invalid utilisé par login, refresh et Presence. |
| 405 | **Centraliser parsing et comparaison des dates de ban.** | Parsing de date et calcul d'expiration centralisés dans user-ban.policy, adoptés par administration compte/tchat. |
| 406 | **Définir comportement exact `null`, expiration passée, date invalide.** | Null/undefined : aucun ban ; égalité/past : expiré ; date invalide : accès refusé. Cas limites testés. |
| 408 | **Prévoir rate limit login.** | Quota WS API appliqué avant le handler login ; limite locale et contournement par reconnexion documentés, 413 ouvert. |
| 410 | **Prévoir rate limit invitations.** | Invitations API soumises au quota du dispatcher avant le handler ; distribution du quota encore ouverte. |
| 412 | **Prévoir limites upload.** | Plafonds sons/WX inspectés et tests d'upload exécutés ; séparation taille/quota de requêtes documentée. |
| 415 | **Auditer refresh tokens.** | Audit émission, stockage, rotation, révocation et limite de logout ; ajout de tests dédiés au service Redis. |
| 416 | **Stocker les refresh tokens de manière adaptée au modèle de sécurité.** | Token aléatoire 48 octets ; clé SHA-256 uniquement dans Redis, TTL ; test de non-stockage du token clair. |
| 417 | **Prévoir rotation/revocation.** | Consommation atomique GET/DEL avant rotation et révocation du digest ; tests de réutilisation/refus de userId corrompu. |
| 419 | **Configurer correctement expiration JWT.** | Expiration JWT positive avec unité obligatoire et tolérance bornée ; configurations ambiguës rejetées au démarrage. |
| 420 | **Ne pas avoir de secret JWT par défaut en production.** | RS256 et clés explicites obligatoires ; aucun secret JWT arbitraire de repli, tests de configuration. |
| 421 | **Auditer cookies/session : secure, httpOnly, sameSite selon architecture.** | Audit : aucun cookie d'auth émis par les flux actuels ; bearer/tickets explicites, futur contrat cookie documenté. |
| 422 | **Définir CORS explicitement.** | CORS HTTP explicite avec liste d'origines ; aucune origine acceptée par défaut en production. |
| 423 | **Définir WebSocket origins.** | Contrôle WS des origines ajouté au handshake commun ; comparaison exacte, null et origines malformées refusés. |
| 424 | **Ne pas faire confiance à `Origin` comme unique auth.** | Origin ne remplace ni JWT ni ticket ; absence autorisée pour les clients natifs. |
| 425 | **Auditer les DTO et messages pour prototype pollution/object injection si objets arbitraires.** | Audit/correction des clés de prototype imbriquées avant transformation DTO et traitement WS ; tests hostiles. |
| 426 | **Filtrer les champs inconnus lorsque le protocole l'exige.** | Champs inconnus refusés par les DTO et l'enveloppe API/Room selon leur contrat ; validation runtime testée. |
| 427 | **Limiter profondeur et taille des JSON entrants.** | JSON bornés en octets, profondeur 32 et 10 000 nœuds ; HTTP, API, Room, Presence et Notification raccordés. |
| 430 | **Auditer les migrations DB.** | 39 migrations relues : dépendances, historique, imports externes, réversibilité et limites documentés. |
| 432 | **Une migration appliquée doit rester immuable.** | Empreintes des 39 migrations figées ; test refuse altération, omission ou nouvelle migration sans entrée revue. |
| 436 | **Documenter les migrations non réversibles.** | Runbook précise les purges sans retour, down destructeurs, colonnes perdues et clôtures de matchs non annulées. |
| 437 | **Éviter de mettre de la logique applicative actuelle dans une ancienne migration.** | Anciennes migrations sans import de logique applicative actuelle ; contrats historiques définis localement. |
| 438 | **Faire en sorte qu'une ancienne migration reste compilable même si le domaine a évolué.** | 39 migrations compilables avec le typecheck actuel ; test interdit les dépendances métier contemporaines. |
| 439 | **Éviter les imports depuis les modules métier courants dans les migrations.** | Imports des migrations limités à TypeORM et modules Node explicitement connus, test bloquant. |
| 441 | **Auditer `src/typeorm-entities.ts` comme registre central.** | Registre ORM relu : 26 classes d'entité, injection au DataSource de Nest et du CLI. |
| 442 | **Éviter que ce fichier devienne une liste manuelle incohérente avec les modules.** | Test compare tous les fichiers .entity.ts à ORM_ENTITIES et refuse toute omission ou duplication. |
| 443 | **Choisir une seule stratégie de découverte des entities.** | Une liste ORM_ENTITIES explicite commune ; forFeature fournit les repositories locaux, pas une découverte concurrente. |
| 452 | **Clarifier `platform` vs `shared`.** | Matrice et conventions corrigées : platform technique, shared primitives ; dette technique historique shared explicitée. |
| 455 | **Ne pas créer de `shared/services`, `shared/entities`, `shared/repositories` fourre-tout.** | Aucun shared/services, shared/entities ou shared/repositories ; interdiction rappelée et layout vérifié. |
| 456 | **Un helper lié à une mécanique de jeu appartient au moteur.** | Mécaniques génériques et leurs helpers sous engine/runtime ; consigne auteur et audits d'import. |
| 457 | **Un helper lié à l'auth appartient à auth.** | Helpers de credentials/bans dans user, vérification JWT dans auth/ws ; ownership documentaire corrigé. |
| 458 | **Un helper lié aux rooms appartient à room.** | Helpers de membership, commandes et présentation Room colocalisés sous room ; revue de cohésion conservée. |
| 460 | **Clarifier le vocabulaire `game/core`, `game/engine`, `engine/runtime`, `engine/application`.** | Vocabulaire core/runtime/engine/application corrigé dans MODULES.md et conventions pour correspondre au code. |
| 461 | **Pas obligatoirement renommer maintenant, mais documenter définitivement la sémantique.** | Sémantique canonique fixée par ADR-006 et guide, sans renommage cosmétique. |
| 462 | **Éviter qu'un nouveau développeur interprète `core` et `runtime` comme deux moteurs concurrents.** | Suppression de l'affirmation erronée que core implémente le runtime déterministe ; rôle d'orchestration explicite. |
| 463 | **Documenter la direction des imports en une page.** | Matrice compacte de direction des imports et lien vers le contrat machine exhaustif. |
| 464 | **Documenter qui possède l'état.** | Ownership kit, extension spécifique, version/commit applicatif et projection documenté. |
| 465 | **Documenter comment créer un nouveau jeu.** | Guide renvoie au générateur réel, ses fichiers, registre généré et contrôles du build. |
| 466 | **Documenter comment savoir si une mécanique doit être extraite.** | Extraction décidée sur invariants/transitions/visibilité de deux usages réels, pas sur ressemblance textuelle. |
| 467 | **Documenter comment créer un nouveau kit.** | Procédure kit : contrats, factory, contrôleur, validation, projection, SDK, migration des usages et tests. |
| 468 | **Documenter quand utiliser recipe vs pattern vs rule.** | Table de décision rule/effect/recipe/pattern/kit avec critères distincts. |
| 471 | **Documenter les frontières entre bounded contexts.** | Guide des frontières et liens vers la revue inter-modules et les owners des tables. |
| 472 | **Créer une matrice des dépendances autorisées.** | Matrice exhaustive canonique architecture-contract.json ; pas de copie manuelle divergente. |
| 473 | **Attribuer un propriétaire conceptuel à chaque capability majeure.** | Owners conceptuels des capacités/données référencés dans table-ownership et module-boundary-review. |
| 474 | **Créer des ADR pour les décisions difficiles plutôt que laisser l'intention seulement dans le code.** | ADR-003/006 et décisions transactions/scheduling référencés ; obligation d'ADR pour décisions difficiles. |
| 475 | **Conserver `MODULES.md`, mais éviter la divergence avec la vraie architecture.** | MODULES.md conservé et corrigé, liens vers la sémantique canonique et les contrôles réels. |
| 476 | **Faire en sorte que les règles documentées soient mécaniquement enforceables autant que possible.** | Audits imports/layout/SDK/DTO, tests migrations et entités ; critères de revue humaine explicitement distingués. |
| 518 | **Auditer les noms génériques tels que `utils`, `helpers`, `manager`, `service`.** | Vocabulaire service/manager/helper et revue de cohésion relus ; décisions de conservation documentées. |
| 520 | **Ne pas renommer pour le plaisir : uniquement lorsqu'un nom empêche de comprendre ownership/responsabilité.** | Règle de renommage motivée par ownership/responsabilité, sans campagne cosmétique. |
| 522 | **Ne pas scinder uniquement pour atteindre une métrique de taille.** | Revue de cohésion et guide interdisent les extractions destinées seulement à réduire une métrique. |
| 523 | **Une grande table déclarative peut rester grande.** | Grandes tables déclaratives conservées lorsqu'elles restent cohésives, avec exemples dans la revue runtime. |
| 527 | **Privilégier des unions discriminées pour les variantes métier.** | Unions discriminées existantes de commandes et résultats Presence relues ; guide précise leur usage. |
| 547 | **À l'intérieur du moteur déterministe, choisir une représentation canonique.** | Contrat moteur en millisecondes Unix ; nowIso est une projection UTC du même GameClock ; delays en ms. |
| 548 | **Séparer clock monotonic de date civile lorsque nécessaire.** | Horloge civile GameClock/BusinessClock distinguée des mesures monotones hrtime dans le contrat documentaire. |
| 551 | **Auditer les appels `.toISOString?.()` avec fallbacks `new Date()` : un objet invalide ne devrait pas silencieusement devenir « maintenant ».** | Recherche des fallbacks de dates : corrections tchat, admin et notifications ; aucun fallback historique vers maintenant restant dans ces chemins. |
| 552 | **Une donnée absente doit rester absente ou générer une erreur selon le contrat.** | Dates requises invalides/absentes rejetées, dates optionnelles absentes projetées null ; tests de frontière. |
| 553 | **Ne pas masquer une donnée corrompue par une valeur actuelle.** | Aucune substitution d'une date corrompue par l'instant actuel dans les chemins corrigés ; mapper SQL rejette aussi les dates invalides. |
| 651 | **Établir une Definition of Done architecture pour tout nouveau jeu.** | Definition of Done auteur publiée avec contrôles automatiques et revue sémantique. |
| 654 | **Nouveau jeu = zéro duplication d'ownership des kits.** | Critère obligatoire des nouveaux jeux : aucune copie d'état possédé par un kit ; historique encore au backlog. |
| 655 | **Nouveau jeu = contenu validé/versionné.** | Critère obligatoire : contenu validé/versionné et snapshots compatibles, relié aux contrôles runtime. |
| 656 | **Nouveau jeu = aucune mécanique générique réimplémentée si une capability existe.** | Critère obligatoire : réutiliser les capacités existantes et supprimer l'état/mécanique redondants après extraction. |
| 657 | **Nouveau jeu = aucune nouvelle abstraction moteur tant qu'un deuxième usage n'est pas démontré.** | Critère obligatoire : au moins deux usages équivalents démontrés avant abstraction moteur. |
| 658 | **Nouveau jeu = règles lisibles comme règles métier.** | Critère de revue : rules.ts exprime les décisions spécifiques compréhensibles du jeu. |
| 659 | **Nouveau jeu = `game.ts` lisible comme description de ses capacités.** | Critère de revue : game.ts décrit la composition des capacités, sans orchestration technique. |
| 661 | **Définir également une Definition of Done pour nouveau module métier.** | Definition of Done module publiée, reliée à la DoD backend et au contrat d'architecture. |
| 662 | **Un module possède explicitement ses données.** | Nouveau module : owner explicite de ses tables et données requis. |
| 663 | **Expose un `public-api` minimal.** | Nouveau module : surface publique limitée aux contrats réellement consommés. |
| 664 | **N'importe pas l'infrastructure des autres modules.** | Nouveau module : aucun import d'infrastructure/entité étrangère, y compris par réexport. |
| 665 | **N'introduit pas de cycle.** | Nouveau module : aucun cycle, vérification AST du contrat d'architecture. |
| 666 | **Domain indépendant de Nest/TypeORM.** | Nouveau module : domaine sans Nest/TypeORM/I/O ; garde d'architecture existante vérifiée. |
| 667 | **Application dépend de ports.** | Nouveau module : application dépend de ports, pas des adapters concrets. |
| 668 | **Infrastructure implémente les ports.** | Nouveau module : infrastructure implémente les ports et reste remplaçable par injection. |
| 669 | **Module Nest fait uniquement le wiring.** | Nouveau module : fichier Nest limité au wiring, cohérence avec la revue de composition. |
| 670 | **DTO externes distincts des entities.** | Nouveau module : DTO externes séparés des entités, champs explicitement projetés. |
| 671 | **Dépendances inter-modules documentées.** | Nouveau module : arêtes inter-modules documentées dans la source canonique contrôlée. |
| 672 | **Ne pas viser une architecture hexagonale dogmatique pour chaque CRUD de trois lignes.** | CRUD simples autorisés sans architecture hexagonale artificielle ; guide et exemples de records. |
| 673 | **Appliquer la séparation là où elle protège réellement une frontière métier ou technique.** | Séparation requise aux vraies frontières DB/transport/métier ; distinction entre policy, record et adapter. |
| 674 | **Éviter aussi la dette d'over-engineering.** | Guide et revue de cohésion imposent une justification de changement pour toute abstraction ; pas de refactoring métrique. |
| 676 | **Conserver une interface à une seule implémentation si elle est réellement un port infrastructure important.** | Ports à une implémentation conservés pour MySQL, Redis, filesystem et horloge, avec raison explicite. |
| 677 | **Évaluer chaque abstraction selon changement qu'elle protège, pas selon nombre d'implémentations seulement.** | Évaluation selon le changement isolé, pas selon le nombre d'implémentations ; décision de revue documentée. |
| 684 | **`Repository` = persistence métier.** | Repository défini comme persistence métier ; QueryBuilder réservé à l'adapter et ports exprimant les besoins applicatifs. |
| 709 | **Définir JSON canonicalisation si hash/checksum requis.** | Canonicalisation de contenu et d'empreinte de requête décrite précisément ; tableaux/collections conservent leur ordre. |
| 713 | **Ne pas dépendre de l'ordre de clés d'un payload externe lorsqu'il n'est pas contractuel.** | Empreinte WS canonique trie récursivement les clés de payload ; tests de replay avec permutation des clés. |
| 719 | **Distinguer bugfix rétrocompatible et modification de règles.** | Critères explicites distinguant bugfix compatible et changement de règle ; révision rulesVersion et stratégie de restauration. |
| 721 | **Créer un « debt register » temporaire pendant ce chantier.** | Registre temporaire existant conservé avec numérotation et comptes rendus de clôture ; 722 reste ouvert. |
