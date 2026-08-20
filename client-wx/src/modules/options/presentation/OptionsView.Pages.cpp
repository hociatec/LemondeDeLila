#include <wx/button.h>
#include <wx/event.h>
#include <wx/sizer.h>

#include "modules/options/presentation/OptionsView.h"
#include "modules/options/presentation/OptionsViewPagesBuilder.h"
#include "shared/accessibility/AccessibilityUtils.h"

namespace lila::modules::options::presentation
{
void OptionsView::BuildGeneralPage(wxWindow* parent)
{
    OptionsViewPagesBuilder::BuildGeneralPage(*this, parent);
}

void OptionsView::BuildSoundsPage(wxWindow* parent)
{
    OptionsViewPagesBuilder::BuildSoundsPage(*this, parent);
}

void OptionsView::BuildChatPage(wxWindow* parent)
{
    OptionsViewPagesBuilder::BuildChatPage(*this, parent);
}

void OptionsView::AddSectionSaveButton(wxWindow* parent, wxBoxSizer* sectionSizer)
{
    if (parent == nullptr || sectionSizer == nullptr)
    {
        return;
    }

    auto* sectionSaveButton = new wxButton(parent, wxID_ANY, wxString(L"Enregistrer"));
    sectionSizer->AddStretchSpacer();
    sectionSizer->Add(sectionSaveButton, 0, wxALIGN_RIGHT | wxTOP, 8);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionSaveButton, wxString(L"Enregistrer"));
    sectionSaveButtons.push_back(sectionSaveButton);

    sectionSaveButton->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            if (onSave_)
            {
                onSave_();
            }
        });
}
}
