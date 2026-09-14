#include <algorithm>
#include <cassert>
#include <stdexcept>

#include <nlohmann/json.hpp>

#include "modules/admin/domain/AdminCommand.h"
#include "modules/admin/domain/AdminFormMetadata.h"
#include "modules/admin/infrastructure/AdminPayloadValidator.h"
#include "modules/admin/presentation/AdminResultFormatter.h"
#include "shared/network/application/http/AuthenticatedHttpClient.h"

int main()
{
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

    for (const auto& command : lila::modules::admin::domain::GetAdminCommands())
    {
        const auto form = nlohmann::json::parse(command.payloadTemplate);
        assert(form.is_object());
        for (const auto& field : form.items())
        {
            const auto metadata = lila::modules::admin::domain::GetAdminFieldMetadata(
                command.id, field.key());
            assert(!metadata.label.empty());
            assert(metadata.label != std::wstring(field.key().begin(), field.key().end()));
            if (metadata.kind == lila::modules::admin::domain::AdminFieldKind::Choice)
            {
                assert(!metadata.choices.empty());
                assert(field.value().is_string());
                assert(std::find(metadata.choices.begin(), metadata.choices.end(),
                    field.value().get<std::string>()) != metadata.choices.end());
            }
        }
    }
    const auto optionalUsername = lila::modules::admin::domain::GetAdminFieldMetadata(
        "users.update", "username");
    assert(optionalUsername.optional);
    assert(!optionalUsername.includedByDefault);

    const auto userStatus = lila::modules::admin::domain::GetAdminFieldMetadata(
        "users.list", "status");
    assert(userStatus.choices == std::vector<std::string>({"all", "active", "banned"}));
    const auto bugStatus = lila::modules::admin::domain::GetAdminFieldMetadata(
        "bugs.status", "status");
    assert(bugStatus.choices ==
        std::vector<std::string>({"pending", "in_progress", "to_test", "done", "refused"}));
    const auto mnemoStatus = lila::modules::admin::domain::GetAdminFieldMetadata(
        "mnemo.question.update", "status");
    assert(mnemoStatus.choices ==
        std::vector<std::string>({"validated", "pending", "to_edit", "trash"}));

    const auto formatted = lila::modules::admin::presentation::FormatAdminResult({
        {"users", {{{"id", 7}, {"username", "Lila"}, {"enabled", true}}}},
    });
    assert(formatted.find("Utilisateurs") != std::string::npos);
    assert(formatted.find("Lila") != std::string::npos);
    assert(formatted.find("Oui") != std::string::npos);
}
