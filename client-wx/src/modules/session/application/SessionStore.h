#pragma once

#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <stop_token>
#include <string>

#include "modules/session/application/ISessionRefresher.h"
#include "modules/session/domain/ISessionRepository.h"
#include "modules/session/domain/Session.h"

namespace lila::shared::concurrency
{
class BackgroundTaskHandle;
}

namespace lila::modules::session::application
{
struct SessionRefreshStats final
{
    bool inProgress = false;
    std::size_t waitingCallers = 0;
};

class SessionStore final
{
public:
    explicit SessionStore(
        std::unique_ptr<domain::ISessionRepository> repository,
        std::unique_ptr<ISessionRefresher> refresher = {});

    // Returns whether the session was persisted. A local persistence failure
    // must never turn a successful server login into an application failure.
    bool Open(domain::Session session, bool persist);
    void Clear();
    void SetSessionExpiredHandler(std::function<void()> handler);
    [[nodiscard]] std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle>
        LogoutAsync(std::function<void()> completion = {});
    [[nodiscard]] std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle>
        RevokeTransientSessionAsync(std::function<void()> completion = {});
    [[nodiscard]] bool Restore();
    [[nodiscard]] bool PrepareUpdateRestart();

    [[nodiscard]] bool HasActiveSession() const;
    [[nodiscard]] std::string AccessToken(std::stop_token stopToken = {});
    [[nodiscard]] std::string RefreshAccessToken(std::stop_token stopToken = {});
    [[nodiscard]] domain::Session Current() const;
    [[nodiscard]] std::optional<domain::Session> TryCurrent() const;
    [[nodiscard]] bool IsPersistent() const;
    [[nodiscard]] SessionRefreshStats RefreshStats() const;

private:
    [[nodiscard]] bool HasSessionLocked() const;
    [[nodiscard]] std::string DetachSession(bool onlyIfTransient);
    [[nodiscard]] std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle>
        ScheduleRevocation(std::string refreshToken, std::function<void()> completion);

    std::unique_ptr<domain::ISessionRepository> repository_;
    std::unique_ptr<ISessionRefresher> refresher_;
    mutable std::mutex mutex_;
    std::condition_variable_any refreshCondition_;
    domain::Session current_;
    bool persisted_ = false;
    bool refreshInProgress_ = false;
    std::size_t refreshWaiters_ = 0;
    std::uint64_t generation_ = 0;
    std::uint64_t lastSuccessfulRefreshGeneration_ = 0;
    std::function<void()> sessionExpiredHandler_;
};
}
