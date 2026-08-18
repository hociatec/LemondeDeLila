#pragma once
#include <wx/panel.h>

class wxButton;
class wxListBox;
class wxSimplebook;
class wxStaticText;
class wxTextCtrl;

namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::modules::messaging::presentation
{
class MessagingView final : public wxPanel
{
public:
    explicit MessagingView(wxWindow* parent);
    void ApplyTheme();

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
