#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialFocusController.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include "shared/ui/controls/VerticalMenu.h"

#include <stdexcept>

namespace lila::modules::social::presentation
{
void SocialFrame::SetScreen(Screen screen)
{
    if (screen == Screen::Menu)
    {
        navigationState_.EnterMenu();
    }
    else
    {
        navigationState_.currentScreen = screen;
    }
    if (screen == Screen::Menu && view_->menu != nullptr)
    {
        view_->menu->SetSelectedIndex(navigationState_.lastMenuIndex);
    }

    focusController_->FocusCurrentScreen();
}

void SocialFrame::ActivateSelectedMenu()
{
    ActivateMenuIndex(view_->menu->GetSelectedIndex());
}

void SocialFrame::ActivateMenuIndex(std::size_t index)
{
    navigationState_.lastMenuIndex = index;
    if (index == 0)
    {
        if (onOpenMessagingRequested_)
        {
            onOpenMessagingRequested_(navigationState_.lastMenuIndex);
        }
        return;
    }

    const auto section = SocialPresentationModel::MenuIndexToSection(index);
    if (!section.has_value())
    {
        return;
    }

    if (*section == SocialSection::Profile)
    {
        navigationState_.returnSectionFromProfile.reset();
        LoadProfile(std::nullopt);
    }

    SetSection(*section);
}

void SocialFrame::ActivateProfileEditorSelection()
{
    if (!dataStore_.Profile().has_value() || !dataStore_.Profile()->isOwner)
    {
        return;
    }

    switch (view_->profileMenu->GetSelectedIndex())
    {
    case 0:
        StartProfileEdit(ProfileEditorMode::Bio);
        return;
    case 1:
        StartProfileEdit(ProfileEditorMode::VictoryMessage);
        return;
    case 2:
        StartProfileEdit(ProfileEditorMode::DefeatMessage);
        return;
    case 3:
        StartProfileEdit(ProfileEditorMode::Visibility);
        return;
    default:
        return;
    }
}

void SocialFrame::HandleEscape()
{
    try
    {
        if (navigationState_.currentScreen == Screen::Section)
        {
            if (navigationState_.currentSection == SocialSection::Profile && TryExitProfile())
            {
                return;
            }

            SetScreen(Screen::Menu);
            return;
        }

        if (onCloseRequested_)
        {
            onCloseRequested_();
        }
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogError("Social", error.what());
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::UnexpectedError), true);
    }
}
}
