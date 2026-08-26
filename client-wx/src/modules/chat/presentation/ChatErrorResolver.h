#pragma once

#include <optional>
#include <string>

#include "modules/chat/domain/ChatServerError.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "modules/chat/domain/ChatErrorMessages.h"
#include "shared/errors/presentation/ErrorFormatting.h"
#include "shared/text/domain/StringUtils.h"

namespace lila::modules::chat::presentation
{
class ChatErrorResolver final
{
public:
    [[nodiscard]] static std::string Resolve(
        const std::string& baseMessage,
        const std::optional<domain::ChatServerError>& serverError)
    {
        const auto trimmedBase = lila::shared::text::TrimCopy(baseMessage);
        const auto serverMessage = BuildServerMessage(serverError);
        const bool baseContainsUnexpected =
            trimmedBase.find(lila::shared::errors::UnexpectedError) != std::string::npos;
        const bool isBaseUnhelpful = trimmedBase.empty() || baseContainsUnexpected
            || trimmedBase == lila::shared::errors::UnexpectedError
            || trimmedBase == lila::shared::errors::ChatErrorMessage;

        if (!serverMessage.empty() && isBaseUnhelpful)
        {
            return lila::shared::errors::WithDetails(
                lila::shared::errors::ChatConnectionFailed,
                serverMessage);
        }

        const bool startsWithConnectionFailure =
            trimmedBase.rfind(lila::shared::errors::ChatConnectionFailed, 0) == 0
            || trimmedBase.rfind(lila::shared::errors::ChatReconnectionInterrupted, 0) == 0;
        if (!serverMessage.empty() && startsWithConnectionFailure)
        {
            return lila::shared::errors::WithDetails(
                lila::shared::errors::ChatConnectionFailed,
                serverMessage);
        }

        if (!isBaseUnhelpful)
        {
            return trimmedBase;
        }

        return serverMessage.empty()
            ? trimmedBase
            : lila::shared::errors::WithDetails(
                lila::shared::errors::ChatConnectionFailed,
                serverMessage);
    }

private:
    [[nodiscard]] static std::string BuildServerMessage(
        const std::optional<domain::ChatServerError>& serverError)
    {
        if (!serverError.has_value())
        {
            return {};
        }

        const auto message = lila::shared::text::TrimCopy(serverError->message);
        const auto reason = lila::shared::text::TrimCopy(serverError->reason);
        if (message.empty())
        {
            return reason;
        }
        if (reason.empty())
        {
            return message;
        }
        return message + " : " + reason;
    }
};
}
