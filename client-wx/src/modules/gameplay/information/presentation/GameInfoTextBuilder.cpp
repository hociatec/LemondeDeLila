#include "modules/gameplay/information/presentation/GameInfoTextBuilder.h"

#include <array>

#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::info
{
wxString GameInfoTextBuilder::Build(
    const domain::GameState& state,
    const std::string& panelId,
    const wxString& selectedLineDetail)
{
    if (panelId == "details")
    {
        wxString text = selectedLineDetail;
        constexpr std::array<const char*, 15> Capabilities{
            "cards", "dice", "grid", "movement", "pawns", "score",
            "resources", "counters", "status", "inventory", "economy",
            "ownership", "collections", "quiz", "submissions"};
        wxString available;
        for (const auto* capability : Capabilities)
        {
            if (!state.kits.Has(capability)) continue;
            if (!available.empty()) available += wxString(L", ");
            available += FromUtf8(capability);
        }
        if (!available.empty()) text += wxString(L"\nCapacités : ") + available;
        return text;
    }
    const auto value = application::info::GameCapabilityTextBuilder::Build(state, panelId);
    return value.empty() ? wxString(L"Information indisponible.") : FromUtf8(value);
}
}
