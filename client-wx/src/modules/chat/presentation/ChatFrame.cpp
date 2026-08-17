#include "modules/chat/presentation/ChatFrame.h"

#include <string>
#include <utility>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/AppConfig.h"
#include "shared/errors/ErrorMessages.h"

#include <wx/dialog.h>
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
    lila::modules::session::application::SessionStore& sessionStore,    CloseRequestedHandler onCloseRequested,
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
      sessionStore_(sessionStore),
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
    wxMessageDialog dialog(
        this,
        safeMessage,
        title.empty() ? wxString::FromUTF8(lila::shared::errors::ChatFrameHeader) : title,
        wxOK | wxICON_WARNING | wxSTAY_ON_TOP | wxCENTRE);
    dialog.SetEscapeId(wxID_OK);
    dialog.ShowModal();
}
}
