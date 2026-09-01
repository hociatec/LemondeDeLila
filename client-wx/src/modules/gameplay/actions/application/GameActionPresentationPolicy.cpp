#include "modules/gameplay/actions/application/GameActionPresentationPolicy.h"

namespace lila::modules::gameplay::application
{
std::vector<domain::GameLine> GameActionPresentationPolicy::GenericLines(
    const domain::GameState&)
{
    // Server actions are commands, not presentation items. They are exposed
    // only through a server shortcut or a specialized control (card, die,
    // grid, prompt...). Never manufacture a visible fallback list here.
    return {};
}
}
