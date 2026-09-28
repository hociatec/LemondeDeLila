#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include "modules/gameplay/hand/presentation/GameHandPanel.h"
#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::HandleInterfaceShortcut(const std::string& id)
{
    if (id.empty()) return false;
    if (id == "hand-sort-ascending" || id == "hand-sort-descending")
    {
        const bool ascending = id == "hand-sort-ascending";
        if (!handPanel_->Sort(ascending))
        {
            UpdateStatus(wxString(L"Votre main est indisponible."), false, true);
            return true;
        }
        UpdateStatus(ascending ? wxString(L"Main triée par ordre croissant.")
                               : wxString(L"Main triée par ordre décroissant."), false, true);
        return true;
    }

    // The detailed-action panel was deliberately removed. Interface shortcuts
    // declared by games must therefore announce their information directly;
    // otherwise declared information shortcuts appear to do nothing.
    const auto message = application::info::GameCapabilityTextBuilder::Build(state_, id);
    UpdateStatus(
        message.empty() ? wxString(L"Information indisponible.")
                        : lila::shared::text::FromUtf8(message),
        false,
        true);
    return true;
}
}
