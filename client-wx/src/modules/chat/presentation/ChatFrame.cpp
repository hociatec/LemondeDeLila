#include "modules/chat/presentation/ChatFrame.h"

#include <utility>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/config/AppConfig.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/ui/Theme.h"

#include <wx/button.h>
#include <wx/dialog.h>
#include <wx/sizer.h>
#include <wx/textctrl.h>

namespace
{
constexpr int WindowWidth = 1100;
constexpr int WindowHeight = 760;
}

namespace lila::modules::chat::presentation
{
ChatFrame::ChatFrame(
    lila::modules::chat::application::ChatService& chatService,
    lila::modules::options::application::OptionsStore& optionsStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              wxString::FromUTF8(lila::shared::errors::ChatFrameTitle),
              wxString::FromUTF8(shared::config::AppConfig::AppTitle.data())),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      chatService_(chatService),
      optionsStore_(optionsStore),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    BuildLayout();
    ApplyTheme();
    BindEvents();

    chatService_.SetStatusChangedHandler(
        [this](const std::string& message, bool isError)
        {
            CallAfter(
                [this, message, isError]()
                {
                    UpdateStatus(wxString::FromUTF8(message), isError);
                    SyncActionState();
                });
        });
    chatService_.SetMessagesChangedHandler(
        [this]()
        {
            CallAfter(
                [this]()
                {
                    RefreshHistory();
                });
        });

    CentreOnScreen();
    CallAfter(
        [this]()
        {
            OpenChat();
        });
}

ChatFrame::~ChatFrame()
{
    InvalidateOpenChatRequest();
    chatService_.SetStatusChangedHandler({});
    chatService_.SetMessagesChangedHandler({});
}

void ChatFrame::InvalidateOpenChatRequest()
{
    ++activeOpenChatRequestId_;
}

void ChatFrame::RequestCloseToSession()
{
    isReturningToSession_ = true;
    if (onCloseRequested_)
    {
        onCloseRequested_();
    }
}

void ChatFrame::ShowAccessibleErrorDialog(const wxString& message, const wxString& title)
{
    const wxString safeMessage = message.empty()
        ? wxString::FromUTF8(lila::shared::errors::UnexpectedError)
        : message;
    wxDialog dialog(
        this,
        wxID_ANY,
        title.empty() ? wxString::FromUTF8(lila::shared::errors::ChatFrameHeader) : title,
        wxDefaultPosition,
        wxSize(420, 180),
        wxDEFAULT_DIALOG_STYLE | wxSTAY_ON_TOP);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    auto* messageCtrl = new wxTextCtrl(
        &dialog,
        wxID_ANY,
        safeMessage,
        wxDefaultPosition,
        wxSize(380, 120),
        wxTE_MULTILINE | wxTE_READONLY | wxTE_WORDWRAP);
    messageCtrl->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    messageCtrl->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    auto* closeButton = new wxButton(&dialog, wxID_OK, wxString(L"OK"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *messageCtrl,
        title.empty() ? wxString::FromUTF8(lila::shared::errors::ChatFrameHeader) : title,
        safeMessage);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *closeButton,
        wxString(L"OK"));
    rootSizer->Add(messageCtrl, 1, wxEXPAND | wxALL, 16);
    rootSizer->Add(closeButton, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 16);
    dialog.SetSizerAndFit(rootSizer);
    messageCtrl->SetFocus();
    dialog.ShowModal();
}
}
