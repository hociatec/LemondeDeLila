#include "modules/audio/presentation/SoundOptionsCatalog.h"

#include <array>

namespace lila::modules::audio::presentation
{
namespace
{
using enum domain::SoundCue;

constexpr std::array Options{
    SoundOption{ClientOpened, L"Ouverture du client"},
    SoundOption{ClientConnected, L"Connexion au serveur"},
    SoundOption{ClientDisconnected, L"Déconnexion du serveur"},
    SoundOption{ClientClosing, L"Fermeture du client"},
    SoundOption{ClientUpdateWarning, L"Alerte de mise à jour"},
    SoundOption{MainMenuMusic, L"Musique du menu principal"},
    SoundOption{TavernAmbience, L"Ambiance de la taverne"},
    SoundOption{TavernOpened, L"Ouverture de la taverne"},
    SoundOption{DiceRolled, L"Lancer de dé"},
    SoundOption{DrawCard, L"Pioche"},
    SoundOption{ChatMessageSent, L"Message de tchat envoyé"},
    SoundOption{ChatMessageReceived, L"Message de tchat reçu"},
    SoundOption{TableChatMessageSent, L"Message de table envoyé"},
    SoundOption{TableChatMessageReceived, L"Message de table reçu"},
    SoundOption{PrivateMessageSent, L"Message privé envoyé"},
    SoundOption{PrivateMessageReceived, L"Message privé reçu"},
    SoundOption{FriendConnected, L"Ami connecté"},
    SoundOption{FriendDisconnected, L"Ami déconnecté"},
    SoundOption{FriendInvitationSent, L"Demande d’ami envoyée"},
    SoundOption{FriendInvitationReceived, L"Demande d’ami reçue"},
    SoundOption{GameVictory, L"Victoire"},
    SoundOption{GameDefeat, L"Défaite"},
    SoundOption{QuizCorrect, L"Quiz : bonne réponse"},
    SoundOption{QuizWrong, L"Quiz : mauvaise réponse"},
    SoundOption{RoundEnded, L"Fin de manche"},
    SoundOption{InvitationSent, L"Invitation à une table envoyée"},
    SoundOption{InvitationReceived, L"Invitation à une table reçue"},
    SoundOption{AdminContactSent, L"Contact admin envoyé"},
    SoundOption{AdminContactReceived, L"Contact admin reçu"},
    SoundOption{BugReportCommentReceived, L"Commentaire de rapport reçu"},
    SoundOption{RoomOpened, L"Entrer dans une table"},
    SoundOption{RoomJoined, L"Rejoindre une table"},
    SoundOption{RoomExit, L"Quitter une table"},
    SoundOption{TableStarted, L"Démarrage d’une partie"},
    SoundOption{PawnPicked, L"Pion sélectionné"},
    SoundOption{PawnPlacedSelf, L"Votre pion placé"},
    SoundOption{PawnPlacedOpponent, L"Pion adverse placé"},
    SoundOption{WallPlacedSelf, L"Votre mur placé"},
    SoundOption{WallPlacedOpponent, L"Mur adverse placé"},
    SoundOption{TableAmbience1, L"Ambiance de table 1"},
    SoundOption{TableAmbience2, L"Ambiance de table 2"},
    SoundOption{TableAmbience3, L"Ambiance de table 3"},
    SoundOption{TableAmbience4, L"Ambiance de table 4"},
    SoundOption{TableAmbience5, L"Ambiance de table 5"},
    SoundOption{TableAmbience6, L"Ambiance de table 6"},
    SoundOption{TableAmbience7, L"Ambiance de table 7"},
    SoundOption{TableAmbience8, L"Ambiance de table 8"},
    SoundOption{TableAmbience9, L"Ambiance de table 9"},
    SoundOption{TableAmbience10, L"Ambiance de table 10"},
    SoundOption{TableAmbience11, L"Ambiance de table 11"},
    SoundOption{TableAmbience12, L"Ambiance de table 12"},
    SoundOption{TableAmbience13, L"Ambiance de table 13"},
    SoundOption{TableAmbience14, L"Ambiance de table 14"},
    SoundOption{TableAmbience15, L"Ambiance de table 15"},
    SoundOption{TableAmbience16, L"Ambiance de table 16"},
    SoundOption{TableAmbience17, L"Ambiance de table 17"},
    SoundOption{TableAmbience18, L"Ambiance de table 18"},
    SoundOption{TableAmbience19, L"Ambiance de table 19"},
    SoundOption{TableAmbience20, L"Ambiance de table 20"},
    SoundOption{Navigation, L"Déplacement dans les menus"},
    SoundOption{Selection, L"Validation d’une sélection"},
};

static_assert(Options.size() == static_cast<std::size_t>(domain::SoundCue::Count));
}

std::span<const SoundOption> GetSoundOptions() noexcept
{
    return Options;
}

std::wstring_view GetSoundFamilyLabel(domain::SoundFamily family) noexcept
{
    using enum domain::SoundFamily;
    switch (family)
    {
    case AppLaunch: return L"Connexion et système";
    case Ambience: return L"Ambiances";
    case Navigate: return L"Interface et navigation";
    case Select: return L"Sélections et jeu";
    case Messages: return L"Tchat et messages";
    case TableAmbience: return L"Ambiances de table";
    }
    return L"Autres sons";
}
}
