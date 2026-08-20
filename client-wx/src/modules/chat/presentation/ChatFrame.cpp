#include "shared/text/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/chat/presentation/ChatFocusController.h"

#include <string>
#include <utility>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/AppConfig.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"
#include "shared/concurrency/BackgroundExecutor.h"

#include <wx/dialog.h>
#include <wx/msgdlg.h>
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
    lila::modules::session::application::SessionStore& sessionStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameTitle),
              lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data()).wc_str()),
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
    focusController_ = std::make_unique<ChatFocusController>(
        *inputCtrl_, *historyList_, *emptyHistoryCtrl_, *editMessageButton_, *deleteMessageButton_);
    BindEvents();

    eventHandlers_ = std::make_shared<application::ChatService::EventHandlers>();
    eventHandlers_->onStatusChanged =
        [this](const std::string& message, bool isError)
        {
            CallAfter(
                [this, message, isError]()
                {
                    UpdateStatus(lila::shared::text::FromUtf8(message), isError);
                    SyncActionState();
                });
        };
    eventHandlers_->onMessagesChanged =
        [this]()
        {
            CallAfter(
                [this]()
                {
                    RefreshHistory();
                });
        };
    chatService_.AttachEventHandlers(eventHandlers_);

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
    eventHandlers_.reset();
    chatService_.AttachEventHandlers({});
}

void ChatFrame::InvalidateOpenChatRequest()
{
    ++activeOpenChatRequestId_;
    if (openChatTask_ != nullptr)
    {
        openChatTask_->RequestCancel();
        openChatTask_.reset();
    }
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
        ? lila::shared::text::FromUtf8(lila::shared::errors::UnexpectedError)
        : message;
    wxMessageDialog dialog(
        this,
        safeMessage,
        title.empty() ? lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameHeader) : title,
        wxOK | wxICON_WARNING | wxSTAY_ON_TOP | wxCENTRE);
    dialog.SetEscapeId(wxID_OK);
    dialog.ShowModal();
}
}
