#include "modules/options/application/OptionsStore.h"
#include "shared/errors/ErrorMessages.h"

#include <stdexcept>
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
    current_ = repository_->Load();
}

const domain::OptionsState& OptionsStore::Current() const
{
    return current_;
}

void OptionsStore::Apply(const domain::OptionsState& state)
{
    current_ = state;
    current_.Normalize();
}

void OptionsStore::Update(domain::OptionsState state)
{
    state.Normalize();
    repository_->Save(state);
    current_ = state;
}
}
