#include "modules/user/infrastructure/remote/UserAuthRemoteDataSource.h"

#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

#include <stdexcept>

namespace lila::modules::user::infrastructure::remote
{
namespace
{
using lila::shared::data::json::ReadOptionalInteger;
using lila::shared::data::json::ReadOptionalString;
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
        .type = std::string(lila::shared::contracts::user::AuthLoginEvent),
        .payload = {
            {std::string(lila::shared::contracts::user::UsernameField), username},
            {std::string(lila::shared::contracts::user::PasswordField), password}
        },
    });
}

shared::network::realtime::RealtimeApiResponse UserAuthRemoteDataSource::Register(
    const std::string& username,
    const std::string& email,
    const std::string& password) const
{
    return client_.Send({
        .type = std::string(lila::shared::contracts::user::AuthRegisterEvent),
        .payload = {
            {std::string(lila::shared::contracts::user::UsernameField), username},
            {std::string(lila::shared::contracts::user::EmailField), email},
            {std::string(lila::shared::contracts::user::PasswordField), password}
        },
    });
}

LoginRemotePayload UserAuthRemoteDataSource::ParseLoginPayload(const shared::network::realtime::RealtimeApiResponse& response)
{
    if (!response.success)
    {
        throw std::runtime_error(lila::shared::errors::LoginParseFailed);
    }

    if (!response.payload.is_object())
    {
        throw std::runtime_error(lila::shared::errors::AuthResponsePayloadMustBeObject);
    }

    LoginRemotePayload payload;
    payload.token = ReadOptionalString(response.payload, lila::shared::contracts::user::TokenField.data());
    payload.username = ReadOptionalString(response.payload, lila::shared::contracts::user::UsernameField.data());
    payload.userId = ReadOptionalInteger(response.payload, lila::shared::contracts::user::UserIdField.data());
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
        payload.message = ReadOptionalString(response.payload, lila::shared::contracts::user::MessageField.data());
    }
    return payload;
}
}
