#include <algorithm>
#include <cassert>
#include <stdexcept>
#include <unordered_set>

#include <nlohmann/json.hpp>

#include "modules/admin/domain/AdminCommand.h"
#include "modules/admin/domain/AdminFormMetadata.h"
#include "modules/admin/infrastructure/AdminPayloadValidator.h"
#include "modules/admin/presentation/AdminResultFormatter.h"
#include "shared/network/application/http/AuthenticatedHttpClient.h"

int main()
{
    using lila::modules::admin::domain::GetAdminCommands;
    using lila::modules::admin::infrastructure::ValidateAndNormalizeAdminPayload;
    auto normalized = ValidateAndNormalizeAdminPayload({
        {"items", {{{"id", "report-1"}, {"status", "rejected"}}}},
    });
    assert(normalized["items"][0]["status"] == "refused");

    const auto normalizedList = ValidateAndNormalizeAdminPayload(
        nlohmann::json::array({{{"id", 1}, {"status", "rejected"}}}));
    assert(normalizedList.is_array());
    assert(normalizedList[0]["status"] == "refused");

    assert(lila::shared::network::http::UrlEncode("Table Ambiance/1") ==
        "Table%20Ambiance%2F1");

    const auto findCommand = [](std::string_view id) -> const auto&
    {
        const auto& commands = GetAdminCommands();
        const auto found = std::find_if(commands.begin(), commands.end(),
            [id](const auto& command) { return command.id == id; });
        assert(found != commands.end());
        return *found;
    };
    std::unordered_set<std::string> commandIds;
    for (const auto& command : GetAdminCommands())
    {
        assert(commandIds.insert(command.id).second);
        assert(!command.label.empty());
        assert(!command.description.empty());
        assert(!command.operation.empty());
        const auto form = nlohmann::json::parse(command.payloadTemplate);
        assert(form.is_object());
        std::size_t placeholder = command.operation.find('{');
        while (placeholder != std::string::npos)
        {
            const auto end = command.operation.find('}', placeholder + 1);
            assert(end != std::string::npos);
            const auto field = command.operation.substr(
                placeholder + 1, end - placeholder - 1);
            assert(form.contains(field));
            placeholder = command.operation.find('{', end + 1);
        }
        for (const auto& field : form.items())
        {
            const auto metadata = lila::modules::admin::domain::GetAdminFieldMetadata(
                command.id, field.key());
            assert(!metadata.label.empty());
            assert(metadata.label != std::wstring(field.key().begin(), field.key().end()));
            if (metadata.kind == lila::modules::admin::domain::AdminFieldKind::Choice)
            {
                assert(!metadata.choices.empty());
                assert(metadata.choiceLabels.size() == metadata.choices.size());
                assert(field.value().is_string());
                assert(std::find(metadata.choices.begin(), metadata.choices.end(),
                    field.value().get<std::string>()) != metadata.choices.end());
            }
        }
    }
    assert(commandIds.size() == GetAdminCommands().size());
    for (const auto& id : {
             "users.delete", "chat.clear", "contacts.delete", "bugs.delete",
             "rooms.destroy", "rooms.cleanup", "games.reset", "categories.delete",
             "bots.delete", "mnemo.category.delete", "mnemo.question.delete",
             "roles.delete", "settings.stats.reset", "sounds.cleanup",
             "maintenance.deploy", "maintenance.restart"})
        assert(findCommand(id).dangerous);
    for (const auto& command : GetAdminCommands())
        if (command.id.starts_with("maintenance.")) assert(command.maintenanceToken);
    const auto optionalUsername = lila::modules::admin::domain::GetAdminFieldMetadata(
        "users.update", "username");
    assert(optionalUsername.optional);
    assert(!optionalUsername.includedByDefault);

    const auto userStatus = lila::modules::admin::domain::GetAdminFieldMetadata(
        "users.list", "status");
    assert(userStatus.choices == std::vector<std::string>({"all", "active", "banned"}));
    assert(userStatus.choiceLabels ==
        std::vector<std::wstring>({L"Tous", L"Actifs", L"Bannis"}));
    const auto bugStatus = lila::modules::admin::domain::GetAdminFieldMetadata(
        "bugs.status", "status");
    assert(bugStatus.choices ==
        std::vector<std::string>({"pending", "in_progress", "to_test", "done", "refused"}));
    const auto mnemoStatus = lila::modules::admin::domain::GetAdminFieldMetadata(
        "mnemo.question.update", "status");
    assert(mnemoStatus.choices ==
        std::vector<std::string>({"validated", "pending", "to_edit", "trash"}));

    const auto userCreate = nlohmann::json::parse(findCommand("users.create").payloadTemplate);
    assert(userCreate.contains("password"));
    assert(userCreate.contains("avatar"));
    const auto userList = nlohmann::json::parse(findCommand("users.list").payloadTemplate);
    assert(userList.contains("role"));
    assert(userList.contains("createdAfter"));
    assert(userList.contains("createdBefore"));
    const auto userBan = nlohmann::json::parse(findCommand("users.ban").payloadTemplate);
    assert(userBan.contains("durationDays"));
    assert(userBan.contains("bannedUntil"));
    assert(lila::modules::admin::domain::GetAdminFieldMetadata(
        "users.ban", "durationDays").optional);
    assert(lila::modules::admin::domain::GetAdminFieldMetadata(
        "users.ban", "bannedUntil").optional);

    const auto gamesUpdate = nlohmann::json::parse(findCommand("games.update").payloadTemplate);
    assert(gamesUpdate.contains("enabled"));
    assert(gamesUpdate.contains("rules"));
    const auto rolesUpdate = nlohmann::json::parse(findCommand("roles.update").payloadTemplate);
    assert(rolesUpdate.contains("newName"));

    const auto questionFilters = nlohmann::json::parse(
        findCommand("mnemo.questions").payloadTemplate);
    assert(questionFilters.contains("categoryId"));
    assert(questionFilters.contains("status"));
    assert(lila::modules::admin::domain::GetAdminFieldMetadata(
        "mnemo.questions", "categoryId").optional);
    assert(lila::modules::admin::domain::GetAdminFieldMetadata(
        "mnemo.questions", "status").optional);

    const auto missingUsername = lila::modules::admin::domain::ValidateAdminFormPayload(
        "users.create", {{"email", "admin@example.test"}, {"username", "   "}});
    assert(missingUsername.has_value());
    assert(missingUsername->field == "username");
    const auto invalidAnswers = lila::modules::admin::domain::ValidateAdminFormPayload(
        "mnemo.question.create",
        {{"categoryId", "general"}, {"question", "Question ?"},
         {"answers", {"Une", "Deux", "Trois"}}, {"correctIndex", 0}});
    assert(invalidAnswers.has_value());
    assert(invalidAnswers->field == "answers");
    const auto invalidPlayerRange = lila::modules::admin::domain::ValidateAdminFormPayload(
        "games.update", {{"gameType", "jeu"}, {"minPlayers", 8}, {"maxPlayers", 2}});
    assert(invalidPlayerRange.has_value());
    assert(invalidPlayerRange->field == "maxPlayers");
    assert(!lila::modules::admin::domain::ValidateAdminFormPayload(
        "games.update", {{"gameType", "jeu"}, {"minPlayers", 2}, {"maxPlayers", 8}}));
    assert(!lila::modules::admin::domain::ValidateAdminFormPayload(
        "sounds.upload", {{"soundId", "ChatMessageSent"}, {"filePath", ""}}));

    const auto formatted = lila::modules::admin::presentation::FormatAdminResult({
        {"users", {{{"id", 7}, {"username", "Lila"}, {"enabled", true}}}},
    });
    assert(formatted.find("Utilisateurs") != std::string::npos);
    assert(formatted.find("Lila") != std::string::npos);
    assert(formatted.find("Oui") != std::string::npos);

    const auto userPresentation =
        lila::modules::admin::presentation::BuildAdminResultPresentation({
            {"total", 2},
            {"users", {
                {{"id", 7}, {"username", "Lila"}},
                {{"id", 8}, {"username", "Milo"}},
            }},
        });
    assert(userPresentation.summary == "Utilisateurs : 2 éléments.");
    assert(userPresentation.entries.size() == 2);
    assert(userPresentation.entries[0].label == "1. Lila");
    assert(userPresentation.entries[1].details.find("Milo") != std::string::npos);
    assert(userPresentation.details == userPresentation.entries[0].details);

    const auto emptyPresentation =
        lila::modules::admin::presentation::BuildAdminResultPresentation({
            {"rooms", nlohmann::json::array()},
        });
    assert(emptyPresentation.summary == "Salles : 0 élément.");
    assert(emptyPresentation.entries.empty());
    assert(emptyPresentation.details == "La liste est vide.");

    const auto directListPresentation =
        lila::modules::admin::presentation::BuildAdminResultPresentation(
            nlohmann::json::array({"alpha", "beta"}));
    assert(directListPresentation.summary == "Résultats : 2 éléments.");
    assert(directListPresentation.entries[0].label == "1. alpha");

    const auto scalarPresentation =
        lila::modules::admin::presentation::BuildAdminResultPresentation(true);
    assert(scalarPresentation.entries.empty());
    assert(scalarPresentation.details == "Oui\n");

    const auto translatedStatus =
        lila::modules::admin::presentation::FormatAdminResult({
            {"status", "in_progress"},
        });
    assert(translatedStatus.find("En cours") != std::string::npos);
}
