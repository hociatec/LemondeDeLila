#include "modules/audio/presentation/SoundOptionsCatalog.h"

#include <array>

namespace lila::modules::audio::presentation
{
namespace
{

constexpr std::array Options{
    SoundOption{domain::SoundCue::ClientOpened, L"Ouverture du client"},
    SoundOption{domain::SoundCue::ClientConnected, L"Connexion au serveur"},
    SoundOption{domain::SoundCue::ClientDisconnected, L"Déconnexion du serveur"},
    SoundOption{domain::SoundCue::ClientClosing, L"Fermeture du client"},
    SoundOption{domain::SoundCue::ClientUpdateWarning, L"Alerte de mise à jour"},
    SoundOption{domain::SoundCue::MainMenuMusic, L"Musique du menu principal"},
    SoundOption{domain::SoundCue::TavernAmbience, L"Ambiance de la taverne"},
    SoundOption{domain::SoundCue::TavernOpened, L"Ouverture de la taverne"},
    SoundOption{domain::SoundCue::DiceRolled, L"Lancer de dé"},
    SoundOption{domain::SoundCue::DrawCard, L"Pioche"},
    SoundOption{domain::SoundCue::ChatMessageSent, L"Message de tchat envoyé"},
    SoundOption{domain::SoundCue::ChatMessageReceived, L"Message de tchat reçu"},
    SoundOption{domain::SoundCue::TableChatMessageSent, L"Message de table envoyé"},
    SoundOption{domain::SoundCue::TableChatMessageReceived, L"Message de table reçu"},
    SoundOption{domain::SoundCue::PrivateMessageSent, L"Message privé envoyé"},
    SoundOption{domain::SoundCue::PrivateMessageReceived, L"Message privé reçu"},
    SoundOption{domain::SoundCue::FriendConnected, L"Ami connecté"},
    SoundOption{domain::SoundCue::FriendDisconnected, L"Ami déconnecté"},
    SoundOption{domain::SoundCue::FriendInvitationSent, L"Demande d’ami envoyée"},
    SoundOption{domain::SoundCue::FriendInvitationReceived, L"Demande d’ami reçue"},
    SoundOption{domain::SoundCue::GameVictory, L"Victoire"},
    SoundOption{domain::SoundCue::GameDefeat, L"Défaite"},
    SoundOption{domain::SoundCue::QuizCorrect, L"Quiz : bonne réponse"},
    SoundOption{domain::SoundCue::QuizWrong, L"Quiz : mauvaise réponse"},
    SoundOption{domain::SoundCue::RoundEnded, L"Fin de manche"},
    SoundOption{domain::SoundCue::InvitationSent, L"Invitation à une table envoyée"},
    SoundOption{domain::SoundCue::InvitationReceived, L"Invitation à une table reçue"},
    SoundOption{domain::SoundCue::AdminContactSent, L"Contact admin envoyé"},
    SoundOption{domain::SoundCue::AdminContactReceived, L"Contact admin reçu"},
    SoundOption{domain::SoundCue::BugReportCommentReceived, L"Commentaire de rapport reçu"},
    SoundOption{domain::SoundCue::RoomOpened, L"Entrer dans une table"},
    SoundOption{domain::SoundCue::RoomJoined, L"Rejoindre une table"},
    SoundOption{domain::SoundCue::RoomExit, L"Quitter une table"},
    SoundOption{domain::SoundCue::TableStarted, L"Démarrage d’une partie"},
    SoundOption{domain::SoundCue::PawnPicked, L"Pion sélectionné"},
    SoundOption{domain::SoundCue::PawnPlacedSelf, L"Votre pion placé"},
    SoundOption{domain::SoundCue::PawnPlacedOpponent, L"Pion adverse placé"},
    SoundOption{domain::SoundCue::WallPlacedSelf, L"Votre mur placé"},
    SoundOption{domain::SoundCue::WallPlacedOpponent, L"Mur adverse placé"},
    SoundOption{domain::SoundCue::TableAmbience1, L"Ambiance de table 1"},
    SoundOption{domain::SoundCue::TableAmbience2, L"Ambiance de table 2"},
    SoundOption{domain::SoundCue::TableAmbience3, L"Ambiance de table 3"},
    SoundOption{domain::SoundCue::TableAmbience4, L"Ambiance de table 4"},
    SoundOption{domain::SoundCue::TableAmbience5, L"Ambiance de table 5"},
    SoundOption{domain::SoundCue::TableAmbience6, L"Ambiance de table 6"},
    SoundOption{domain::SoundCue::TableAmbience7, L"Ambiance de table 7"},
    SoundOption{domain::SoundCue::TableAmbience8, L"Ambiance de table 8"},
    SoundOption{domain::SoundCue::TableAmbience9, L"Ambiance de table 9"},
    SoundOption{domain::SoundCue::TableAmbience10, L"Ambiance de table 10"},
    SoundOption{domain::SoundCue::TableAmbience11, L"Ambiance de table 11"},
    SoundOption{domain::SoundCue::TableAmbience12, L"Ambiance de table 12"},
    SoundOption{domain::SoundCue::TableAmbience13, L"Ambiance de table 13"},
    SoundOption{domain::SoundCue::TableAmbience14, L"Ambiance de table 14"},
    SoundOption{domain::SoundCue::TableAmbience15, L"Ambiance de table 15"},
    SoundOption{domain::SoundCue::TableAmbience16, L"Ambiance de table 16"},
    SoundOption{domain::SoundCue::TableAmbience17, L"Ambiance de table 17"},
    SoundOption{domain::SoundCue::TableAmbience18, L"Ambiance de table 18"},
    SoundOption{domain::SoundCue::TableAmbience19, L"Ambiance de table 19"},
    SoundOption{domain::SoundCue::TableAmbience20, L"Ambiance de table 20"},
    SoundOption{domain::SoundCue::Navigation, L"Déplacement dans les menus"},
    SoundOption{domain::SoundCue::Selection, L"Validation d’une sélection"},
};

static_assert(Options.size() == static_cast<std::size_t>(domain::SoundCue::Count));
}

std::span<const SoundOption> GetSoundOptions() noexcept
{
    return Options;
}

std::wstring_view GetSoundFamilyLabel(domain::SoundFamily family) noexcept
{
    switch (family)
    {
    case domain::SoundFamily::AppLaunch: return L"Connexion et système";
    case domain::SoundFamily::Ambience: return L"Ambiances";
    case domain::SoundFamily::Navigate: return L"Interface et navigation";
    case domain::SoundFamily::Select: return L"Sélections et jeu";
    case domain::SoundFamily::Messages: return L"Tchat et messages";
    case domain::SoundFamily::TableAmbience: return L"Ambiances de table";
    }
    return L"Autres sons";
}
}
