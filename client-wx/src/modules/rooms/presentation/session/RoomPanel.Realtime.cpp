#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <algorithm>
#include <utility>

#include <wx/textctrl.h>
#include <wx/weakref.h>

#include "modules/rooms/application/RoomSessionService.h"
#include "modules/audio/application/IAudioService.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
namespace
{
wxString FormatChatMessage(const domain::RoomChatMessage& chat)
{
    const auto message = lila::shared::text::FromUtf8(chat.message);
    if (chat.username.empty()) return message;
    return lila::shared::text::FromUtf8(chat.username) + wxString(L" : ") + message;
}

bool ShouldIgnoreRoomAnnouncement(wxString message)
{
    message.Trim(true).Trim(false);
    return message.empty() || message.CmpNoCase(wxString(L"Table pleine")) == 0;
}
}

void RoomPanel::AttachEventHandler()
{
    wxWeakRef<RoomPanel> weakThis(this);
    roomService_.SetEventHandler(
        [weakThis](domain::RoomEvent event) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, event = std::move(event)]() mutable
                {
                    if (weakThis) weakThis->HandleRoomEvent(std::move(event));
                });
        });
}

void RoomPanel::HandleRoomEvent(domain::RoomEvent event)
{
    switch (event.type)
    {
    case domain::RoomEventType::StateUpdated:
        if (event.room) ApplyRoom(std::move(*event.room));
        return;
    case domain::RoomEventType::Info:
    case domain::RoomEventType::Announcement:
        if (!event.message.empty())
        {
            const auto message = lila::shared::text::FromUtf8(event.message);
            if (!ShouldIgnoreRoomAnnouncement(message))
            {
                AppendRoomAnnouncement(message);
                UpdateStatus(message);
            }
        }
        return;
    case domain::RoomEventType::PrivacyChanged:
        room_.isPrivate = event.value;
        state_ = State::Ready;
        ShowRoom();
        if (!event.message.empty())
            UpdateStatus(lila::shared::text::FromUtf8(event.message), false, true);
        return;
    case domain::RoomEventType::RoleChanged:
        room_.selfSpectator = event.value;
        state_ = State::Ready;
        ShowRoom();
        if (!event.message.empty())
            UpdateStatus(lila::shared::text::FromUtf8(event.message), false, true);
        return;
    case domain::RoomEventType::BotAdded:
        if (event.member && std::none_of(
                room_.bots.begin(), room_.bots.end(),
                [&event](const domain::RoomMember& bot)
                {
                    return bot.id == event.member->id;
                }))
        {
            room_.bots.push_back(*event.member);
            ShowRoom();
        }
        return;
    case domain::RoomEventType::BotRemoved:
        if (event.member)
        {
            const auto previousSize = room_.bots.size();
            std::erase_if(
                room_.bots,
                [&event](const domain::RoomMember& bot)
                {
                    return bot.id == event.member->id;
                });
            if (room_.bots.size() != previousSize) ShowRoom();
        }
        return;
    case domain::RoomEventType::ChatMessage:
        {
        const int currentUserId = currentUserId_ ? currentUserId_() : 0;
        bool received = false;
        for (const auto& chat : event.chatMessages)
        {
            received = received || (chat.userId != 0 && chat.userId != currentUserId);
            AppendHistory(FormatChatMessage(chat));
        }
        if (received)
        {
            audioService_.Play(
                lila::modules::audio::domain::SoundCue::TableChatMessageReceived);
        }
        return;
        }
    case domain::RoomEventType::ChatHistory:
        if (!chatHistoryReceived_)
        {
            history_->Clear();
            chatHistoryReceived_ = true;
        }
        for (const auto& chat : event.chatMessages) AppendHistory(FormatChatMessage(chat));
        for (const auto& message : pendingRoomAnnouncements_) AppendHistory(message);
        pendingRoomAnnouncements_.clear();
        return;
    case domain::RoomEventType::ConnectionStatus:
        if (!event.message.empty())
            UpdateStatus(lila::shared::text::FromUtf8(event.message), event.value, true);
        return;
    case domain::RoomEventType::Closed:
        roomService_.Close();
        if (!saveInProgress_ && !abandonInProgress_) CloseSession();
        return;
    case domain::RoomEventType::Error:
        state_ = State::Ready;
        ShowRoom();
        if (!event.message.empty())
        {
            const auto message = lila::shared::text::FromUtf8(event.message);
            AppendRoomAnnouncement(message);
            UpdateStatus(message, true);
        }
        return;
    case domain::RoomEventType::Ignored:
        return;
    }
}
}
