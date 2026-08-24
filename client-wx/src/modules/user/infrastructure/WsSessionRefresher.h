#pragma once

#include "modules/session/application/ISessionRefresher.h"

namespace lila::modules::user::infrastructure::remote
{
class UserAuthRemoteDataSource;
}

namespace lila::modules::user::infrastructure
{
class WsSessionRefresher final : public session::application::ISessionRefresher
{
public:
    explicit WsSessionRefresher(remote::UserAuthRemoteDataSource& remoteDataSource);

    [[nodiscard]] session::application::SessionRefreshResult Refresh(
        const std::string& refreshToken,
        std::stop_token stopToken = {}) override;
    [[nodiscard]] bool Revoke(
        const std::string& refreshToken,
        std::stop_token stopToken = {}) override;

private:
    remote::UserAuthRemoteDataSource& remoteDataSource_;
};
}
