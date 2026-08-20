#pragma once
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

class wxWindow;
namespace lila::shared::ui::controls { class VerticalMenu; }
namespace lila::modules::social::presentation {
class SocialView final : public wxPanel {
public:
    struct ShellControls final {
        wxStaticText* titleLabel;
        wxStaticText* subtitleLabel;
        wxStaticText* statusLabel;
        lila::shared::ui::controls::VerticalMenu* menu;
        wxSimplebook* sectionBook;
    };
    struct SectionControls final {
        lila::shared::ui::controls::VerticalMenu* list;
        wxTextCtrl* emptyControl;
        lila::shared::ui::controls::VerticalMenu* actionsMenu;
    };
    struct ProfileControls final {
        wxStaticText* profileTitleLabel;
        wxTextCtrl* profileInfoCtrl;
        lila::shared::ui::controls::VerticalMenu* profileMenu;
        wxTextCtrl* profileBioCtrl;
        wxTextCtrl* profileVictoryCtrl;
        wxTextCtrl* profileDefeatCtrl;
        wxChoice* profileVisibilityChoice;
        wxButton* profileSaveButton;
        wxButton* profileCancelButton;
    };

    explicit SocialView(wxWindow* parent);
    void ApplyTheme();
    [[nodiscard]] ShellControls Shell() const noexcept;
    [[nodiscard]] SectionControls FriendsSection() const noexcept;
    [[nodiscard]] SectionControls IncomingSection() const noexcept;
    [[nodiscard]] SectionControls OutgoingSection() const noexcept;
    [[nodiscard]] SectionControls BlockedSection() const noexcept;
    [[nodiscard]] ProfileControls Profile() const noexcept;
    wxStaticText* titleLabel = nullptr;
    wxStaticText* subtitleLabel = nullptr;
    wxStaticText* statusLabel = nullptr;
    lila::shared::ui::controls::VerticalMenu* menu = nullptr;
    wxSimplebook* sectionBook = nullptr;
    wxPanel* friendsPanel = nullptr;
    wxPanel* incomingRequestsPanel = nullptr;
    wxPanel* outgoingRequestsPanel = nullptr;
    wxPanel* blockedPanel = nullptr;
    wxPanel* profilePanel = nullptr;
    lila::shared::ui::controls::VerticalMenu* friendsList = nullptr;
    wxTextCtrl* emptyFriendsCtrl = nullptr;
    lila::shared::ui::controls::VerticalMenu* friendsActionsMenu = nullptr;
    lila::shared::ui::controls::VerticalMenu* incomingRequestsList = nullptr;
    wxTextCtrl* emptyIncomingRequestsCtrl = nullptr;
    lila::shared::ui::controls::VerticalMenu* incomingActionsMenu = nullptr;
    lila::shared::ui::controls::VerticalMenu* outgoingRequestsList = nullptr;
    wxTextCtrl* emptyOutgoingRequestsCtrl = nullptr;
    lila::shared::ui::controls::VerticalMenu* outgoingActionsMenu = nullptr;
    lila::shared::ui::controls::VerticalMenu* blockedUsersList = nullptr;
    wxTextCtrl* emptyBlockedUsersCtrl = nullptr;
    lila::shared::ui::controls::VerticalMenu* blockedActionsMenu = nullptr;
    wxStaticText* profileTitleLabel = nullptr;
    wxTextCtrl* profileInfoCtrl = nullptr;
    lila::shared::ui::controls::VerticalMenu* profileMenu = nullptr;
    wxPanel* profileEditorMenuPanel = nullptr;
    wxPanel* profileBioEditorPanel = nullptr;
    wxPanel* profileVictoryEditorPanel = nullptr;
    wxPanel* profileDefeatEditorPanel = nullptr;
    wxPanel* profileVisibilityEditorPanel = nullptr;
    wxTextCtrl* profileBioCtrl = nullptr;
    wxTextCtrl* profileVictoryCtrl = nullptr;
    wxTextCtrl* profileDefeatCtrl = nullptr;
    wxChoice* profileVisibilityChoice = nullptr;
    wxButton* profileSaveButton = nullptr;
    wxButton* profileCancelButton = nullptr;
private:
    void BuildLayout();
    void BuildFriendsSection(wxWindow* parent);
    void BuildIncomingRequestsSection(wxWindow* parent);
    void BuildOutgoingRequestsSection(wxWindow* parent);
    void BuildBlockedSection(wxWindow* parent);
    void BuildProfileSection(wxWindow* parent);
};
}
