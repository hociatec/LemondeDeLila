#ifdef NDEBUG
#undef NDEBUG
#endif

#include <cassert>
#include <string>

#include "modules/gameplay/grid/application/GameGridAccessibilityText.h"

int main()
{
    using lila::modules::gameplay::application::grid::GameGridAccessibilityText;

    assert(GameGridAccessibilityText(1).find("Page précédente") == std::string::npos);
    assert(GameGridAccessibilityText(2).find("Page précédente") != std::string::npos);
}
