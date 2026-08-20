#include "modules/options/presentation/OptionsView.h"

#include <utility>

namespace
{
constexpr int SectionMenuMinWidth = 220;
}

namespace lila::modules::options::presentation
{
OptionsView::OptionsView(wxWindow* parent, SaveRequestedHandler onSave)
    : wxPanel(parent),
      onSave_(std::move(onSave))
{
    BuildLayout();
}
}
