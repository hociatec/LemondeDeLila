#include "shared/text/Encoding.h"
#include "modules/about/presentation/AboutPageCoordinator.h"
#include "modules/about/presentation/AboutPageContentBuilder.h"

#include <span>
#include <utility>

#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/about/presentation/AboutFrame.h"
#include "modules/session/application/SessionStore.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/FocusManager.h"
#include "shared/accessibility/FocusCoordinator.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::about::presentation
{
AboutPageCoordinator::AboutPageCoordinator(
    AboutFrame& frame,
    lila::modules::session::application::SessionStore& sessionStore,
    Callbacks callbacks) noexcept
    : frame_(frame),
      sessionStore_(sessionStore),
      callbacks_(std::move(callbacks))
{
}

void AboutPageCoordinator::InitializeRootPage()
{
    currentPage_ = Page::Root;
    ApplyPageContent(Page::Root, wxNOT_FOUND);
    SyncPageVisibility(Page::Root);
    frame_.Layout();
}

void AboutPageCoordinator::ShowPage(Page page, bool pushCurrentToHistory, int restoreSelection)
{
    if (pushCurrentToHistory)
    {
        navigationHistory_.Push(CaptureSnapshot());
    }

    currentPage_ = page;
    ApplyPageContent(page, restoreSelection);
    SyncPageVisibility(page);
    frame_.Layout();
    lila::shared::accessibility::FocusCoordinator::Schedule(
        frame_,
        [this]() { return BuildCurrentPageFocusPlan(); });
}

void AboutPageCoordinator::ActivateRootItem(std::size_t index)
{
    if (currentPage_ != Page::Root)
    {
        return;
    }

    if (index == 0)
    {
        ShowPage(Page::Shortcuts, true);
    }
    else if (index == 1)
    {
        ShowPage(Page::Info, true);
    }
    else if (index == 2)
    {
        ShowPage(Page::ContactAdmin, true);
    }
}

lila::shared::accessibility::FocusManager::Plan AboutPageCoordinator::BuildCurrentPageFocusPlan() const
{
    using FocusManager = lila::shared::accessibility::FocusManager;
    FocusManager::Plan plan;

    switch (currentPage_)
    {
    case Page::Root:
    case Page::Info:
        if (frame_.itemsList_ != nullptr)
        {
            plan.AddWindow(frame_.itemsList_->GetSelectedControl());
        }
        break;
    case Page::Shortcuts:
        plan.AddWindow(frame_.shortcutsTextCtrl_);
        break;
    case Page::ContactAdmin:
        plan.AddWindow(frame_.contactMessageCtrl_);
        break;
    }

    return plan;
}

void AboutPageCoordinator::HandleEscape()
{
    if (navigationHistory_.Empty())
    {
        if (callbacks_.onCloseRequested)
        {
            callbacks_.onCloseRequested();
        }
        return;
    }

    const auto snapshot = navigationHistory_.Pop();
    RestoreSnapshot(snapshot);
}

AboutPageCoordinator::NavigationSnapshot AboutPageCoordinator::CaptureSnapshot() const
{
    NavigationSnapshot snapshot;
    snapshot.page = currentPage_;
    snapshot.selectedIndex = frame_.itemsList_ != nullptr && frame_.itemsList_->IsShown()
        ? static_cast<int>(frame_.itemsList_->GetSelectedIndex())
        : wxNOT_FOUND;
    return snapshot;
}

void AboutPageCoordinator::RestoreSnapshot(const NavigationSnapshot& snapshot)
{
    ShowPage(snapshot.page, false, snapshot.selectedIndex);
}

void AboutPageCoordinator::SyncPageVisibility(Page page) const
{
    if (frame_.itemsList_ != nullptr)
    {
        frame_.itemsList_->Show(page == Page::Root || page == Page::Info);
    }

    if (frame_.shortcutsTextCtrl_ != nullptr)
    {
        frame_.shortcutsTextCtrl_->Show(page == Page::Shortcuts);
    }

    if (frame_.contactMessageCtrl_ != nullptr && frame_.contactMessageCtrl_->GetParent() != nullptr)
    {
        frame_.contactMessageCtrl_->GetParent()->Show(page == Page::ContactAdmin);
    }
}

void AboutPageCoordinator::ApplyPageContent(Page page, int restoreSelection)
{
    AboutPageContent content;
    frame_.detailsLabel_->SetLabel(wxEmptyString);
    switch (page)
    {
    case Page::Root:
        content = AboutPageContentBuilder::BuildRoot();
        BuildRootMenuItems();
        break;
    case Page::Shortcuts:
        content = AboutPageContentBuilder::BuildShortcuts();
        frame_.shortcutsTextCtrl_->SetValue(content.shortcutsText);
        break;
    case Page::Info:
        content = AboutPageContentBuilder::BuildInfo(sessionStore_);
        BuildInfoItems();
        break;
    case Page::ContactAdmin:
        content = AboutPageContentBuilder::BuildContactAdmin();
        frame_.contactMessageCtrl_->SetValue(wxEmptyString);
        break;
    }

    frame_.titleLabel_->SetLabel(content.title);
    callbacks_.updateStatus(content.statusMessage);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*frame_.titleLabel_, content.accessibleTitle);
    if (frame_.itemsList_->IsShown() &&
        restoreSelection != wxNOT_FOUND &&
        restoreSelection < static_cast<int>(frame_.itemsList_->GetItemCount()))
    {
        frame_.itemsList_->SetSelectedIndexSilently(static_cast<std::size_t>(restoreSelection));
    }
}

void AboutPageCoordinator::BuildRootMenuItems() const
{
    const lila::shared::ui::controls::VerticalMenuItem rootItems[] = {
        {"shortcuts", wxString(L"Raccourcis")},
        {"info", wxString(L"Informations sur l'application")},
        {"contact", wxString(L"Contacter un administrateur")}};
    frame_.itemsList_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>(rootItems, 3));
    if (frame_.itemsList_->GetItemCount() > 0)
    {
        frame_.itemsList_->SetSelectedIndexSilently(0);
    }
}

void AboutPageCoordinator::BuildInfoItems() const
{
    const lila::shared::ui::controls::VerticalMenuItem infoItems[] = {
        {"name", wxString::Format(L"Nom : %s", lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data()))},
        {"version", wxString::Format(L"Version actuelle : %s", lila::shared::text::FromUtf8(shared::config::AppConfig::ResolveClientVersion()))},
        {"updated", wxString::Format(L"Derniere mise a jour locale : %s", AboutPageContentBuilder::ResolveLocalUpdatedAt())},
        {"user", wxString::Format(L"Connecte en tant que : %s", lila::shared::text::FromUtf8(sessionStore_.Current().username))}};
    frame_.itemsList_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>(infoItems, 4));
    if (frame_.itemsList_->GetItemCount() > 0)
    {
        frame_.itemsList_->SetSelectedIndexSilently(0);
    }
}
}
