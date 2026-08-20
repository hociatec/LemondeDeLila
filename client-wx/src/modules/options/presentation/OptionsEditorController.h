#pragma once

#include "modules/options/application/OptionsStore.h"
#include "modules/options/presentation/OptionsEditSession.h"

namespace lila::modules::options::presentation
{
class OptionsEditorController final
{
public:
    explicit OptionsEditorController(application::OptionsStore& store) noexcept
        : store_(store)
    {
    }

    [[nodiscard]] domain::OptionsState Load()
    {
        const auto state = store_.Current();
        session_.CaptureInitial(state);
        return state;
    }

    [[nodiscard]] domain::OptionsState BaseState() const
    {
        return store_.Current();
    }

    void Save(const domain::OptionsState& state)
    {
        store_.Update(state);
        session_.CaptureInitial(state);
    }

    [[nodiscard]] const domain::OptionsState& CancelState() const noexcept
    {
        return session_.initialState;
    }

    [[nodiscard]] bool HasUnsavedChanges(const domain::OptionsState& current) const noexcept
    {
        return session_.HasUnsavedChanges(current);
    }

private:
    application::OptionsStore& store_;
    OptionsEditSession session_;
};
}
