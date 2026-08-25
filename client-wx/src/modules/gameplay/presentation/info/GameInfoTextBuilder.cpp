#include "modules/gameplay/presentation/info/GameInfoTextBuilder.h"

#include <algorithm>
#include <sstream>

#include <nlohmann/json.hpp>

#include "modules/gameplay/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::info
{
wxString GameInfoTextBuilder::Build(
    const domain::GameState& state,
    const std::string& panelId,
    const wxString& selectedLineDetail)
{
    if (panelId == "details")
    {
        wxString text;
        if (state.prompt)
        {
            const auto& label = state.prompt->label.empty() ? state.prompt->title : state.prompt->label;
            if (!label.empty()) text = FromUtf8(label) + wxString(L"\n");
        }
        return text + selectedLineDetail;
    }

    if (panelId == "hands")
    {
        const auto hand = state.extras.find("hand");
        if (hand != state.extras.end() && hand->is_array())
        {
            const auto count = hand->size();
            return FromUtf8(
                "Vous avez " + std::to_string(count) +
                (count == 1 ? " carte." : " cartes."));
        }
    }

    std::ostringstream out;
    const auto ui = state.extras.find("ui");
    if (ui != state.extras.end() && ui->is_object())
    {
        const auto panels = ui->find("panels");
        if (panels != ui->end() && panels->is_object())
        {
            const auto panel = panels->find(panelId);
            if (panel != panels->end())
            {
                std::string display;
                if (panel->is_object())
                {
                    const auto message = panel->find("message");
                    if (message != panel->end() && message->is_string())
                        display = message->get<std::string>();
                }
                if (display.empty()) display = PanelJsonToDisplay(*panel);
                if (panelId == "hands" || panelId == "score" || panelId == "scores")
                    std::replace(display.begin(), display.end(), ',', '\n');
                return FromUtf8(display);
            }
        }
    }
    const auto panels = state.extras.find("panels");
    if (panels != state.extras.end() && panels->is_object())
    {
        const auto panel = panels->find(panelId);
        if (panel != panels->end()) return FromUtf8(PanelJsonToDisplay(*panel));
    }
    out << panelId << '\n';
    const auto direct = state.extras.find(panelId);
    if (direct != state.extras.end())
    {
        out << PanelJsonToDisplay(*direct);
        return FromUtf8(out.str());
    }
    if (panelId == "score" || panelId == "scores")
    {
        const auto scores = state.metadata.find("scoresByPlayerId");
        if (scores != state.metadata.end())
        {
            AppendJsonObjectLines(out, *scores);
            return FromUtf8(out.str());
        }
    }
    if (panelId == "hands")
    {
        const auto hands = state.metadata.find("handsByPlayerId");
        if (hands != state.metadata.end())
        {
            AppendJsonObjectLines(out, *hands);
            return FromUtf8(out.str());
        }
    }
    if (panelId == "discard")
    {
        const auto discard = state.metadata.find("discard");
        if (discard != state.metadata.end())
        {
            out << JsonToDisplay(*discard);
            return FromUtf8(out.str());
        }
    }
    out << "Information indisponible.";
    return FromUtf8(out.str());
}
}
