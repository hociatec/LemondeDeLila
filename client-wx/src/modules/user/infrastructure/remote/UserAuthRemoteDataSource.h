#pragma once

#include <string>

#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::modules::user::infrastructure::remote
{
struct LoginRemotePayload
{
    std::string token;
    std::string refreshToken;
    std::string username;
    int userId = 0;
};

struct RegisterRemotePayload
{
    std::string message;
};

class UserAuthRemoteDataSource final
{
public:
    explicit UserAuthRemoteDataSource(shared::network::realtime::RealtimeApiClient& client);

    void WarmUp() const;
    [[nodiscard]] shared::network::realtime::RealtimeApiResponse Login(const std::string& username, const std::string& password) const;
    [[nodiscard]] shared::network::realtime::RealtimeApiResponse Refresh(
        const std::string& refreshToken,
        std::stop_token stopToken = {}) const;
    [[nodiscard]] shared::network::realtime::RealtimeApiResponse Logout(
        const std::string& refreshToken,
        std::stop_token stopToken = {}) const;
    [[nodiscard]] shared::network::realtime::RealtimeApiResponse Register(
        const std::string& username,
        const std::string& email,
        const std::string& password) const;
    [[nodiscard]] static LoginRemotePayload ParseLoginPayload(const shared::network::realtime::RealtimeApiResponse& response);
    [[nodiscard]] static RegisterRemotePayload ParseRegisterPayload(const shared::network::realtime::RealtimeApiResponse& response);

private:
    shared::network::realtime::RealtimeApiClient& client_;
};
}
