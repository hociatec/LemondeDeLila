#include "shared/audio/SoundCatalog.h"

#include <array>

namespace lila::shared::audio
{
namespace
{
using enum SoundCue;
using enum SoundFamily;

constexpr std::array Catalog{
    SoundDescriptor{ClientOpened, "clientOpened", L"Connexion et système", L"Ouverture du client", L"ClientOpened.wav", AppLaunch, false},
    SoundDescriptor{ClientConnected, "clientConnected", L"Connexion et système", L"Connexion au serveur", L"ClientConnected.wav", AppLaunch, false},
    SoundDescriptor{ClientDisconnected, "clientDisconnected", L"Connexion et système", L"Déconnexion du serveur", L"ClientDisconnected.wav", AppLaunch, false},
    SoundDescriptor{ClientClosing, "clientClosing", L"Connexion et système", L"Fermeture du client", L"ClientDisconnected.wav", AppLaunch, false},
    SoundDescriptor{ClientUpdateWarning, "clientUpdateWarning", L"Connexion et système", L"Alerte de mise à jour", L"RoomOpened.wav", Navigate, false},
    SoundDescriptor{MainMenuMusic, "mainMenuMusic", L"Ambiances", L"Musique du menu principal", L"MainMenuMusic.wav", Ambience, true},
    SoundDescriptor{TavernAmbience, "tavernAmbience", L"Ambiances", L"Ambiance de la taverne", L"TavernAmbience.wav", Ambience, true},
    SoundDescriptor{TavernOpened, "tavernOpened", L"Ambiances", L"Ouverture de la taverne", L"TavernOpened.wav", Ambience, false},
    SoundDescriptor{DiceRolled, "diceRolled", L"Jeux", L"Lancer de dé", L"DiceRolled.wav", Select, false},
    SoundDescriptor{DrawCard, "drawCard", L"Jeux", L"Pioche", L"InvitationSent.wav", Select, false},
    SoundDescriptor{ChatMessageSent, "chatMessageSent", L"Tchat et messages", L"Message de tchat envoyé", L"ChatMessageSent.wav", Messages, false},
    SoundDescriptor{ChatMessageReceived, "chatMessageReceived", L"Tchat et messages", L"Message de tchat reçu", L"ChatMessageReceived.wav", Messages, false},
    SoundDescriptor{TableChatMessageSent, "tableChatMessageSent", L"Tchat et messages", L"Message de table envoyé", L"ChatMessageSent.wav", Messages, false},
    SoundDescriptor{TableChatMessageReceived, "tableChatMessageReceived", L"Tchat et messages", L"Message de table reçu", L"ChatMessageReceived.wav", Messages, false},
    SoundDescriptor{PrivateMessageSent, "privateMessageSent", L"Tchat et messages", L"Message privé envoyé", L"PrivateMessageSent.wav", Messages, false},
    SoundDescriptor{PrivateMessageReceived, "privateMessageReceived", L"Tchat et messages", L"Message privé reçu", L"PrivateMessageReceived.wav", Messages, false},
    SoundDescriptor{FriendConnected, "friendConnected", L"Amis et invitations", L"Ami connecté", L"FriendConnected.wav", Select, false},
    SoundDescriptor{FriendDisconnected, "friendDisconnected", L"Amis et invitations", L"Ami déconnecté", L"FriendDisconnected.wav", Select, false},
    SoundDescriptor{FriendInvitationSent, "friendInvitationSent", L"Amis et invitations", L"Demande d'ami envoyée", L"FriendInvitationSent.wav", Select, false},
    SoundDescriptor{FriendInvitationReceived, "friendInvitationReceived", L"Amis et invitations", L"Demande d'ami reçue", L"FriendInvitationReceived.wav", Select, false},
    SoundDescriptor{GameVictory, "gameVictory", L"Partie", L"Victoire", L"GameVictory.wav", Messages, false},
    SoundDescriptor{GameDefeat, "gameDefeat", L"Partie", L"Défaite", L"GameDefeat.wav", Messages, false},
    SoundDescriptor{QuizCorrect, "quizCorrect", L"Jeux", L"Quiz : bonne réponse", L"RoomOpened.wav", Messages, false},
    SoundDescriptor{QuizWrong, "quizWrong", L"Jeux", L"Quiz : mauvaise réponse", L"RoomExit.wav", Messages, false},
    SoundDescriptor{RoundEnded, "roundEnded", L"Jeux", L"Fin de manche", L"DiceRolled.wav", Select, false},
    SoundDescriptor{InvitationSent, "invitationSent", L"Amis et invitations", L"Invitation à une table envoyée", L"InvitationSent.wav", Select, false},
    SoundDescriptor{InvitationReceived, "invitationReceived", L"Amis et invitations", L"Invitation à une table reçue", L"FriendInvitationReceived.wav", Select, false},
    SoundDescriptor{AdminContactSent, "adminContactSent", L"Administration", L"Contact admin envoyé", L"AdminContactSent.wav", Messages, false},
    SoundDescriptor{AdminContactReceived, "adminContactReceived", L"Administration", L"Contact admin reçu", L"AdminContactReceived.wav", Messages, false},
    SoundDescriptor{BugReportCommentReceived, "bugReportCommentReceived", L"Administration", L"Commentaire de rapport reçu", L"ChatMessageReceived.wav", Navigate, false},
    SoundDescriptor{RoomOpened, "roomOpened", L"Partie", L"Entrer dans une table", L"RoomOpened.wav", Select, false},
    SoundDescriptor{RoomJoined, "roomJoined", L"Partie", L"Rejoindre une table", L"RoomJoined.wav", Select, false},
    SoundDescriptor{RoomExit, "roomExit", L"Partie", L"Quitter une table", L"RoomExit.wav", Select, false},
    SoundDescriptor{TableStarted, "tableStarted", L"Partie", L"Démarrage d'une partie", L"RoomOpened.wav", Select, false},
    SoundDescriptor{PawnPicked, "pawnPicked", L"Pions et murs", L"Pion sélectionné", L"DiceRolled.wav", Select, false},
    SoundDescriptor{PawnPlacedSelf, "pawnPlacedSelf", L"Pions et murs", L"Votre pion placé", L"DiceRolled.wav", Select, false},
    SoundDescriptor{PawnPlacedOpponent, "pawnPlacedOpponent", L"Pions et murs", L"Pion adverse placé", L"DiceRolled.wav", Select, false},
    SoundDescriptor{WallPlacedSelf, "wallPlacedSelf", L"Pions et murs", L"Votre mur placé", L"DiceRolled.wav", Select, false},
    SoundDescriptor{WallPlacedOpponent, "wallPlacedOpponent", L"Pions et murs", L"Mur adverse placé", L"DiceRolled.wav", Select, false},
    SoundDescriptor{TableAmbience1, "tableAmbience1", L"Ambiances de table", L"Ambiance de table 1", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience2, "tableAmbience2", L"Ambiances de table", L"Ambiance de table 2", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience3, "tableAmbience3", L"Ambiances de table", L"Ambiance de table 3", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience4, "tableAmbience4", L"Ambiances de table", L"Ambiance de table 4", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience5, "tableAmbience5", L"Ambiances de table", L"Ambiance de table 5", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience6, "tableAmbience6", L"Ambiances de table", L"Ambiance de table 6", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience7, "tableAmbience7", L"Ambiances de table", L"Ambiance de table 7", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience8, "tableAmbience8", L"Ambiances de table", L"Ambiance de table 8", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience9, "tableAmbience9", L"Ambiances de table", L"Ambiance de table 9", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience10, "tableAmbience10", L"Ambiances de table", L"Ambiance de table 10", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience11, "tableAmbience11", L"Ambiances de table", L"Ambiance de table 11", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience12, "tableAmbience12", L"Ambiances de table", L"Ambiance de table 12", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience13, "tableAmbience13", L"Ambiances de table", L"Ambiance de table 13", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience14, "tableAmbience14", L"Ambiances de table", L"Ambiance de table 14", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience15, "tableAmbience15", L"Ambiances de table", L"Ambiance de table 15", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience16, "tableAmbience16", L"Ambiances de table", L"Ambiance de table 16", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience17, "tableAmbience17", L"Ambiances de table", L"Ambiance de table 17", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience18, "tableAmbience18", L"Ambiances de table", L"Ambiance de table 18", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience19, "tableAmbience19", L"Ambiances de table", L"Ambiance de table 19", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{TableAmbience20, "tableAmbience20", L"Ambiances de table", L"Ambiance de table 20", L"RoomOpened.wav", TableAmbience, true},
    SoundDescriptor{Navigation, "navigation", L"Interface", L"Déplacement dans les menus", L"ClientDisconnected.wav", Navigate, false},
    SoundDescriptor{Selection, "selection", L"Interface", L"Validation d'une sélection", L"InvitationSent.wav", Select, false},
};

static_assert(Catalog.size() == static_cast<std::size_t>(SoundCue::Count));
}

std::span<const SoundDescriptor> GetSoundCatalog() noexcept
{
    return Catalog;
}

const SoundDescriptor& GetSoundDescriptor(SoundCue cue) noexcept
{
    return Catalog[static_cast<std::size_t>(cue)];
}
}
