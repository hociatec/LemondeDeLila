#include "modules/options/presentation/OptionsView.h"
#include "modules/options/presentation/OptionsViewStateAdapter.h"

#include <wx/button.h>

namespace lila::modules::options::presentation
{
wxWindow* OptionsView::GetFirstSectionControl(std::size_t sectionIndex) const
{
    return OptionsViewStateAdapter::GetFirstSectionControl(*this, sectionIndex);
}

domain::OptionsState OptionsView::ReadState(const domain::OptionsState& baseState) const
{
    return OptionsViewStateAdapter::ReadState(*this, baseState);
}

void OptionsView::WriteState(const domain::OptionsState& state)
{
    OptionsViewStateAdapter::WriteState(*this, state);
}

void OptionsView::SetUnsavedChanges(bool hasUnsavedChanges)
{
    for (wxButton* saveButton : {generalSaveButton, soundsSaveButton, chatSaveButton})
    {
        if (saveButton != nullptr)
        {
            saveButton->Enable(hasUnsavedChanges);
        }
    }
}

void OptionsView::UpdateSoundControlInteractivity()
{
    OptionsViewStateAdapter::UpdateSoundControlInteractivity(*this);
}
}
