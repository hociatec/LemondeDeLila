#pragma once

#include <optional>

#include "modules/social/presentation/SocialSection.h"

class wxWindow;

namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::modules::social::presentation
{
class SocialDataStore;
class SocialNavigationState;
class SocialSelectionMemory;
class SocialView;

class SocialSectionPresenter final
{
public:
    SocialSectionPresenter(
        wxWindow& owner,
        SocialView& view,
        SocialDataStore& dataStore,
        SocialNavigationState& navigationState,
        SocialSelectionMemory& selectionMemory) noexcept;

    void PopulateSection(SocialSection section);
    void StoreSelection(SocialSection section);
    void RestoreSelection(lila::shared::ui::controls::VerticalMenu& list, SocialSection section);
    void ShowCurrentSection();
    void SyncProfileEditorVisibility();
    void SyncProfileControls();
    void SyncSectionActionVisibility();
    void SyncSelectionState();
    [[nodiscard]] std::optional<int> GetSelectedUserId() const;

private:
    void ShowOnlySectionPanel(wxWindow* targetPanel);

    wxWindow& owner_;
    SocialView& view_;
    SocialDataStore& dataStore_;
    SocialNavigationState& navigationState_;
    SocialSelectionMemory& selectionMemory_;
};
}
