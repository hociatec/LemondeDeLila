#include "modules/social/presentation/SocialView.h"

#include "shared/text/Encoding.h"

namespace lila::modules::social::presentation
{
SocialView::SocialView(wxWindow* parent): wxPanel(parent) { BuildLayout(); }
}
