#include "modules/chat/presentation/ChatFrame.h"

#include <utility>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/config/AppConfig.h"

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
              "Tchat - %s",
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
}
