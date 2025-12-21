# Client Java – Le Monde de Lila

Ce dossier contient le client de bureau (Java 21) permettant de piloter un serveur distant. Cette section récapitule la configuration nécessaire, la procédure de build et les points d’attention côté signatures.

## Prérequis

- JDK 21 (le wrapper `./mvnw` télécharge Maven automatiquement)
- JavaFX dépend du système graphique : testez sous Windows/macOS/Linux avec les bibliothèques natives habituelles
- Accès réseau vers l’API distante `https://api.lilas.hociatec.fr` et les WebSocket `wss://ws.lilas.hociatec.fr`

## Configuration réseau et signatures

1. **Secret WS partagé**  
   - Définissez un secret alphanumérique et renseignez-le côté serveur via la variable `WS_SHARED_SECRET` (cf. `backend/.env.example`).  
   - Côté client, renseignez le même secret dans `java-client/config/client.properties` (`network.ws.secret`) ou via les variables d’environnement `NETWORK_WS_SECRET` / `WS_SHARED_SECRET`.  
   - Sans secret, les connexions `/ws` sont refusées depuis le serveur.

2. **Endpoints distants**  
   - Les valeurs par défaut pointent désormais vers `https://api.lilas.hociatec.fr` (HTTP) et `wss://ws.lilas.hociatec.fr` (WS/présence/API).  
   - Pour des environnements particuliers, dupliquez `config/client.properties` et adaptez les URLs.

3. **Mises à jour signées**  
   - Déposez la clé publique PEM utilisée pour signer les archives dans `config/update-signing-public.pem` (ou exposez-la via `UPDATES_SIGNATURE_PUBLIC_KEY[_B64]`).  
   - Le backend qui publie les archives doit signer le ZIP avec la clé privée correspondante et exposer `signature` ou `signatureUrl` dans le manifest `/client/version`.

## Build du client

```bash
cd java-client
./mvnw clean package -pl client-app -am
```

- Le JAR autonome se trouve dans `client-app/target/client-app-1.0.9-all.jar`.
- Pour tester localement : `java -jar client-app/target/client-app-1.0.9-all.jar`.
- Le script `tools/build-client-package.sh` assemble une archive prête à être servie par le backend (`backend/var/updates/le-monde-de-lila-client.zip`).
- Sous Windows, `powershell -File tools/build-client-exe.ps1 -CertificatePath ...` construit l’installateur signé (code signing requis en production).

## Publication côté serveur

1. Construisez le backend (`backend/`) et placez-y les variables d’environnement (`JWT_SECRET`, `WS_SHARED_SECRET`, Redis/MySQL, etc.).  
2. Générez le package client (`tools/build-client-package.sh`) puis signez l’archive ZIP avec votre clé privée.  
3. Exposez un manifest JSON à `https://api.lilas.hociatec.fr/client/version` contenant : version courante, URL de téléchargement, checksum SHA-256 et soit `signature` (Base64) soit `signatureUrl`.  
4. Vérifiez que `config/update-signing-public.pem` côté client contient la clé publique associée, afin que `UpdateService` puisse valider l’archive avant installation.

Avec ces étapes, un build local du client peut piloter le serveur distant tout en conservant la vérification des signatures côté serveur et lors des mises à jour.

