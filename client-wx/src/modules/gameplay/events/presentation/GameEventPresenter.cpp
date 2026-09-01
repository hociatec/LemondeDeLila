#include "modules/gameplay/events/presentation/GameEventPresenter.h"

namespace lila::modules::gameplay::presentation::events
{
std::string GameEventPresenter::Present(
    const domain::GameEngineEvent& event,
    const std::vector<domain::GamePlayer>& players)
{
    static_cast<void>(players);
    return event.details.announce ? event.details.message : std::string{};
}
}
