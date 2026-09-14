#include "modules/admin/domain/AdminCommand.h"
#include "generated/protocol/WsMessageTypes.generated.h"

namespace lila::modules::admin::domain
{
namespace ws = lila::shared::network::ws::types;

void AppendOperationsCommands(std::vector<AdminCommand>& c)
{
    using S = AdminSection; using T = AdminTransport;
    c.insert(c.end(), {
        {"dashboard.perf", S::Dashboard, L"État des performances", L"Mesures des cinq dernières minutes.", T::ApiWebSocket, std::string(ws::admin::perf::Snapshot), {}, R"({"windowSeconds":300})"},
        {"dashboard.rooms", S::Dashboard, L"Salles actives", L"Résumé des salles visibles.", T::ApiWebSocket, std::string(ws::admin::rooms::List), {}, R"({"limit":20,"includePrivate":true,"includeStarted":true})"},

        {"settings.profile.get", S::Settings, L"Lire les paramètres de profil", L"Bornes des biographies.", T::ApiWebSocket, std::string(ws::admin::profile::SettingsGet)},
        {"settings.profile.update", S::Settings, L"Modifier les paramètres de profil", L"La valeur minimale doit rester inférieure au maximum.", T::ApiWebSocket, std::string(ws::admin::profile::SettingsUpdate), {}, R"({"bioMinLength":0,"bioMaxLength":2000})"},
        {"settings.broadcast", S::Settings, L"Diffuser une annonce", L"Envoyer une notification à tous les utilisateurs.", T::ApiWebSocket, std::string(ws::admin::Broadcast), {}, R"({"message":""})", true},
        {"settings.stats.reset", S::Settings, L"Réinitialiser les statistiques", L"Supprimer les joueurs et matchs statistiques.", T::ApiWebSocket, std::string(ws::admin::stats::ResetAll), {}, "{}", true},

        {"logs.download", S::Observability, L"Lire les journaux", L"Dernières lignes du fichier le plus récent.", T::ApiWebSocket, std::string(ws::admin::logs::Download), {}, R"({"lines":200,"filter":""})"},
        {"perf.snapshot", S::Observability, L"Mesurer les performances", L"Fenêtre effective entre 5 et 3600 secondes.", T::ApiWebSocket, std::string(ws::admin::perf::Snapshot), {}, R"({"windowSeconds":300})"},

        {"sounds.diagnostic", S::Sounds, L"Diagnostiquer les sons", L"Manifest, fichiers présents et manquants.", T::HttpJson, "GET /api/admin/sounds/diagnostic"},
        {"sounds.ambiences", S::Sounds, L"Lister les ambiances", L"Inclut les ambiances désactivées.", T::HttpJson, "GET /api/admin/sounds/table-ambiences"},
        {"sounds.ambience.create", S::Sounds, L"Créer une ambiance", L"Une des vingt places disponibles sera affectée.", T::HttpJson, "POST /api/admin/sounds/table-ambiences", {}, R"({"name":""})"},
        {"sounds.ambience.rename", S::Sounds, L"Renommer une ambiance", L"Identifiant TableAmbience et nom.", T::HttpJson, "PUT /api/admin/sounds/table-ambiences/{soundId}", {}, R"({"soundId":"TableAmbience1","name":""})"},
        {"sounds.ambience.enable", S::Sounds, L"Activer ou désactiver une ambiance", L"Visibilité publique de l'ambiance.", T::HttpJson, "PUT /api/admin/sounds/table-ambiences/{soundId}/enabled", {}, R"({"soundId":"TableAmbience1","enabled":true})"},
        {"sounds.ambience.delete", S::Sounds, L"Supprimer une ambiance", L"Supprime aussi le son associé.", T::HttpJson, "DELETE /api/admin/sounds/table-ambiences/{soundId}", {}, R"({"soundId":"TableAmbience1"})", true},
        {"sounds.upload", S::Sounds, L"Téléverser un son", L"Fichier WAV ou MP3, 250 Mio maximum.", T::HttpMultipart, "POST /api/admin/sounds/{soundId}", {}, R"({"soundId":"","filePath":""})"},
        {"sounds.clear", S::Sounds, L"Effacer un son", L"Retirer le son du manifeste.", T::HttpJson, "DELETE /api/admin/sounds/{soundId}", {}, R"({"soundId":""})", true},
        {"sounds.reencode.invalid", S::Sounds, L"Réencoder les sons invalides", L"Ne traite que les fichiers non conformes.", T::HttpJson, "POST /api/admin/sounds/reencode-invalid", {}, "{}", true},
        {"sounds.reencode.all", S::Sounds, L"Tout réencoder", L"Réencoder l'ensemble des sons.", T::HttpJson, "POST /api/admin/sounds/reencode", {}, "{}", true},
        {"sounds.cleanup", S::Sounds, L"Nettoyer les fichiers inutilisés", L"Supprimer les versions non référencées.", T::HttpJson, "POST /api/admin/sounds/cleanup", {}, "{}", true},

        {"maintenance.health", S::Maintenance, L"Vérifier la santé", L"Interroger le health check interne.", T::HttpJson, "GET /api/admin/maintenance/health", {}, "{}", false, true},
        {"maintenance.deploy.status", S::Maintenance, L"Statut du déploiement", L"État de l'unité systemd.", T::HttpJson, "GET /api/admin/maintenance/deploy/status", {}, "{}", false, true},
        {"maintenance.deploy.logs", S::Maintenance, L"Logs du déploiement", L"Nombre de lignes entre 1 et 10000.", T::HttpJson, "GET /api/admin/maintenance/deploy/logs", {}, R"({"tail":200})", false, true},
        {"maintenance.service.status", S::Maintenance, L"Statut du backend", L"État du service systemd.", T::HttpJson, "GET /api/admin/maintenance/service/status", {}, "{}", false, true},
        {"maintenance.deploy", S::Maintenance, L"Déployer", L"Démarrer l'unité de déploiement.", T::HttpJson, "POST /api/admin/maintenance/deploy", {}, "{}", true, true},
        {"maintenance.dryRun", S::Maintenance, L"Tester le build", L"Exécuter npm run build sans redémarrer.", T::HttpJson, "POST /api/admin/maintenance/deploy/dry-run", {}, "{}", true, true},
        {"maintenance.migrations", S::Maintenance, L"Exécuter les migrations", L"Appliquer les migrations de base de données.", T::HttpJson, "POST /api/admin/maintenance/migrations/run", {}, "{}", true, true},
        {"maintenance.restart", S::Maintenance, L"Redémarrer le backend", L"La connexion sera momentanément interrompue.", T::HttpJson, "POST /api/admin/maintenance/service/restart", {}, "{}", true, true},
        {"maintenance.buildRestart", S::Maintenance, L"Build et redémarrage", L"Compiler puis redémarrer le backend.", T::HttpJson, "POST /api/admin/maintenance/service/build-restart", {}, "{}", true, true},
        {"maintenance.daemonReload", S::Maintenance, L"Recharger systemd", L"Exécuter systemctl daemon-reload.", T::HttpJson, "POST /api/admin/maintenance/systemd/daemon-reload", {}, "{}", true, true},
    });
}
}
