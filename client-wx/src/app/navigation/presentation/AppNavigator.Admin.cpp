#include "app/navigation/presentation/AppNavigator.h"

#include "modules/session/application/SessionStore.h"

namespace lila::app::navigation
{
void AppNavigator::ShowAdmin(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    if (!sessionStore_.Current().IsAdmin())
    {
        ShowSession(selectedIndex);
        return;
    }
    ReplaceView(domain::ViewId::Admin, GetOrCreateView(domain::ViewId::Admin));
}
}
