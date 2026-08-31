#include "modules/rooms/presentation/model/RoomPresentationModel.h"

#include "modules/rooms/presentation/actions/RoomActionPolicy.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
namespace
{
bool IsStarted(const domain::RoomState& room)
{
    return room.started || room.status == "started";
}

wxString FormatMembers(const std::vector<domain::RoomMember>& members)
{
    if (members.empty()) return wxString(L"aucun");
    wxString output;
    for (std::size_t index = 0; index < members.size(); ++index)
    {
        if (index > 0) output += wxString(L", ");
        output += lila::shared::text::FromUtf8(members[index].name);
    }
    return output;
}
}

std::vector<lila::shared::ui::controls::VerticalMenuItem> RoomPresentationModel::BuildItems(
    const domain::RoomState& room)
{
    using Item = lila::shared::ui::controls::VerticalMenuItem;
    const bool canStart = RoomActionPolicy::AllowsServer(room, RoomServerAction::Start);
    std::vector<Item> items{{
        canStart ? "room:start" : "room:game",
        lila::shared::text::FromUtf8(room.gameName)}};
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::AddBot))
        items.push_back({"room:add-bot", wxString(L"Ajouter un bot")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::RemoveBot))
        items.push_back({"room:remove-bot", wxString(L"Retirer un bot")});
    if (RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Players))
        items.push_back({"room:players", wxString(L"Lister les joueurs")});
    if (RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Information))
        items.push_back({"room:info", wxString(L"Informations sur la table")});
    if (RoomActionPolicy::AllowsInterface(RoomInterfaceAction::Rules))
        items.push_back({"room:rules", wxString(L"Règles du jeu")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::SetAmbience))
        items.push_back({"room:ambience", wxString(L"Choisir l’ambiance de table")});
    if (RoomActionPolicy::AllowsInterface(RoomInterfaceAction::TableAmbienceVolume))
        items.push_back({"room:ambience-volume", wxString(L"Volume de l’ambiance")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::Invite))
        items.push_back({"room:invite", wxString(L"Inviter un utilisateur")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::Kick))
        items.push_back({"room:kick", wxString(L"Exclure un joueur")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::Ban))
        items.push_back({"room:ban", wxString(L"Bannir un joueur")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::SetOwner))
        items.push_back({"room:set-owner", wxString(L"Transférer la propriété")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::TogglePrivacy))
        items.push_back({"room:privacy", room.isPrivate
            ? wxString(L"Rendre la table publique")
            : wxString(L"Rendre la table privée")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::SetRole))
        items.push_back({"room:role", room.selfSpectator
            ? wxString(L"Devenir joueur")
            : wxString(L"Devenir spectateur")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::Save))
        items.push_back({"room:save", wxString(L"Sauvegarder dans mon coffre fort")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::Reset))
        items.push_back({"room:reset", wxString(L"Réinitialiser la table")});
    if (RoomActionPolicy::AllowsServer(room, RoomServerAction::Leave))
        items.push_back({"room:leave", wxString(L"Quitter la table")});
    return items;
}

wxString RoomPresentationModel::BuildStatus(const domain::RoomState& room)
{
    if (IsStarted(room)) return wxString(L"Partie en cours.");
    const auto participants = room.players.size() + room.bots.size();
    const auto minimum = static_cast<std::size_t>(std::max(1, room.minPlayers));
    if (participants >= minimum)
        return wxString::Format(
            wxString(L"Table prête. %zu participant(s)."), participants);
    return wxString::Format(
        wxString(L"En attente de participants : %zu sur %zu requis."),
        participants,
        minimum);
}

wxString RoomPresentationModel::BuildDetails(
    const domain::RoomState& room,
    std::string_view gameSummary,
    std::string_view gameEngine)
{
    const auto visibility = room.isPrivate ? wxString(L"privée") : wxString(L"publique");
    auto details = wxString::Format(
        wxString(L"%s. Table %s. De %d à %d joueurs."),
        lila::shared::text::FromUtf8(room.name).c_str(),
        visibility.c_str(),
        room.minPlayers,
        room.maxPlayers);
    if (!gameSummary.empty())
        details = lila::shared::text::FromUtf8(std::string(gameSummary)) + wxString(L"\n") + details;
    if (!gameEngine.empty())
        details += wxString(L" Moteur : ") +
            lila::shared::text::FromUtf8(std::string(gameEngine)) + wxString(L".");
    details += wxString(L"\n") + BuildPlayers(room);
    return details;
}

wxString RoomPresentationModel::BuildPlayers(const domain::RoomState& room)
{
    return wxString(L"Joueurs : ") + FormatMembers(room.players) +
        wxString(L". Spectateurs : ") + FormatMembers(room.spectators) +
        wxString(L". Bots : ") + FormatMembers(room.bots) + wxString(L".");
}

RoomPresentationModel::Action RoomPresentationModel::ActionForId(std::string_view id) noexcept
{
    if (id == "room:game") return Action::ShowGameStatus;
    if (id == "room:start") return Action::Start;
    if (id == "room:add-bot") return Action::AddBot;
    if (id == "room:remove-bot") return Action::RemoveBot;
    if (id == "room:players") return Action::ShowPlayers;
    if (id == "room:info") return Action::ShowInfo;
    if (id == "room:rules") return Action::ShowRules;
    if (id == "room:ambience") return Action::ConfigureAmbience;
    if (id == "room:ambience-volume") return Action::ConfigureAmbienceVolume;
    if (id == "room:invite") return Action::Invite;
    if (id == "room:kick") return Action::Kick;
    if (id == "room:ban") return Action::Ban;
    if (id == "room:set-owner") return Action::SetOwner;
    if (id == "room:privacy") return Action::TogglePrivacy;
    if (id == "room:role") return Action::ToggleRole;
    if (id == "room:save") return Action::Save;
    if (id == "room:reset") return Action::Reset;
    if (id == "room:leave") return Action::Leave;
    return Action::None;
}
}
