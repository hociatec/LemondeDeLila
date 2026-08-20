#include "modules/user/infrastructure/remote/UserAuthRemoteDataSource.h"

#include "modules/user/infrastructure/remote/UserAuthFields.h"
#include "shared/network/WsMessageTypes.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

#include <stdexcept>

namespace lila::modules::user::infrastructure::remote
{
namespace
{
using lila::shared::data::json::ReadOptionalString;
using lila::shared::data::json::EnsureObject;
}

UserAuthRemoteDataSource::UserAuthRemoteDataSource(shared::network::realtime::RealtimeApiClient& client)
    : client_(client)
{
}

shared::network::realtime::RealtimeApiResponse UserAuthRemoteDataSource::Login(
    const std::string& username,
    const std::string& password) const
{
    return client_.Send({
        .type = std::string(lila::shared::network::ws::types::auth::Login),
        .payload = {
            {std::string(lila::modules::user::infrastructure::remote::fields::Username), username},
            {std::string(lila::modules::user::infrastructure::remote::fields::Password), password}
        },
    });
}

shared::network::realtime::RealtimeApiResponse UserAuthRemoteDataSource::Register(
    const std::string& username,
    const std::string& email,
    const std::string& password) const
{
    return client_.Send({
        .type = std::string(lila::shared::network::ws::types::auth::Register),
        .payload = {
            {std::string(lila::modules::user::infrastructure::remote::fields::Username), username},
            {std::string(lila::modules::user::infrastructure::remote::fields::Email), email},
            {std::string(lila::modules::user::infrastructure::remote::fields::Password), password}
        },
    });
}

LoginRemotePayload UserAuthRemoteDataSource::ParseLoginPayload(const shared::network::realtime::RealtimeApiResponse& response)
{
    if (!response.success)
    {
        throw std::runtime_error(lila::shared::errors::LoginParseFailed);
    }

    EnsureObject(response.payload, lila::shared::errors::AuthResponsePayloadMustBeObject);

    LoginRemotePayload payload;
    payload.token = lila::shared::data::json::ReadRequiredString(
        response.payload,
        lila::modules::user::infrastructure::remote::fields::Token.data());
    payload.username = lila::shared::data::json::ReadRequiredString(
        response.payload,
        lila::modules::user::infrastructure::remote::fields::Username.data());
    payload.userId = lila::shared::data::json::ReadRequiredInteger(
        response.payload,
        lila::modules::user::infrastructure::remote::fields::UserId.data());
    return payload;
}

RegisterRemotePayload UserAuthRemoteDataSource::ParseRegisterPayload(const shared::network::realtime::RealtimeApiResponse& response)
{
    if (!response.success)
    {
        throw std::runtime_error(lila::shared::errors::RegisterParseFailed);
    }

    RegisterRemotePayload payload;
    if (response.payload.is_object())
    {
        payload.message = ReadOptionalString(response.payload, lila::modules::user::infrastructure::remote::fields::Message.data());
    }
    return payload;
}
}
