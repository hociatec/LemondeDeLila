#include "modules/options/application/OptionsStore.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/encoding/Encoding.h"

#include <stdexcept>
#include <mutex>
#include <utility>

namespace lila::modules::options::application
{
OptionsStore::OptionsStore(std::unique_ptr<domain::IOptionsRepository> repository)
    : repository_(std::move(repository))
{
    if (repository_ == nullptr)
    {
        throw std::invalid_argument(lila::shared::errors::InvalidOptionsRepository);
    }
}

void OptionsStore::Load()
{
    auto loaded = repository_->Load();
    loaded.Normalize();
    const bool repairBrokenAccents = loaded.repairBrokenAccents;
    {
        std::unique_lock lock(mutex_);
        current_ = std::move(loaded);
        revision_.fetch_add(1, std::memory_order_release);
    }
    lila::shared::text::SetBrokenAccentRepairEnabled(repairBrokenAccents);
}

domain::OptionsState OptionsStore::Current() const
{
    std::shared_lock lock(mutex_);
    return current_;
}

std::uint64_t OptionsStore::Revision() const noexcept
{
    return revision_.load(std::memory_order_acquire);
}

void OptionsStore::Apply(const domain::OptionsState& state)
{
    auto normalized = state;
    normalized.Normalize();
    const bool repairBrokenAccents = normalized.repairBrokenAccents;
    {
        std::unique_lock lock(mutex_);
        current_ = std::move(normalized);
        revision_.fetch_add(1, std::memory_order_release);
    }
    lila::shared::text::SetBrokenAccentRepairEnabled(repairBrokenAccents);
}

void OptionsStore::Update(domain::OptionsState state)
{
    state.Normalize();
    repository_->Save(state);
    const bool repairBrokenAccents = state.repairBrokenAccents;
    {
        std::unique_lock lock(mutex_);
        current_ = std::move(state);
        revision_.fetch_add(1, std::memory_order_release);
    }
    lila::shared::text::SetBrokenAccentRepairEnabled(repairBrokenAccents);
}
}
