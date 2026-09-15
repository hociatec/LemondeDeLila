#include "modules/admin/presentation/AdminFrame.h"

#include <utility>

#include <wx/stattext.h>

#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
namespace
{
std::string ItemName(const nlohmann::json& item)
{
    constexpr std::string_view keys[]{"username", "subject", "name", "title", "gameType", "id"};
    for (const auto key : keys)
    {
        const auto found = item.find(key);
        if (found != item.end() && found->is_string()) return found->get<std::string>();
        if (found != item.end() && found->is_number_integer())
            return std::to_string(found->get<long long>());
    }
    return "Élément";
}
}

void AdminFrame::OpenResultActions(std::size_t index)
{
    if (index >= resultItems_.size())
    {
        FocusResultDetails();
        return;
    }
    contextItem_ = resultItems_[index];
    const auto& area = domain::GetAdminAreas()[selectedSection_];
    if (area.id == "storybook")
    {
        const auto id = contextItem_.find("id");
        if (id == contextItem_.end() || !id->is_number_integer())
        {
            SetStatus(L"Impossible d’ouvrir ce livre : identifiant utilisateur absent.", true);
            return;
        }
        const auto username = contextItem_.value("username", std::string("Utilisateur"));
        if (onOpenStoryBookRequested_) onOpenStoryBookRequested_(id->get<int>(), username);
        return;
    }
    const auto kind = currentResultItemKind_;
    if (kind == domain::AdminItemKind::None)
    {
        FocusResultDetails();
        return;
    }
    visibleCommands_.clear();
    contextActionPayloads_.clear();
    contextActionDirect_.clear();
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    const auto add = [&](std::string_view id, const wxString& label,
                         nlohmann::json payload = nlohmann::json::object(), bool direct = false)
    {
        if (const auto* command = domain::FindAdminCommand(id))
        {
            visibleCommands_.push_back(command);
            contextActionPayloads_.push_back(std::move(payload));
            contextActionDirect_.push_back(direct);
            items.push_back({std::string(id) + ":" + std::to_string(items.size()), label});
        }
    };
    if (kind == domain::AdminItemKind::User)
    {
        add("users.update", L"Modifier les rôles et le profil");
        add("users.ban", L"Bannir"); add("users.unban", L"Débannir", {}, true);
        add("chat.ban", L"Révoquer l’accès au tchat");
        add("chat.unban", L"Rétablir l’accès au tchat", {}, true);
        add("users.delete", L"Supprimer", {}, true);
    }
    else if (kind == domain::AdminItemKind::ChatMessage)
    {
        add("chat.delete", L"Supprimer ce message", {}, true);
        add("chat.ban", L"Bannir cet utilisateur du tchat");
        add("chat.unban", L"Débannir cet utilisateur du tchat", {}, true);
    }
    else if (kind == domain::AdminItemKind::Contact)
    {
        add("contacts.reply", L"Répondre"); add("contacts.status", L"Changer le statut");
        add("contacts.handled", L"Marquer traité", {{"handled", true}}, true);
        add("contacts.delete", L"Supprimer", {}, true);
    }
    else if (kind == domain::AdminItemKind::BugReport)
    {
        add("bugs.get", L"Consulter", {}, true); add("bugs.comment", L"Ajouter un commentaire");
        add("bugs.comments", L"Voir les commentaires", {}, true);
        add("bugs.update", L"Modifier"); add("bugs.delete", L"Supprimer", {}, true);
        const auto current = contextItem_.value("status", std::string{});
        const std::pair<std::string_view, std::wstring_view> statuses[]{
            {"pending", L"En attente"}, {"in_progress", L"En cours"},
            {"to_test", L"À tester"}, {"done", L"Terminé"}, {"refused", L"Refusé"}};
        for (const auto& [status, label] : statuses)
            if (status != current)
                add("bugs.status", wxString(L"Passer en : ") + label.data(),
                    {{"status", status}}, true);
    }
    else if (kind == domain::AdminItemKind::Room)
    {
        add("rooms.join", L"Intégrer cette room");
        add("rooms.destroy", L"Détruire cette room", {{"confirm", true}}, true);
    }
    else if (kind == domain::AdminItemKind::Game)
    {
        const bool enabled = contextItem_.value("enabled", false);
        add("games.enable", enabled ? L"Désactiver" : L"Activer",
            {{"enabled", !enabled}}, true);
        add("games.update", L"Modifier les informations et paramètres");
        add("categories.assign", L"Attribuer une catégorie");
        if (contextItem_.value("gameType", std::string{}).find("mnemo") != std::string::npos)
            add("mnemo.categories", L"Gérer le quiz Mnémosyne", {}, true);
        add("games.reset", L"Réinitialiser les paramètres", {}, true);
    }
    else if (kind == domain::AdminItemKind::Category)
    {
        add("categories.update", L"Modifier"); add("categories.delete", L"Supprimer", {}, true);
    }
    else if (kind == domain::AdminItemKind::Bot)
    {
        const bool enabled = contextItem_.value("enabled", false);
        add("bots.update", enabled ? L"Désactiver" : L"Activer",
            {{"enabled", !enabled}}, true);
        add("bots.update", L"Renommer"); add("bots.delete", L"Supprimer", {}, true);
    }
    else if (kind == domain::AdminItemKind::Role)
    {
        add("roles.update", L"Modifier le rôle et ses permissions");
        add("roles.delete", L"Supprimer", {}, true);
    }
    else if (kind == domain::AdminItemKind::MnemoCategory)
    {
        add("mnemo.questions", L"Questions", {{"status", "pending"}}, true);
        add("mnemo.question.create", L"Ajouter une question");
        add("mnemo.category.update", L"Renommer");
        add("mnemo.category.delete", L"Supprimer", {}, true);
    }
    else if (kind == domain::AdminItemKind::MnemoQuestion)
    {
        add("mnemo.question.update", L"Modifier la question");
        add("mnemo.question.delete", L"Supprimer définitivement", {}, true);
    }
    else if (kind == domain::AdminItemKind::Sound)
    {
        const bool enabled = contextItem_.value("enabled", false);
        add("sounds.preview", L"Aperçu", {}, true);
        add("sounds.upload", L"Changer le son");
        add("sounds.enable", enabled ? L"Désactiver" : L"Activer",
            {{"enabled", !enabled}}, true);
        add("sounds.clear", L"Rétablir le son par défaut", {}, true);
    }
    if (items.empty())
    {
        FocusResultDetails();
        return;
    }
    commandsMenu_->SetItems(items);
    commandsMenu_->SetSelectedIndexSilently(0);
    showingItemActions_ = true;
    titleLabel_->SetLabel(wxString(domain::GetAdminAreas()[selectedSection_].label.data()) +
        L" — " + lila::shared::text::FromUtf8(ItemName(contextItem_)));
    SetStatus(L"Choisissez une action. Échap revient à la liste.");
    Layout();
    FocusCurrentMenu();
}

void AdminFrame::RestoreAreaFromItem()
{
    showingItemActions_ = false;
    contextItem_ = nlohmann::json::object();
    contextActionPayloads_.clear();
    contextActionDirect_.clear();
    const auto& area = domain::GetAdminAreas()[selectedSection_];
    visibleCommands_.clear();
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    for (const auto id : area.commandIds)
        if (const auto* command = domain::FindAdminCommand(id))
        {
            visibleCommands_.push_back(command);
            items.push_back({command->id, wxString(command->label)});
        }
    commandsMenu_->SetItems(items);
    titleLabel_->SetLabel(wxString(L"Administration — ") + wxString(area.label.data()));
    Layout();
    FocusResult();
}
}
