namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

template <typename TPredicate>
void WaitUntil(TPredicate&& predicate, const char* failureMessage, int timeoutMs = 3000)
{
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);
    while (std::chrono::steady_clock::now() < deadline)
    {
        if (predicate())
        {
            return;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }

    Expect(false, failureMessage);
}

class InMemorySessionRepository final : public lila::modules::session::domain::ISessionRepository
{
public:
    [[nodiscard]] std::optional<lila::modules::session::domain::Session> Load() const override
    {
        return session_;
    }

    void Save(const lila::modules::session::domain::Session& session) override
    {
        session_ = session;
    }

    void Clear() override
    {
        session_.reset();
    }

private:
    std::optional<lila::modules::session::domain::Session> session_;
};

class BlockingSessionRefresher final
    : public lila::modules::session::application::ISessionRefresher
{
public:
    [[nodiscard]] lila::modules::session::application::SessionRefreshResult Refresh(
        const std::string&,
        std::stop_token stopToken) override
    {
        {
            std::scoped_lock lock(mutex_);
            started_ = true;
        }
        condition_.notify_all();

        std::unique_lock lock(mutex_);
        std::stop_callback cancelWait(stopToken, [this]() { condition_.notify_all(); });
        condition_.wait(lock, [this, stopToken]() {
            return released_ || stopToken.stop_requested();
        });
        if (stopToken.stop_requested())
        {
            return {};
        }

        lila::modules::session::application::SessionRefreshResult result;
        result.success = true;
        result.token = "new-header.new-payload.new-signature";
        result.refreshToken = "rotated-refresh-token";
        result.expiresAt = 4102444800LL;
        return result;
    }

    [[nodiscard]] bool Revoke(
        const std::string& refreshToken,
        std::stop_token = {}) override
    {
        std::scoped_lock lock(mutex_);
        revokedTokens_.push_back(refreshToken);
        return true;
    }

    void WaitUntilStarted()
    {
        std::unique_lock lock(mutex_);
        if (!condition_.wait_for(
                lock,
                std::chrono::seconds(2),
                [this]() { return started_; }))
        {
            throw std::runtime_error("Timed out waiting for session refresh.");
        }
    }

    void Release()
    {
        {
            std::scoped_lock lock(mutex_);
            released_ = true;
        }
        condition_.notify_all();
    }

    [[nodiscard]] bool WasRevoked(const std::string& refreshToken) const
    {
        std::scoped_lock lock(mutex_);
        return std::find(revokedTokens_.begin(), revokedTokens_.end(), refreshToken)
            != revokedTokens_.end();
    }

private:
    mutable std::mutex mutex_;
    std::condition_variable condition_;
    bool started_ = false;
    bool released_ = false;
    std::vector<std::string> revokedTokens_;
};

class RejectingSessionRefresher final
    : public lila::modules::session::application::ISessionRefresher
{
public:
    [[nodiscard]] lila::modules::session::application::SessionRefreshResult Refresh(
        const std::string&,
        std::stop_token = {}) override
    {
        lila::modules::session::application::SessionRefreshResult result;
        result.rejected = true;
        result.errorMessage = "Refresh token invalide ou expire";
        return result;
    }

    [[nodiscard]] bool Revoke(const std::string&, std::stop_token = {}) override
    {
        return true;
    }
};
