#pragma once

#include <wx/string.h>

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::about::presentation
{
struct AboutPageContent final
{
    wxString title;
    wxString statusMessage;
    wxString accessibleTitle;
    wxString shortcutsText;
};

class AboutPageContentBuilder final
{
public:
    [[nodiscard]] static AboutPageContent BuildRoot();
    [[nodiscard]] static AboutPageContent BuildShortcuts();
    [[nodiscard]] static AboutPageContent BuildInfo(
        lila::modules::session::application::SessionStore& sessionStore);
    [[nodiscard]] static AboutPageContent BuildContactAdmin();
    [[nodiscard]] static wxString ResolveLocalUpdatedAt();
};
}
