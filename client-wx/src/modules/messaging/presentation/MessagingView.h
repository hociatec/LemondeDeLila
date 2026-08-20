#pragma once
#include <wx/listbox.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

class wxButton;

namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::modules::messaging::presentation
{
class MessagingView final : public wxPanel
{
public:
    struct ShellControls final
    {
        wxStaticText* statusLabel;
        lila::shared::ui::controls::VerticalMenu* menu;
        wxSimplebook* screenBook;
    };

    struct ListControls final
    {
        wxStaticText* listTitleLabel;
        wxListBox* messagesList;
        wxTextCtrl* emptyMessagesCtrl;
    };

    struct DetailControls final
    {
        wxTextCtrl* detailCtrl;
        wxButton* replyButton;
        wxButton* deleteButton;
        wxButton* restoreButton;
        wxButton* purgeButton;
    };

    struct ComposeControls final
    {
        wxTextCtrl* recipientCtrl;
        wxTextCtrl* subjectCtrl;
        wxTextCtrl* bodyCtrl;
        wxButton* sendComposeButton;
        wxButton* cancelComposeButton;
    };

    explicit MessagingView(wxWindow* parent);
    void ApplyTheme();
    [[nodiscard]] ShellControls Shell() const noexcept;
    [[nodiscard]] ListControls List() const noexcept;
    [[nodiscard]] DetailControls Detail() const noexcept;
    [[nodiscard]] ComposeControls Compose() const noexcept;

    wxStaticText* statusLabel = nullptr;
    lila::shared::ui::controls::VerticalMenu* menu = nullptr;
    wxSimplebook* screenBook = nullptr;
    wxPanel* menuPanel = nullptr;
    wxPanel* listPanel = nullptr;
    wxPanel* detailPanel = nullptr;
    wxPanel* composePanel = nullptr;
    wxStaticText* listTitleLabel = nullptr;
    wxListBox* messagesList = nullptr;
    wxTextCtrl* emptyMessagesCtrl = nullptr;
    wxTextCtrl* detailCtrl = nullptr;
    wxButton* replyButton = nullptr;
    wxButton* deleteButton = nullptr;
    wxButton* restoreButton = nullptr;
    wxButton* purgeButton = nullptr;
    wxTextCtrl* recipientCtrl = nullptr;
    wxTextCtrl* subjectCtrl = nullptr;
    wxTextCtrl* bodyCtrl = nullptr;
    wxButton* sendComposeButton = nullptr;
    wxButton* cancelComposeButton = nullptr;

private:
    void BuildLayout();
    wxPanel* BuildHeader();
    void BuildMenuScreen();
    void BuildListScreen();
    void BuildDetailScreen();
    void BuildComposeScreen();
};
}
