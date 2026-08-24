#include "modules/presence/presentation/PresencePresentationModel.h"

#include <algorithm>

#include "modules/session/domain/Session.h"
#include "shared/text/Encoding.h"

namespace lila::modules::presence::presentation
{
namespace
{
using MenuItem = lila::shared::ui::controls::VerticalMenuItem;

wxString FromUtf8(const std::string& value)
{
    return lila::shared::text::FromUtf8(value);
}

std::string Normalize(std::string value)
{
    std::ranges::transform(value, value.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}

wxString AvailabilityLabel(const std::string& availability)
{
    const auto normalized = Normalize(availability);
    if (normalized == "available")
    {
        return wxString(L"disponible");
    }
    if (normalized == "occupied")
    {
        return wxString(L"occupe");
    }
    if (normalized == "absent")
    {
        return wxString(L"absent");
    }
    return wxEmptyString;
}

wxString ActivityLocation(const domain::PresencePlayer& player)
{
    if (!player.location.empty())
    {
        return FromUtf8(player.location);
    }
    if (player.currentRoomId.has_value())
    {
        return player.currentRoomName.empty()
            ? wxString::Format(wxString(L"Table #%d"), *player.currentRoomId)
            : FromUtf8(player.currentRoomName);
    }

    const auto activity = Normalize(player.activity);
    if (activity == "chat")
    {
        return wxString(L"tchat");
    }
    if (activity == "tavern")
    {
        return wxString(L"taverne");
    }
    if (activity == "stats")
    {
        return wxString(L"livre des contes");
    }
    if (activity == "messaging")
    {
        return wxString(L"messagerie");
    }
    if (activity == "social")
    {
        return wxString(L"social");
    }
    return wxString(L"accueil");
}
}

wxString PresencePresentationModel::BuildPlayerLabel(const domain::PresencePlayer& player)
{
    wxString label = FromUtf8(player.username);
    const wxString availability = AvailabilityLabel(player.availability);
    if (!availability.empty())
    {
        label += wxString(L" (") + availability + wxString(L")");
    }
    label += wxString(L", ") + ActivityLocation(player);
    return label;
}

wxString PresencePresentationModel::BuildTitle(std::size_t playerCount)
{
    return playerCount == 1
        ? wxString(L"Presence (1 connecte)")
        : wxString::Format(wxString(L"Presence (%zu connectes)"), playerCount);
}

std::vector<MenuItem> PresencePresentationModel::BuildPlayerItems(
    const std::vector<domain::PresencePlayer>& players)
{
    std::vector<MenuItem> items;
    items.reserve(players.size());
    for (const auto& player : players)
    {
        items.push_back({std::to_string(player.id), BuildPlayerLabel(player)});
    }
    if (items.empty())
    {
        items.push_back({"empty", wxString(L"Aucun joueur connecte.")});
    }
    return items;
}

std::vector<MenuItem> PresencePresentationModel::BuildActionItems(const PresenceSocialState& socialState)
{
    std::vector<MenuItem> items;
    items.push_back(socialState.isBlocked ? MenuItem{"unblock", wxString(L"Debloquer")} : MenuItem{"block", wxString(L"Bloquer")});
    if (socialState.isFriend)
    {
        items.push_back({"friend.remove", wxString(L"Retirer de mes amis")});
    }
    else if (socialState.incomingRequest)
    {
        items.push_back({"friend.accept", wxString(L"Accepter la demande d'ami")});
        items.push_back({"friend.reject", wxString(L"Refuser la demande d'ami")});
    }
    else if (socialState.outgoingRequest)
    {
        items.push_back({"friend.cancel", wxString(L"Annuler ma demande d'ami")});
    }
    else
    {
        items.push_back({"friend.add", wxString(L"Ajouter en ami")});
    }
    items.push_back({"storybook", wxString(L"Voir son livre des contes")});
    items.push_back({"bio", wxString(L"Voir sa bio")});
    items.push_back({"message", wxString(L"Envoyer un message priv\u00E9")});
    return items;
}

bool PresencePresentationModel::IsSelf(
    const domain::PresencePlayer& player,
    const lila::modules::session::domain::Session& session)
{
    return player.id == session.userId.value || Normalize(player.username) == Normalize(session.username);
}
}
