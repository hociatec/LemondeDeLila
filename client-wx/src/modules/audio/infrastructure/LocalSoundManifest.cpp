#include "modules/audio/infrastructure/LocalSoundManifest.h"

#include <array>

namespace lila::modules::audio::infrastructure
{
namespace
{
constexpr std::array Files{
    L"ClientOpened.wav", L"ClientConnected.wav", L"ClientDisconnected.wav",
    L"ClientDisconnected.wav", L"RoomOpened.wav", L"MainMenuMusic.wav",
    L"TavernAmbience.wav", L"TavernOpened.wav", L"DiceRolled.wav",
    L"InvitationSent.wav", L"ChatMessageSent.wav", L"ChatMessageReceived.wav",
    L"ChatMessageSent.wav", L"ChatMessageReceived.wav", L"PrivateMessageSent.wav",
    L"PrivateMessageReceived.wav", L"FriendConnected.wav", L"FriendDisconnected.wav",
    L"FriendInvitationSent.wav", L"FriendInvitationReceived.wav", L"GameVictory.wav",
    L"GameDefeat.wav", L"RoomOpened.wav", L"RoomExit.wav", L"DiceRolled.wav",
    L"InvitationSent.wav", L"FriendInvitationReceived.wav", L"AdminContactSent.wav",
    L"AdminContactReceived.wav", L"ChatMessageReceived.wav", L"RoomOpened.wav",
    L"RoomJoined.wav", L"RoomExit.wav", L"RoomOpened.wav", L"DiceRolled.wav",
    L"DiceRolled.wav", L"DiceRolled.wav", L"DiceRolled.wav", L"DiceRolled.wav",
    L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav",
    L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav",
    L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav",
    L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav",
    L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav", L"RoomOpened.wav",
    L"ClientDisconnected.wav", L"InvitationSent.wav",
};

static_assert(Files.size() == static_cast<std::size_t>(domain::SoundCue::Count));
}

std::wstring_view GetLocalSoundFile(domain::SoundCue cue) noexcept
{
    const auto index = static_cast<std::size_t>(cue);
    return index < Files.size() ? Files[index] : std::wstring_view{};
}
}
