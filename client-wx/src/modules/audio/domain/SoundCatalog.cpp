#include "modules/audio/domain/SoundCatalog.h"

#include <array>

namespace lila::modules::audio::domain
{
namespace
{
using enum SoundCue;
using enum SoundFamily;

constexpr std::array Catalog{
    SoundDescriptor{ClientOpened, "clientOpened", AppLaunch, false},
    SoundDescriptor{ClientConnected, "clientConnected", AppLaunch, false},
    SoundDescriptor{ClientDisconnected, "clientDisconnected", AppLaunch, false},
    SoundDescriptor{ClientClosing, "clientClosing", AppLaunch, false},
    SoundDescriptor{ClientUpdateWarning, "clientUpdateWarning", Navigate, false},
    SoundDescriptor{MainMenuMusic, "mainMenuMusic", Ambience, true},
    SoundDescriptor{TavernAmbience, "tavernAmbience", Ambience, true},
    SoundDescriptor{TavernOpened, "tavernOpened", Ambience, false},
    SoundDescriptor{DiceRolled, "diceRolled", Select, false},
    SoundDescriptor{DrawCard, "drawCard", Select, false},
    SoundDescriptor{ChatMessageSent, "chatMessageSent", Messages, false},
    SoundDescriptor{ChatMessageReceived, "chatMessageReceived", Messages, false},
    SoundDescriptor{TableChatMessageSent, "tableChatMessageSent", Messages, false},
    SoundDescriptor{TableChatMessageReceived, "tableChatMessageReceived", Messages, false},
    SoundDescriptor{PrivateMessageSent, "privateMessageSent", Messages, false},
    SoundDescriptor{PrivateMessageReceived, "privateMessageReceived", Messages, false},
    SoundDescriptor{FriendConnected, "friendConnected", Select, false},
    SoundDescriptor{FriendDisconnected, "friendDisconnected", Select, false},
    SoundDescriptor{FriendInvitationSent, "friendInvitationSent", Select, false},
    SoundDescriptor{FriendInvitationReceived, "friendInvitationReceived", Select, false},
    SoundDescriptor{GameVictory, "gameVictory", Messages, false},
    SoundDescriptor{GameDefeat, "gameDefeat", Messages, false},
    SoundDescriptor{QuizCorrect, "quizCorrect", Messages, false},
    SoundDescriptor{QuizWrong, "quizWrong", Messages, false},
    SoundDescriptor{RoundEnded, "roundEnded", Select, false},
    SoundDescriptor{InvitationSent, "invitationSent", Select, false},
    SoundDescriptor{InvitationReceived, "invitationReceived", Select, false},
    SoundDescriptor{AdminContactSent, "adminContactSent", Messages, false},
    SoundDescriptor{AdminContactReceived, "adminContactReceived", Messages, false},
    SoundDescriptor{BugReportCommentReceived, "bugReportCommentReceived", Navigate, false},
    SoundDescriptor{RoomOpened, "roomOpened", Select, false},
    SoundDescriptor{RoomJoined, "roomJoined", Select, false},
    SoundDescriptor{RoomExit, "roomExit", Select, false},
    SoundDescriptor{TableStarted, "tableStarted", Select, false},
    SoundDescriptor{PawnPicked, "pawnPicked", Select, false},
    SoundDescriptor{PawnPlacedSelf, "pawnPlacedSelf", Select, false},
    SoundDescriptor{PawnPlacedOpponent, "pawnPlacedOpponent", Select, false},
    SoundDescriptor{WallPlacedSelf, "wallPlacedSelf", Select, false},
    SoundDescriptor{WallPlacedOpponent, "wallPlacedOpponent", Select, false},
    SoundDescriptor{TableAmbience1, "tableAmbience1", TableAmbience, true},
    SoundDescriptor{TableAmbience2, "tableAmbience2", TableAmbience, true},
    SoundDescriptor{TableAmbience3, "tableAmbience3", TableAmbience, true},
    SoundDescriptor{TableAmbience4, "tableAmbience4", TableAmbience, true},
    SoundDescriptor{TableAmbience5, "tableAmbience5", TableAmbience, true},
    SoundDescriptor{TableAmbience6, "tableAmbience6", TableAmbience, true},
    SoundDescriptor{TableAmbience7, "tableAmbience7", TableAmbience, true},
    SoundDescriptor{TableAmbience8, "tableAmbience8", TableAmbience, true},
    SoundDescriptor{TableAmbience9, "tableAmbience9", TableAmbience, true},
    SoundDescriptor{TableAmbience10, "tableAmbience10", TableAmbience, true},
    SoundDescriptor{TableAmbience11, "tableAmbience11", TableAmbience, true},
    SoundDescriptor{TableAmbience12, "tableAmbience12", TableAmbience, true},
    SoundDescriptor{TableAmbience13, "tableAmbience13", TableAmbience, true},
    SoundDescriptor{TableAmbience14, "tableAmbience14", TableAmbience, true},
    SoundDescriptor{TableAmbience15, "tableAmbience15", TableAmbience, true},
    SoundDescriptor{TableAmbience16, "tableAmbience16", TableAmbience, true},
    SoundDescriptor{TableAmbience17, "tableAmbience17", TableAmbience, true},
    SoundDescriptor{TableAmbience18, "tableAmbience18", TableAmbience, true},
    SoundDescriptor{TableAmbience19, "tableAmbience19", TableAmbience, true},
    SoundDescriptor{TableAmbience20, "tableAmbience20", TableAmbience, true},
    SoundDescriptor{Navigation, "navigation", Navigate, false},
    SoundDescriptor{Selection, "selection", Select, false},
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
}
