Tests spécifiques à Panier Express
=================================

Ce dossier regroupe les tests liés au moteur Panier Express.

Les tests principaux sont actuellement dans `tests/panier-express.service.spec.ts` et valident :
- l'exposition d'état (`exposeState`) et le Presenter,
- la pioche (stand/bonus) et le refill des decks,
- le blocage quiz, le skip de tour et la victoire,
- les échanges (choix cible + carte, cas impossible, résolution).

Les nouveaux tests propres à Panier Express peuvent être ajoutés ici ou à côté des services concernés, tant qu'ils suivent la convention `*.spec.ts`.

