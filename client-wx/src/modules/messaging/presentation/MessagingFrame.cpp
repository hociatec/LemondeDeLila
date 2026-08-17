#include "modules/messaging/presentation/MessagingFrame.h"
#include "shared/ui/BackgroundTask.h"

#include <algorithm>
#include <array>
#include <ctime>
#include <thread>
#include <utility>

#include <wx/app.h>
#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/weakref.h>

#include "modules/messaging/application/MessagingService.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace
{
constexpr int WindowWidth = 1180;
constexpr int WindowHeight = 780;
}

namespace lila::modules::messaging::presentation
{
MessagingFrame::MessagingFrame(
    lila::modules::messaging::application::MessagingService& messagingService,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              wxString(L"Messagerie - %s"),
              wxString::FromUTF8(shared::config::AppConfig::AppTitle.data())),
      wxDefaultPosition,
      wxSize(WindowWidth, WindowHeight),
      wxDEFAULT_FRAME_STYLE),
      messagingService_(messagingService),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    BuildLayout();
    ApplyTheme();
    BindEvents();

    if (menu_ != nullptr)
    {
        menu_->SetTabNavigationEnabled(false);
        menu_->SetSelectedIndex(lastMenuIndex_);
    }

    SetScreen(Screen::Menu);
    UpdateStatus(
        wxString(
            L"Flèches haut/bas : naviguer. Entrée : sélectionner. "
            L"Échap : revenir."));
    CentreOnScreen();
    CallAfter(
        [this]()
        {
            FocusCurrentScreen();
        });
}

void MessagingFrame::BuildLayout()
{
    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    auto* titleLabel = new wxStaticText(headerPanel, wxID_ANY, wxString(L"Messagerie"));
    auto* subtitleLabel = new wxStaticText(
        headerPanel,
        wxID_ANY,
        wxString(L"Boîte de réception des messages privés"));
    statusLabel_ = new wxStaticText(headerPanel, wxID_ANY, wxString(L"Choisissez une section."));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel_, wxString(L"État de messagerie"));
    headerSizer->Add(titleLabel, 0, wxALIGN_CENTER_HORIZONTAL);
    headerSizer->Add(subtitleLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 4);
    headerSizer->Add(statusLabel_, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    headerPanel->SetSizer(headerSizer);

    screenBook_ = new wxSimplebook(root, wxID_ANY);

    menuPanel_ = new wxPanel(screenBook_);
    {
        auto* sizer = new wxBoxSizer(wxVERTICAL);
        static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 4> menuItems = {{
            {"compose", wxString(L"Rédiger un message"), wxEmptyString},
            {"inbox", wxString(L"Boîte de réception"), wxEmptyString},
            {"outbox", wxString(L"Messages envoyés"), wxEmptyString},
            {"deleted", wxString(L"Corbeille"), wxEmptyString},
        }};
        menu_ = new lila::shared::ui::controls::VerticalMenu(
            menuPanel_,
            lila::shared::ui::navigation::BuildMenuItems(menuItems));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu_, wxString(L"Menu messagerie"));
        sizer->Add(menu_, 1, wxEXPAND);
        menuPanel_->SetSizer(sizer);
    }

    listPanel_ = new wxPanel(screenBook_);
    {
        auto* sizer = new wxBoxSizer(wxVERTICAL);
        listTitleLabel_ = new wxStaticText(listPanel_, wxID_ANY, BoxTitle(currentBox_));
        messagesList_ = new wxListBox(listPanel_, wxID_ANY);
        emptyMessagesCtrl_ = new wxTextCtrl(
            listPanel_,
            wxID_ANY,
            wxString(L"Aucun message."),
            wxDefaultPosition,
            wxDefaultSize,
            wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
        emptyMessagesCtrl_->SetMinSize(wxSize(-1, 80));
        sizer->Add(listTitleLabel_, 0, wxBOTTOM, 10);
        sizer->Add(messagesList_, 1, wxEXPAND | wxBOTTOM, 12);
        sizer->Add(emptyMessagesCtrl_, 0, wxEXPAND);
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*listTitleLabel_, wxString(L"Boîte de messages"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*messagesList_, wxString(L"Liste des messages"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*emptyMessagesCtrl_, wxString(L"Aucun message"));
        lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder({listTitleLabel_, messagesList_, emptyMessagesCtrl_});
        listPanel_->SetSizer(sizer);
    }

    detailPanel_ = new wxPanel(screenBook_);
    {
        auto* sizer = new wxBoxSizer(wxVERTICAL);
        auto* title = new wxStaticText(detailPanel_, wxID_ANY, wxString(L"Détail du message"));
        detailCtrl_ = new wxTextCtrl(
            detailPanel_,
            wxID_ANY,
            wxEmptyString,
            wxDefaultPosition,
            wxDefaultSize,
            wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2);
        detailCtrl_->SetMinSize(wxSize(-1, 420));

        auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
        replyButton_ = new wxButton(detailPanel_, wxID_ANY, wxString(L"Répondre"));
        deleteButton_ = new wxButton(detailPanel_, wxID_ANY, wxString(L"Supprimer"));
        restoreButton_ = new wxButton(detailPanel_, wxID_ANY, wxString(L"Restaurer"));
        purgeButton_ = new wxButton(detailPanel_, wxID_ANY, wxString(L"Supprimer définitivement"));
        buttonSizer->Add(replyButton_, 0, wxRIGHT, 10);
        buttonSizer->Add(deleteButton_, 0, wxRIGHT, 10);
        buttonSizer->Add(restoreButton_, 0, wxRIGHT, 10);
        buttonSizer->Add(purgeButton_, 0);

        sizer->Add(title, 0, wxBOTTOM, 10);
        sizer->Add(detailCtrl_, 1, wxEXPAND | wxBOTTOM, 12);
        sizer->Add(buttonSizer, 0, wxALIGN_LEFT);
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*detailCtrl_, wxString(L"Détail du message"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*replyButton_, wxString(L"Répondre"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*deleteButton_, wxString(L"Supprimer"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*restoreButton_, wxString(L"Restaurer"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*purgeButton_, wxString(L"Supprimer définitivement"));
        lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
            {detailCtrl_, replyButton_, deleteButton_, restoreButton_, purgeButton_});
        detailPanel_->SetSizer(sizer);
    }

    composePanel_ = new wxPanel(screenBook_);
    {
        auto* sizer = new wxBoxSizer(wxVERTICAL);
        auto* title = new wxStaticText(composePanel_, wxID_ANY, wxString(L"Rédiger un message"));
        auto* recipientLabel = new wxStaticText(composePanel_, wxID_ANY, wxString(L"Destinataire"));
        recipientCtrl_ = new wxTextCtrl(composePanel_, wxID_ANY);
        auto* subjectLabel = new wxStaticText(composePanel_, wxID_ANY, wxString(L"Sujet"));
        subjectCtrl_ = new wxTextCtrl(composePanel_, wxID_ANY);
        auto* bodyLabel = new wxStaticText(composePanel_, wxID_ANY, wxString(L"Message"));
        bodyCtrl_ = new wxTextCtrl(
            composePanel_,
            wxID_ANY,
            wxEmptyString,
            wxDefaultPosition,
            wxDefaultSize,
            wxTE_MULTILINE | wxTE_RICH2 | wxTE_PROCESS_TAB);
        bodyCtrl_->SetMinSize(wxSize(-1, 280));

        auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
        sendComposeButton_ = new wxButton(composePanel_, wxID_ANY, wxString(L"Envoyer"));
        cancelComposeButton_ = new wxButton(composePanel_, wxID_ANY, wxString(L"Annuler"));
        buttonSizer->Add(sendComposeButton_, 0, wxRIGHT, 10);
        buttonSizer->Add(cancelComposeButton_, 0);

        sizer->Add(title, 0, wxBOTTOM, 10);
        sizer->Add(recipientLabel, 0, wxBOTTOM, 6);
        sizer->Add(recipientCtrl_, 0, wxEXPAND | wxBOTTOM, 10);
        sizer->Add(subjectLabel, 0, wxBOTTOM, 6);
        sizer->Add(subjectCtrl_, 0, wxEXPAND | wxBOTTOM, 10);
        sizer->Add(bodyLabel, 0, wxBOTTOM, 6);
        sizer->Add(bodyCtrl_, 1, wxEXPAND | wxBOTTOM, 12);
        sizer->Add(buttonSizer, 0, wxALIGN_LEFT);
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*recipientLabel, wxString(L"Destinataire"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*recipientCtrl_, wxString(L"Champ destinataire"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subjectLabel, wxString(L"Sujet"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subjectCtrl_, wxString(L"Champ sujet"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*bodyLabel, wxString(L"Message"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*bodyCtrl_, wxString(L"Contenu du message"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sendComposeButton_, wxString(L"Envoyer"));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelComposeButton_, wxString(L"Annuler"));
        lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
            {recipientCtrl_, subjectCtrl_, bodyCtrl_, sendComposeButton_, cancelComposeButton_});
        composePanel_->SetSizer(sizer);
    }

    screenBook_->AddPage(menuPanel_, wxString(L"Menu"));
    screenBook_->AddPage(listPanel_, wxString(L"Liste"));
    screenBook_->AddPage(detailPanel_, wxString(L"Détail"));
    screenBook_->AddPage(composePanel_, wxString(L"Rédaction"));

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(screenBook_, 1, wxEXPAND | wxALL, 24);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);
}

void MessagingFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    const auto styleWindow = [](wxWindow* window)
    {
        if (window == nullptr)
        {
            return;
        }

        window->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
        window->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    for (wxWindow* child : GetChildren())
    {
        styleWindow(child);
    }

    styleWindow(menuPanel_);
    styleWindow(listPanel_);
    styleWindow(detailPanel_);
    styleWindow(composePanel_);

    messagesList_->SetBackgroundColour(wxColour(12, 21, 35));
    messagesList_->SetForegroundColour(Theme::TextPrimary());
    emptyMessagesCtrl_->SetBackgroundColour(wxColour(12, 21, 35));
    emptyMessagesCtrl_->SetForegroundColour(Theme::TextPrimary());
    detailCtrl_->SetBackgroundColour(wxColour(12, 21, 35));
    detailCtrl_->SetForegroundColour(Theme::TextPrimary());
    recipientCtrl_->SetBackgroundColour(wxColour(10, 24, 39));
    recipientCtrl_->SetForegroundColour(Theme::TextPrimary());
    subjectCtrl_->SetBackgroundColour(wxColour(10, 24, 39));
    subjectCtrl_->SetForegroundColour(Theme::TextPrimary());
    bodyCtrl_->SetBackgroundColour(wxColour(10, 24, 39));
    bodyCtrl_->SetForegroundColour(Theme::TextPrimary());
    statusLabel_->SetForegroundColour(Theme::Accent());
}

void MessagingFrame::UpdateStatus(const wxString& message, bool isError)
{
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(
        isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}

void MessagingFrame::RunBackgroundTask(
    const wxString& busyMessage,
    const std::function<void()>& worker,
    const std::function<void()>& onSuccess)
{
    if (isBusy_)
    {
        UpdateStatus(wxString::FromUTF8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    SetBusyState(true, busyMessage);
    wxWeakRef<MessagingFrame> weakSelf(this);
    lila::shared::ui::RunBackgroundTask(
        this,
        worker,
        [weakSelf, onSuccess](std::string errorMessage) mutable
        {
            if (!weakSelf)
            {
                return;
            }

            weakSelf->SetBusyState(false);
            if (!errorMessage.empty())
            {
                weakSelf->UpdateStatus(wxString::FromUTF8(errorMessage), true);
                return;
            }

            if (onSuccess)
            {
                onSuccess();
            }
        });
}

void MessagingFrame::SetBusyState(bool busy, const wxString& message)
{
    isBusy_ = busy;
    if (busy && !message.empty())
    {
        UpdateStatus(message);
    }

    SyncBusyState();
}

void MessagingFrame::SyncBusyState()
{
    sendComposeButton_->Enable(!isBusy_);
    replyButton_->Enable(!isBusy_ && replyButton_->IsShown());
    deleteButton_->Enable(!isBusy_ && deleteButton_->IsShown());
    restoreButton_->Enable(!isBusy_ && restoreButton_->IsShown());
    purgeButton_->Enable(!isBusy_ && purgeButton_->IsShown());
}

void MessagingFrame::SyncPanels()
{
    switch (currentScreen_)
    {
    case Screen::Menu:
        screenBook_->SetSelection(0);
        break;
    case Screen::List:
        screenBook_->SetSelection(1);
        break;
    case Screen::Detail:
        screenBook_->SetSelection(2);
        break;
    case Screen::Compose:
        screenBook_->SetSelection(3);
        break;
    }
}

void MessagingFrame::SyncSelectionState()
{
    const bool hasMessages = !boxMessages_.empty();
    messagesList_->Show(hasMessages);
    emptyMessagesCtrl_->Show(!hasMessages);

    const int selection = messagesList_->GetSelection();
    if (hasMessages && selection >= 0 && static_cast<std::size_t>(selection) < boxMessages_.size())
    {
        selectedMessageId_ = boxMessages_[static_cast<std::size_t>(selection)].id;
    }
    else
    {
        selectedMessageId_.reset();
    }

    const auto selected = GetSelectedMessage();
    if (!selected.has_value())
    {
        detailCtrl_->SetValue(wxString(L"Aucun message."));
        replyButton_->Show(false);
        deleteButton_->Show(false);
        restoreButton_->Show(false);
        purgeButton_->Show(false);
        return;
    }

    detailCtrl_->SetValue(BuildMessageDetail(*selected));
    const bool deleted = currentBox_ == domain::MessagingBox::Deleted;
    replyButton_->Show(!deleted);
    deleteButton_->Show(!deleted);
    restoreButton_->Show(deleted);
    purgeButton_->Show(deleted);
}

void MessagingFrame::SetScreen(Screen screen)
{
    if (currentScreen_ == Screen::List)
    {
        SaveCurrentBoxSelection();
    }

    if (screen == Screen::Menu)
    {
        if (menu_ != nullptr)
        {
            menu_->SetSelectedIndex(lastMenuIndex_);
        }
    }

    if (screen == Screen::List)
    {
        RestoreCurrentBoxSelection();
    }

    currentScreen_ = screen;
    SyncPanels();
    SyncSelectionState();
    CallAfter(
        [this]()
        {
            FocusCurrentScreen();
        });
}

wxString MessagingFrame::BoxTitle(domain::MessagingBox box)
{
    switch (box)
    {
    case domain::MessagingBox::Inbox:
        return wxString(L"Boîte de réception");
    case domain::MessagingBox::Outbox:
        return wxString(L"Messages envoyés");
    case domain::MessagingBox::Deleted:
        return wxString(L"Corbeille");
    }

    return wxString(L"Messagerie");
}

std::size_t MessagingFrame::GetBoxIndex(domain::MessagingBox box) const
{
    switch (box)
    {
    case domain::MessagingBox::Inbox:
        return 0;
    case domain::MessagingBox::Outbox:
        return 1;
    case domain::MessagingBox::Deleted:
        return 2;
    }

    return 0;
}
}
