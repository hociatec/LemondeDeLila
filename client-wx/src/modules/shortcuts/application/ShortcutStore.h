#pragma once
#include <memory>
#include <mutex>
#include "modules/shortcuts/application/IShortcutGateway.h"
namespace lila::modules::shortcuts::application
{
class ShortcutStore final
{
public:
    explicit ShortcutStore(std::unique_ptr<IShortcutGateway> gateway) : gateway_(std::move(gateway)) {}
    void Activate(int userId);
    [[nodiscard]] domain::ShortcutSnapshot Current(int userId) const;
    domain::ShortcutSnapshot Load(int userId, std::stop_token stop);
    domain::ShortcutSnapshot Save(int userId, domain::ShortcutSnapshot value, std::stop_token stop);
private:
    void Publish(int userId, const domain::ShortcutSnapshot& value);
    std::unique_ptr<IShortcutGateway> gateway_;
    mutable std::mutex mutex_;
    std::mutex operationMutex_;
    int owner_ = 0;
    domain::ShortcutSnapshot current_;
};
}
