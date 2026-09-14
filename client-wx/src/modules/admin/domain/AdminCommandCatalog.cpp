#include "modules/admin/domain/AdminCommand.h"

namespace lila::modules::admin::domain
{
void AppendModerationCommands(std::vector<AdminCommand>& commands);
void AppendContentCommands(std::vector<AdminCommand>& commands);
void AppendOperationsCommands(std::vector<AdminCommand>& commands);

const std::vector<AdminCommand>& GetAdminCommands()
{
    static const auto commands = []
    {
        std::vector<AdminCommand> result;
        AppendModerationCommands(result);
        AppendContentCommands(result);
        AppendOperationsCommands(result);
        return result;
    }();
    return commands;
}

const std::vector<AdminSectionDescriptor>& GetAdminSections()
{
    static const std::vector<AdminSectionDescriptor> sections{
        {AdminSection::Dashboard, L"Tableau de bord", L"Vue synthétique de l'administration."},
        {AdminSection::Users, L"Utilisateurs", L"Comptes, rôles et bannissements."},
        {AdminSection::Chat, L"Modération du tchat", L"Messages, sanctions et paramètres."},
        {AdminSection::Contacts, L"Contacts administrateur", L"Demandes adressées à l'équipe."},
        {AdminSection::BugReports, L"Rapports de bugs", L"Suivi des rapports et commentaires."},
        {AdminSection::Rooms, L"Salles", L"Surveillance et nettoyage des salles."},
        {AdminSection::Games, L"Jeux et catégories", L"Catalogue, règles et classement."},
        {AdminSection::Bots, L"Bots", L"Noms et temporisations des bots."},
        {AdminSection::MnemoQuiz, L"Quiz Mnemo", L"Catégories et questions."},
        {AdminSection::Roles, L"Rôles", L"Définitions et permissions déclarées."},
        {AdminSection::Settings, L"Réglages globaux", L"Profil, diffusion et statistiques."},
        {AdminSection::Sounds, L"Sons", L"Diagnostic, fichiers et ambiances."},
        {AdminSection::Observability, L"Journaux et performances", L"Journaux et mesures du serveur."},
        {AdminSection::Maintenance, L"Maintenance", L"Déploiement et service du serveur."},
    };
    return sections;
}

std::vector<const AdminCommand*> CommandsForSection(AdminSection section)
{
    std::vector<const AdminCommand*> result;
    for (const auto& command : GetAdminCommands())
        if (command.section == section) result.push_back(&command);
    return result;
}
}
