#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/chat/presentation/ChatFocusController.h"

#include <string>
#include <utility>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/concurrency/application/BackgroundExecutor.h"

#include <wx/dialog.h>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>
#include <wx/window.h>

namespace
{
constexpr int WindowWidth = 1100;
constexpr int WindowHeight = 760;

}

namespace lila::modules::chat::presentation
{
ChatFrame::ChatFrame(
    wxWindow* parent,
    lila::modules::chat::application::ChatService& chatService,
    lila::modules::options::application::OptionsStore& optionsStore,
    lila::modules::session::application::SessionStore& sessionStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : lila::shared::accessibility::NonFocusablePanel(
          parent,
          0),
      chatService_(chatService),
      optionsStore_(optionsStore),
      sessionStore_(sessionStore),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    SetMinSize(wxSize(WindowWidth, WindowHeight));
    BuildLayout();
    ApplyTheme();
    focusController_ = std::make_unique<ChatFocusController>(
        *inputCtrl_, *historyCtrl_, *editMessageButton_, *deleteMessageButton_);
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

lila::shared::accessibility::FocusManager::Plan ChatFrame::BuildFocusPlan()
{
    if (focusController_ == nullptr)
    {
        return {};
    }

    if (isHistoryActionMode_)
    {
        return focusController_->BuildFirstHistoryActionPlan();
    }

    return focusController_->BuildComposerPlan();
}

void ChatFrame::ResetFocusToComposer()
{
    ClearNavigationHistory();
    isHistoryActionMode_ = false;
    selectedActionMessageId_.reset();
    SyncActionState();
    if (focusController_ != nullptr && IsShownOnScreen())
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(
            focusController_->BuildComposerPlan()));
    }
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
    ResetFocusToComposer();
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
