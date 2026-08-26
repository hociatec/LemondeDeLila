#include "modules/rooms/presentation/model/RoomPresentationModel.h"

#include <algorithm>

#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
namespace
{
bool Allows(const domain::RoomState& room, std::string_view action)
{
    return std::find(room.allowedActions.begin(), room.allowedActions.end(), action) !=
        room.allowedActions.end();
}

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
    const bool canStart = Allows(room, "room.start");
    std::vector<Item> items{{
        canStart ? "room:start" : "room:game",
        lila::shared::text::FromUtf8(room.gameName)}};
    if (Allows(room, "bot.add"))
        items.push_back({"room:add-bot", wxString(L"Ajouter un bot")});
    if (Allows(room, "bot.remove"))
        items.push_back({"room:remove-bot", wxString(L"Retirer un bot")});
    if (Allows(room, "room.players"))
        items.push_back({"room:players", wxString(L"Lister les joueurs")});
    if (Allows(room, "room.info"))
        items.push_back({"room:info", wxString(L"Informations sur la table")});
    if (Allows(room, "room.toggle-privacy"))
        items.push_back({"room:privacy", room.isPrivate
            ? wxString(L"Rendre la table publique")
            : wxString(L"Rendre la table privée")});
    if (Allows(room, "room.set-role"))
        items.push_back({"room:role", room.selfSpectator
            ? wxString(L"Devenir joueur")
            : wxString(L"Devenir spectateur")});
    if (Allows(room, "room.snapshot.save"))
        items.push_back({"room:save", wxString(L"Sauvegarder dans mon coffre fort")});
    if (Allows(room, "room.reset"))
        items.push_back({"room:reset", wxString(L"Réinitialiser la table")});
    if (Allows(room, "room.leave"))
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

wxString RoomPresentationModel::BuildDetails(const domain::RoomState& room)
{
    const auto visibility = room.isPrivate ? wxString(L"privée") : wxString(L"publique");
    auto details = wxString::Format(
        wxString(L"%s. Table %s. De %d à %d joueurs."),
        lila::shared::text::FromUtf8(room.name).c_str(),
        visibility.c_str(),
        room.minPlayers,
        room.maxPlayers);
    if (!room.gameSummary.empty())
        details = lila::shared::text::FromUtf8(room.gameSummary) + wxString(L"\n") + details;
    if (!room.gameEngine.empty())
        details += wxString(L" Moteur : ") + lila::shared::text::FromUtf8(room.gameEngine) + wxString(L".");
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
    if (id == "room:privacy") return Action::TogglePrivacy;
    if (id == "room:role") return Action::ToggleRole;
    if (id == "room:save") return Action::Save;
    if (id == "room:reset") return Action::Reset;
    if (id == "room:leave") return Action::Leave;
    return Action::None;
}
}
