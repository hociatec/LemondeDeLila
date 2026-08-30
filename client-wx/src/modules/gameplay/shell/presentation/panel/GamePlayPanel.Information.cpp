#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <array>
#include <utility>

#include <wx/choice.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::RebuildInfoPanelChoices()
{
    static constexpr std::array Capabilities{
        std::pair{"cards", L"Cartes et zones"}, std::pair{"dice", L"Dés"},
        std::pair{"grid", L"Grille"}, std::pair{"movement", L"Déplacements"},
        std::pair{"pawns", L"Pions"}, std::pair{"score", L"Scores et classement"},
        std::pair{"resources", L"Ressources"}, std::pair{"counters", L"Compteurs"},
        std::pair{"status", L"Statuts"}, std::pair{"inventory", L"Inventaires"},
        std::pair{"economy", L"Marché et économie"}, std::pair{"ownership", L"Propriétés"},
        std::pair{"collections", L"Collections"}, std::pair{"quiz", L"Quiz"},
        std::pair{"submissions", L"Soumissions"}};
    infoPanelChoice_->Clear();
    infoPanelIds_.clear();
    const auto append = [this](std::string id, const wchar_t* label)
    {
        infoPanelIds_.push_back(std::move(id));
        infoPanelChoice_->Append(wxString(label));
    };
    append("details", L"Détails de l’action sélectionnée");
    append("match", L"Match");
    append("round", L"Manche");
    append("turn", L"Tour");
    append("players", L"Joueurs");
    append("setup", L"Configuration");
    for (const auto& [id, label] : Capabilities)
        if (state_.kits.Has(id)) append(id, label);
    if (state_.effect) append("effect", L"Effet courant");
    if (!state_.timers.empty()) append("timers", L"Minuteries");
    if (!state_.game.empty()) append("specific", L"Informations spécifiques");
    const auto selected = std::find(infoPanelIds_.begin(), infoPanelIds_.end(), activeInfoPanel_);
    if (selected == infoPanelIds_.end()) activeInfoPanel_ = "details";
    const auto current = std::find(infoPanelIds_.begin(), infoPanelIds_.end(), activeInfoPanel_);
    infoPanelChoice_->SetSelection(static_cast<int>(std::distance(infoPanelIds_.begin(), current)));
    infoPanelChoice_->Show(infoPanelIds_.size() > 1);
}

void GamePlayPanel::SelectInfoPanel(const std::string& id, bool announce)
{
    activeInfoPanel_ = id;
    const auto found = std::find(infoPanelIds_.begin(), infoPanelIds_.end(), id);
    if (found != infoPanelIds_.end())
        infoPanelChoice_->SetSelection(static_cast<int>(std::distance(infoPanelIds_.begin(), found)));
    UpdateInfoPanel();
    const auto text = BuildInfoText(id);
    if (announce && onHistoryMessage_ && !text.empty()) onHistoryMessage_(text);
}
}
