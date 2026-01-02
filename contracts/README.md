# Contracts (source de vérité)

Objectif : réduire la duplication client/serveur (DTO, routes, payloads) et faciliter les évolutions sans casser les anciennes versions.

## HTTP

- Base URL : `/api/...`
- Contrats : à formaliser via OpenAPI (Swagger) ou schémas JSON versionnés.

## WebSocket

Le backend maintient un registre des messages WS (`type`) acceptés. Pour exposer ce catalogue (capabilities) :

- Endpoint : `GET /api/capabilities`
- Réponse :
  - `ws.types`: liste triée des `type` WS supportés par le serveur.

Le client doit consommer ces capabilities pour activer/désactiver des features et éviter d'appeler des routes non supportées.

