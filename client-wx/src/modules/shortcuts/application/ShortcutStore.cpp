#include "modules/shortcuts/application/ShortcutStore.h"
#include "shared/errors/domain/AppError.h"
#include "shared/logging/application/Logger.h"

namespace lila::modules::shortcuts::application
{
void ShortcutStore::Activate(int userId)
{
    const std::lock_guard lock(mutex_);
    if (owner_ != userId) { owner_ = userId; current_ = {}; }
}
domain::ShortcutSnapshot ShortcutStore::Current(int userId) const
{
    const std::lock_guard lock(mutex_);
    return owner_ == userId ? current_ : domain::ShortcutSnapshot{};
}
void ShortcutStore::Publish(int userId, const domain::ShortcutSnapshot& value)
{
    const std::lock_guard lock(mutex_);
    if (owner_ == userId) current_ = value;
}
domain::ShortcutSnapshot ShortcutStore::Load(int userId, std::stop_token stop)
{
    const std::lock_guard operation(operationMutex_);
    if (stop.stop_requested()) return Current(userId);
    auto cached = gateway_->Cached(userId);
    Publish(userId, cached);
    try
    {
        auto result = gateway_->Load(userId, stop);
        if (!stop.stop_requested()) Publish(userId, result);
        return result;
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogWarning("Shortcuts", error.what());
        return cached;
    }
}
domain::ShortcutSnapshot ShortcutStore::Save(int userId, domain::ShortcutSnapshot value, std::stop_token stop)
{
    const std::lock_guard operation(operationMutex_);
    if (stop.stop_requested()) return Current(userId);
    const auto error = domain::Validate(value.items);
    if (!error.empty()) throw lila::shared::errors::AppException(lila::shared::errors::ToAppError(error));
    auto result = gateway_->Save(userId, value, stop);
    if (!stop.stop_requested()) Publish(userId, result);
    return result;
}
}
