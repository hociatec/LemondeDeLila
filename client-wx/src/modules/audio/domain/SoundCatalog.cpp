#include "modules/audio/domain/SoundCatalog.h"

#include <array>
#include <cctype>

namespace lila::modules::audio::domain
{
namespace
{

constexpr std::array Catalog{
    SoundDescriptor{SoundCue::ClientOpened, "clientOpened", SoundFamily::AppLaunch, false},
    SoundDescriptor{SoundCue::ClientConnected, "clientConnected", SoundFamily::AppLaunch, false},
    SoundDescriptor{SoundCue::ClientDisconnected, "clientDisconnected", SoundFamily::AppLaunch, false},
    SoundDescriptor{SoundCue::ClientClosing, "clientClosing", SoundFamily::AppLaunch, false},
    SoundDescriptor{SoundCue::ClientUpdateWarning, "clientUpdateWarning", SoundFamily::Navigate, false},
    SoundDescriptor{SoundCue::MainMenuMusic, "mainMenuMusic", SoundFamily::Ambience, true},
    SoundDescriptor{SoundCue::TavernAmbience, "tavernAmbience", SoundFamily::Ambience, true},
    SoundDescriptor{SoundCue::TavernOpened, "tavernOpened", SoundFamily::Ambience, false},
    SoundDescriptor{SoundCue::TavernClosed, "tavernClosed", SoundFamily::Ambience, false},
    SoundDescriptor{SoundCue::DiceRolled, "diceRolled", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::DrawCard, "drawCard", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::ChatMessageSent, "chatMessageSent", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::ChatMessageReceived, "chatMessageReceived", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::TableChatMessageSent, "tableChatMessageSent", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::TableChatMessageReceived, "tableChatMessageReceived", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::PrivateMessageSent, "privateMessageSent", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::PrivateMessageReceived, "privateMessageReceived", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::FriendConnected, "friendConnected", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::FriendDisconnected, "friendDisconnected", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::FriendInvitationSent, "friendInvitationSent", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::FriendInvitationReceived, "friendInvitationReceived", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::GameVictory, "gameVictory", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::GameDefeat, "gameDefeat", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::QuizCorrect, "quizCorrect", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::QuizWrong, "quizWrong", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::RoundEnded, "roundEnded", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::InvitationSent, "invitationSent", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::InvitationReceived, "invitationReceived", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::AdminContactSent, "adminContactSent", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::AdminContactReceived, "adminContactReceived", SoundFamily::Messages, false},
    SoundDescriptor{SoundCue::BugReportCommentReceived, "bugReportCommentReceived", SoundFamily::Navigate, false},
    SoundDescriptor{SoundCue::RoomOpened, "roomOpened", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::RoomJoined, "roomJoined", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::RoomExit, "roomExit", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::RoomMemberJoined, "roomMemberJoined", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::RoomMemberLeft, "roomMemberLeft", SoundFamily::Select, false},
    SoundDescriptor{SoundCue::TableStarted, "tableStarted", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::PawnPicked, "pawnPicked", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::PawnPlacedSelf, "pawnPlacedSelf", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::PawnPlacedOpponent, "pawnPlacedOpponent", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::WallPlacedSelf, "wallPlacedSelf", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::WallPlacedOpponent, "wallPlacedOpponent", SoundFamily::Gameplay, false},
    SoundDescriptor{SoundCue::TableAmbience1, "tableAmbience1", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience2, "tableAmbience2", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience3, "tableAmbience3", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience4, "tableAmbience4", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience5, "tableAmbience5", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience6, "tableAmbience6", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience7, "tableAmbience7", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience8, "tableAmbience8", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience9, "tableAmbience9", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience10, "tableAmbience10", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience11, "tableAmbience11", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience12, "tableAmbience12", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience13, "tableAmbience13", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience14, "tableAmbience14", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience15, "tableAmbience15", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience16, "tableAmbience16", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience17, "tableAmbience17", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience18, "tableAmbience18", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience19, "tableAmbience19", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::TableAmbience20, "tableAmbience20", SoundFamily::TableAmbience, true},
    SoundDescriptor{SoundCue::Navigation, "navigation", SoundFamily::Navigate, false},
    SoundDescriptor{SoundCue::Selection, "selection", SoundFamily::Select, false},
};

static_assert(Catalog.size() == static_cast<std::size_t>(SoundCue::Count));
}

std::span<const SoundDescriptor> GetSoundCatalog() noexcept
{
    return Catalog;
}

const SoundDescriptor* FindSoundDescriptor(SoundCue cue) noexcept
{
    const auto index = static_cast<std::size_t>(cue);
    return index < Catalog.size() ? &Catalog[index] : nullptr;
}

const SoundDescriptor* FindSoundDescriptorByServerId(std::string_view soundId) noexcept
{
    for (const auto& descriptor : Catalog)
    {
        if (descriptor.key.size() != soundId.size() || soundId.empty()) continue;
        if (std::tolower(static_cast<unsigned char>(descriptor.key.front())) !=
            std::tolower(static_cast<unsigned char>(soundId.front()))) continue;
        if (descriptor.key.substr(1) == soundId.substr(1)) return &descriptor;
    }
    return nullptr;
}
}
