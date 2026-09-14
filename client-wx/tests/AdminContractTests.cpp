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

    bool rejected = false;
    try
    {
        static_cast<void>(ValidateAndNormalizeAdminPayload(nlohmann::json::array()));
    }
    catch (const std::runtime_error&)
    {
        rejected = true;
    }
    assert(rejected);

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
            if (metadata.kind == lila::modules::admin::domain::AdminFieldKind::Choice)
                assert(!metadata.choices.empty());
        }
    }
    const auto optionalUsername = lila::modules::admin::domain::GetAdminFieldMetadata(
        "users.update", "username");
    assert(optionalUsername.optional);
    assert(!optionalUsername.includedByDefault);

    const auto formatted = lila::modules::admin::presentation::FormatAdminResult({
        {"users", {{{"id", 7}, {"username", "Lila"}, {"enabled", true}}}},
    });
    assert(formatted.find("Utilisateurs") != std::string::npos);
    assert(formatted.find("Lila") != std::string::npos);
    assert(formatted.find("Oui") != std::string::npos);
}
