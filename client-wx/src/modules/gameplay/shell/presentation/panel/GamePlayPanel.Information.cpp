#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::HandleInterfaceShortcut(const std::string& id)
{
    if (id.empty()) return false;

    // The detailed-action panel was deliberately removed. Interface shortcuts
    // declared by games must therefore announce their information directly;
    // otherwise keys such as C in Lama are received but appear to do nothing.
    const auto message = application::info::GameCapabilityTextBuilder::Build(state_, id);
    UpdateStatus(
        message.empty() ? wxString(L"Information indisponible.") : FromUtf8(message),
        false,
        true);
    return true;
}
}
