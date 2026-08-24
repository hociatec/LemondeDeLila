#include "modules/main_menu/presentation/MainMenuFrame.h"

#include <wx/event.h>
#include <wx/msgdlg.h>

#include "modules/main_menu/presentation/MainMenuContent.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/navigation/MenuBlueprint.h"

namespace lila::modules::main_menu::presentation
{
void MainMenuFrame::BindEvents()
{
    if (menu_ == nullptr)
    {
        return;
    }

    lila::shared::ui::navigation::BindMenuHandlers(
        *menu_,
        [this](std::size_t index)
        {
            selectedMenuIndex_ = index;
            OnMenuSelectionChanged(index);
        },
        [this](std::size_t index)
        {
            selectedMenuIndex_ = index;
            OnMenuActivated(index);
        });
}

void MainMenuFrame::OnLogoutClicked(wxCommandEvent& event)
{
    (void)event;

    if (onLogoutRequested_)
    {
        if (menu_ == nullptr || menu_->GetItemCount() == 0)
        {
            return;
        }

        onLogoutRequested_(selectedMenuIndex_);
    }
}

void MainMenuFrame::OnMenuSelectionChanged(std::size_t index)
{
    const auto entries = GetMainMenuEntries();
    if (index >= entries.size())
    {
        return;
    }

    if (!optionsStore_.Current().showNavigationStatus)
    {
        SetStatus(wxString(L"Flèches haut/bas : naviguer. Entrée : sélectionner."));
        return;
    }

    SetStatus(wxString(entries[index].statusMessage.data()));
}

void MainMenuFrame::OnMenuActivated(std::size_t index)
{
    const auto entries = GetMainMenuEntries();
    if (index >= entries.size())
    {
        return;
    }

    switch (entries[index].action)
    {
    case MainMenuAction::OpenAbout:
        if (onOpenAboutRequested_)
        {
            onOpenAboutRequested_(index);
        }
        return;
    case MainMenuAction::OpenOptions:
        if (onOpenOptionsRequested_)
        {
            onOpenOptionsRequested_(index);
        }
        return;
    case MainMenuAction::OpenSocial:
        if (onOpenSocialRequested_)
        {
            onOpenSocialRequested_(index);
        }
        return;
    case MainMenuAction::OpenChat:
        if (onOpenChatRequested_)
        {
            onOpenChatRequested_(index);
        }
        return;
    case MainMenuAction::Logout:
    {
        wxCommandEvent event;
        OnLogoutClicked(event);
        return;
    }
    case MainMenuAction::OpenCatalog:
        if (onOpenCatalogRequested_)
        {
            onOpenCatalogRequested_(index);
        }
        return;
    }
}
}
