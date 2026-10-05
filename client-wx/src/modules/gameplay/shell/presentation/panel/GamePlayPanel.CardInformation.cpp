#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>

#include <wx/window.h>

#include "modules/gameplay/cards/application/GameCardTextBuilder.h"
#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::AnnounceSelectedHandCard()
{
    auto* focused = wxWindow::FindFocus();
    if (!handPanel_->IsShown() || focused != handPanel_->NavigationTarget())
        return false;
    const auto cardKey = handPanel_->SelectedCardKey();
    const auto& hand = state_.kits.VisibleHand();
    const auto selected = std::find_if(hand.begin(), hand.end(), [&cardKey](const auto& card)
    { return card.id == cardKey; });
    if (selected == hand.end())
    {
        UpdateStatus(wxString(L"Aucune carte sélectionnée."), true, true);
        return true;
    }
    UpdateStatus(lila::shared::text::FromUtf8(
        application::cards::GameCardTextBuilder::DescriptionText(*selected)), false, true);
    return true;
}
}
