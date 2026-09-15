#include "modules/admin/domain/AdminCommand.h"
#include "generated/protocol/WsMessageTypes.generated.h"

namespace lila::modules::admin::domain
{
namespace ws = lila::shared::network::ws::types;

void AppendOperationsCommands(std::vector<AdminCommand>& c)
{
    using T = AdminTransport;
    c.insert(c.end(), {
        {"dashboard.perf", L"État des performances", L"Mesures des cinq dernières minutes.", T::ApiWebSocket, std::string(ws::admin::perf::Snapshot), {}, R"({"windowSeconds":300})"},
        {"dashboard.rooms", L"Salles récentes", L"Salles persistées, y compris celles sans joueur connecté.", T::ApiWebSocket, std::string(ws::admin::rooms::List), {}, R"({"limit":20,"includePrivate":true,"includeStarted":true})"},

        {"settings.profile.get", L"Lire les paramètres de profil", L"Bornes des biographies.", T::ApiWebSocket, std::string(ws::admin::profile::SettingsGet)},
        {"settings.profile.update", L"Modifier les paramètres de profil", L"La valeur minimale doit rester inférieure au maximum.", T::ApiWebSocket, std::string(ws::admin::profile::SettingsUpdate), {}, R"({"bioMinLength":0,"bioMaxLength":2000})"},
        {"settings.broadcast", L"Diffuser une annonce", L"Envoyer une notification à tous les utilisateurs.", T::ApiWebSocket, std::string(ws::admin::Broadcast), {}, R"({"message":""})", true},
        {"settings.stats.reset", L"Réinitialiser les statistiques", L"Supprimer les joueurs et matchs statistiques.", T::ApiWebSocket, std::string(ws::admin::stats::ResetAll), {}, "{}", true},

        {"logs.download", L"Lire les journaux", L"Dernières lignes du fichier le plus récent.", T::ApiWebSocket, std::string(ws::admin::logs::Download), {}, R"({"lines":200,"filter":""})"},
        {"perf.snapshot", L"Mesurer les performances", L"Fenêtre effective entre 5 et 3600 secondes.", T::ApiWebSocket, std::string(ws::admin::perf::Snapshot), {}, R"({"windowSeconds":300})"},

        {"sounds.diagnostic", L"Diagnostiquer les sons", L"Manifest, fichiers présents et manquants.", T::HttpJson, "GET /api/admin/sounds/diagnostic"},
        {"sounds.catalog", L"Sons par catégorie et écran", L"Affiche chaque événement, son actif et source utilisée.", T::HttpJson, "GET /api/admin/sounds/catalog"},
        {"sounds.ambiences", L"Lister les ambiances", L"Inclut les ambiances désactivées.", T::HttpJson, "GET /api/admin/sounds/table-ambiences"},
        {"sounds.ambience.create", L"Créer une ambiance", L"Une des vingt places disponibles sera affectée.", T::HttpJson, "POST /api/admin/sounds/table-ambiences", {}, R"({"name":""})"},
        {"sounds.ambience.rename", L"Renommer une ambiance", L"Identifiant TableAmbience et nom.", T::HttpJson, "PUT /api/admin/sounds/table-ambiences/{soundId}", {}, R"({"soundId":"TableAmbience1","name":""})"},
        {"sounds.ambience.enable", L"Activer ou désactiver une ambiance", L"Visibilité publique de l'ambiance.", T::HttpJson, "PUT /api/admin/sounds/table-ambiences/{soundId}/enabled", {}, R"({"soundId":"TableAmbience1","enabled":true})"},
        {"sounds.ambience.delete", L"Supprimer une ambiance", L"Supprime aussi le son associé.", T::HttpJson, "DELETE /api/admin/sounds/table-ambiences/{soundId}", {}, R"({"soundId":"TableAmbience1"})", true},
        {"sounds.preview", L"Aperçu", L"Jouer le son sélectionné.", T::LocalAction, "preview-sound", {}, R"({"soundId":"ClientOpened"})"},
        {"sounds.upload", L"Ajouter ou remplacer un son", L"Choisissez l’écran et l’événement, puis un fichier WAV ou MP3 (250 Mio maximum).", T::HttpMultipart, "POST /api/admin/sounds/{soundId}", {}, R"({"soundId":"ClientOpened","filePath":""})"},
        {"sounds.enable", L"Activer ou désactiver un son", L"Le son par défaut et le son personnalisé suivent le même réglage.", T::HttpJson, "PUT /api/admin/sounds/{soundId}/enabled", {}, R"({"soundId":"ClientOpened","enabled":true})"},
        {"sounds.clear", L"Rétablir le son par défaut", L"Supprime uniquement le fichier personnalisé de cet événement.", T::HttpJson, "DELETE /api/admin/sounds/{soundId}", {}, R"({"soundId":"ClientOpened"})", true},
        {"sounds.reencode.invalid", L"Réencoder les sons invalides", L"Ne traite que les fichiers non conformes.", T::HttpJson, "POST /api/admin/sounds/reencode-invalid", {}, "{}", true},
        {"sounds.reencode.all", L"Tout réencoder", L"Réencoder l'ensemble des sons.", T::HttpJson, "POST /api/admin/sounds/reencode", {}, "{}", true},
        {"sounds.cleanup", L"Nettoyer les fichiers inutilisés", L"Supprimer les versions non référencées.", T::HttpJson, "POST /api/admin/sounds/cleanup", {}, "{}", true},

        {"maintenance.health", L"Vérifier la santé", L"Interroger le contrôle de santé interne.", T::HttpJson, "GET /api/admin/maintenance/health", {}, "{}", false, true},
        {"maintenance.deploy.status", L"Statut du déploiement", L"État de l'unité systemd.", T::HttpJson, "GET /api/admin/maintenance/deploy/status", {}, "{}", false, true},
        {"maintenance.deploy.logs", L"Journaux du déploiement", L"Nombre de lignes entre 1 et 10000.", T::HttpJson, "GET /api/admin/maintenance/deploy/logs", {}, R"({"tail":200})", false, true},
        {"maintenance.service.status", L"Statut du serveur", L"État du service systemd.", T::HttpJson, "GET /api/admin/maintenance/service/status", {}, "{}", false, true},
        {"maintenance.deploy", L"Déployer", L"Démarrer l'unité de déploiement.", T::HttpJson, "POST /api/admin/maintenance/deploy", {}, "{}", true, true},
        {"maintenance.dryRun", L"Tester la compilation", L"Compiler sans redémarrer le serveur.", T::HttpJson, "POST /api/admin/maintenance/deploy/dry-run", {}, "{}", true, true},
        {"maintenance.migrations", L"Exécuter les migrations", L"Appliquer les migrations de base de données.", T::HttpJson, "POST /api/admin/maintenance/migrations/run", {}, "{}", true, true},
        {"maintenance.restart", L"Redémarrer le serveur", L"La connexion sera momentanément interrompue.", T::HttpJson, "POST /api/admin/maintenance/service/restart", {}, "{}", true, true},
        {"maintenance.buildRestart", L"Compiler et redémarrer", L"Compiler puis redémarrer le serveur.", T::HttpJson, "POST /api/admin/maintenance/service/build-restart", {}, "{}", true, true},
        {"maintenance.daemonReload", L"Recharger systemd", L"Exécuter systemctl daemon-reload.", T::HttpJson, "POST /api/admin/maintenance/systemd/daemon-reload", {}, "{}", true, true},
    });
}
}
