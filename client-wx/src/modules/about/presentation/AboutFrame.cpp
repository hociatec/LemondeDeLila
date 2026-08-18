#include "shared/text/Encoding.h"
#include "modules/about/presentation/AboutFrame.h"

#include <utility>

#include <wx/button.h>
#include <wx/datetime.h>
#include <wx/filename.h>
#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/stdpaths.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/session/application/SessionStore.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/Theme.h"

namespace
{
constexpr int WindowWidth = 960;
constexpr int WindowHeight = 700;
}

namespace lila::modules::about::presentation
{
AboutFrame::AboutFrame(
    lila::modules::session::application::SessionStore& sessionStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              wxString(L"À propos - %s"),
              lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data())),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      sessionStore_(sessionStore),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    BuildLayout();
    ApplyTheme();
    BindEvents();
    ShowPage(Page::Root);
    CentreOnScreen();
    CallAfter(
        [this]()
        {
            FocusCurrentPage();
        });
}

void AboutFrame::BuildLayout()
{
    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(headerPanel, wxID_ANY, wxString(L"À propos"));
    auto* subtitleLabel = new wxStaticText(
        headerPanel,
        wxID_ANY,
        wxString(L"Informations du client natif, raccourcis clavier et contact administrateur."));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel_, wxString(L"À propos"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel, wxString(L"Informations"));
    headerSizer->Add(titleLabel_, 0, wxBOTTOM, 6);
    headerSizer->Add(subtitleLabel, 0);
    headerPanel->SetSizer(headerSizer);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* contentSizer = new wxBoxSizer(wxVERTICAL);

    static const lila::shared::ui::controls::VerticalMenuItem rootItems[] = {
        {"shortcuts", wxString(L"Raccourcis")},
        {"info", wxString(L"Informations sur l'application")},
        {"contact", wxString(L"Contacter un administrateur")}};
    itemsList_ = new lila::shared::ui::controls::VerticalMenu(
        contentPanel,
        std::span<const lila::shared::ui::controls::VerticalMenuItem>(rootItems, 3));
    detailsLabel_ = new wxStaticText(contentPanel, wxID_ANY, wxEmptyString);
    shortcutsTextCtrl_ = new wxTextCtrl(
        contentPanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2);
    auto* contactPanel = new lila::shared::accessibility::NonFocusablePanel(contentPanel, 0);
    contactMessageCtrl_ = new wxTextCtrl(
        contactPanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_RICH2);
    contactMessageCtrl_->SetMinSize(wxSize(-1, 180));

    auto* contactButtonsSizer = new wxBoxSizer(wxHORIZONTAL);
    sendContactButton_ = new wxButton(contactPanel, wxID_ANY, L"Envoyer");
    cancelContactButton_ = new wxButton(contactPanel, wxID_ANY, L"Annuler");
    contactButtonsSizer->Add(sendContactButton_, 0, wxRIGHT, 10);
    contactButtonsSizer->Add(cancelContactButton_, 0);

    auto* contactSizer = new wxBoxSizer(wxVERTICAL);
    auto* contactLabel = new wxStaticText(contactPanel, wxID_ANY, L"Votre message au staff");
    auto* contactHint = new wxStaticText(
        contactPanel,
        wxID_ANY,
        wxString(L"Le formulaire est préparé, mais l'envoi réseau du client wx n'est pas encore branché."));
    contactSizer->Add(contactLabel, 0, wxBOTTOM, 8);
    contactSizer->Add(contactHint, 0, wxBOTTOM, 10);
    contactSizer->Add(contactMessageCtrl_, 1, wxEXPAND | wxBOTTOM, 12);
    contactSizer->Add(contactButtonsSizer, 0, wxALIGN_LEFT);
    contactPanel->SetSizer(contactSizer);

    contentSizer->Add(itemsList_, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(shortcutsTextCtrl_, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(contactPanel, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(detailsLabel_, 0, wxEXPAND);
    contentPanel->SetSizer(contentSizer);

    auto* footerPanel = new lila::shared::accessibility::NonFocusablePanel(root, 0);
    auto* footerSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel_ = new wxStaticText(footerPanel, wxID_ANY, wxEmptyString);
    footerSizer->AddStretchSpacer();
    footerSizer->Add(statusLabel_, 0, wxALIGN_CENTER_VERTICAL);
    footerPanel->SetSizer(footerSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(contentPanel, 1, wxEXPAND | wxALL, 24);
    rootSizer->Add(footerPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 20);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*itemsList_, wxString(L"Menu d'informations"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*detailsLabel_, wxString(L"Détails"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*shortcutsTextCtrl_, wxString(L"Liste des raccourcis"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*contactMessageCtrl_, wxString(L"Message au staff"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sendContactButton_, wxString(L"Envoyer le message"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelContactButton_, wxString(L"Annuler"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel_, wxString(L"État"));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {itemsList_, shortcutsTextCtrl_, contactMessageCtrl_, sendContactButton_, cancelContactButton_});
}

void AboutFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    auto applyPanelTheme = [](wxWindow* window)
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
        applyPanelTheme(child);
    }

    itemsList_->ApplyTheme();
    shortcutsTextCtrl_->SetBackgroundColour(wxColour(14, 32, 52));
    shortcutsTextCtrl_->SetForegroundColour(Theme::TextPrimary());
    contactMessageCtrl_->SetBackgroundColour(wxColour(14, 32, 52));
    contactMessageCtrl_->SetForegroundColour(Theme::TextPrimary());
    sendContactButton_->SetBackgroundColour(Theme::AccentMuted());
    sendContactButton_->SetForegroundColour(Theme::TextPrimary());
    cancelContactButton_->SetBackgroundColour(Theme::PanelBackground());
    cancelContactButton_->SetForegroundColour(Theme::TextPrimary());
    detailsLabel_->SetForegroundColour(Theme::TextMuted());
    statusLabel_->SetForegroundColour(Theme::Accent());
}

void AboutFrame::BindEvents()
{
    itemsList_->SetSelectionChangedHandler(
        [this](std::size_t index)
        {
            if (currentPage_ != Page::Root || index > 2)
            {
                return;
            }

            (void)index;
        });
    itemsList_->SetActivatedHandler(
        [this](std::size_t index)
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
        });

    sendContactButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            UpdateStatus(wxString(L"L'envoi réseau du contact administrateur n'est pas encore disponible dans le client wx."));
        });

    cancelContactButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            HandleEscape();
        });

    Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            if (event.GetKeyCode() == WXK_ESCAPE)
            {
                HandleEscape();
                return;
            }

            event.Skip();
        });

    Bind(
        wxEVT_CLOSE_WINDOW,
        [this](wxCloseEvent& event)
        {
            event.Skip(false);
            if (onExitRequested_)
            {
                onExitRequested_();
            }
        });
}

void AboutFrame::ShowPage(Page page, bool pushCurrentToHistory, int restoreSelection)
{
    if (pushCurrentToHistory)
    {
        navigationHistory_.push_back(CaptureSnapshot());
    }

    currentPage_ = page;
    itemsList_->Hide();
    shortcutsTextCtrl_->Hide();
    contactMessageCtrl_->GetParent()->Hide();
    detailsLabel_->SetLabel(wxEmptyString);

    switch (page)
    {
    case Page::Root:
        titleLabel_->SetLabel(wxString(L"À propos"));
        BuildRootMenuItems();
        itemsList_->Show();
        if (restoreSelection != wxNOT_FOUND && restoreSelection < static_cast<int>(itemsList_->GetItemCount()))
        {
            itemsList_->SetSelectedIndex(static_cast<std::size_t>(restoreSelection));
        }
        UpdateStatus(wxString(L"Entrée : ouvrir. Échap : retour."));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel_, wxString(L"À propos"));
        break;
    case Page::Shortcuts:
        titleLabel_->SetLabel(L"Raccourcis");
        shortcutsTextCtrl_->SetValue(BuildShortcutsText());
        shortcutsTextCtrl_->Show();
        UpdateStatus(wxString(L"Échap : retour."));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel_, wxString(L"Raccourcis"));
        break;
    case Page::Info:
        titleLabel_->SetLabel(wxString(L"Informations sur l'application"));
        BuildInfoItems();
        itemsList_->Show();
        if (restoreSelection != wxNOT_FOUND && restoreSelection < static_cast<int>(itemsList_->GetItemCount()))
        {
            itemsList_->SetSelectedIndex(static_cast<std::size_t>(restoreSelection));
        }
        UpdateStatus(wxString(L"Flèches : lire. Échap : retour."));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
            *titleLabel_, wxString(L"Informations sur l'application"));
        break;
    case Page::ContactAdmin:
        titleLabel_->SetLabel(L"Contacter un administrateur");
        contactMessageCtrl_->SetValue(wxEmptyString);
        contactMessageCtrl_->GetParent()->Show();
        UpdateStatus(wxString(L"Tab : naviguer. Échap : retour."));
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
            *titleLabel_, wxString(L"Contacter un administrateur"));
        break;
    }

    Layout();
    CallAfter(
        [this]()
        {
            FocusCurrentPage();
        });
}

void AboutFrame::BuildRootMenuItems()
{
    const lila::shared::ui::controls::VerticalMenuItem rootItems[] = {
        {"shortcuts", wxString(L"Raccourcis")},
        {"info", wxString(L"Informations sur l'application")},
        {"contact", wxString(L"Contacter un administrateur")}};
    itemsList_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>(rootItems, 3));
}

void AboutFrame::BuildInfoItems()
{
    const lila::shared::ui::controls::VerticalMenuItem infoItems[] = {
        {"name", wxString::Format(L"Nom : %s", lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data()))},
        {"version", wxString::Format(L"Version actuelle : %s", lila::shared::text::FromUtf8(shared::config::AppConfig::ResolveClientVersion()))},
        {"updated", wxString::Format(L"Dernière mise à jour locale : %s", ResolveLocalUpdatedAt())},
        {"user", wxString::Format(L"Connecté en tant que : %s", lila::shared::text::FromUtf8(sessionStore_.Current().username))}};
    itemsList_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>(infoItems, 4));
    if (itemsList_->GetItemCount() > 0)
    {
        itemsList_->SetSelectedIndex(0);
    }
}

void AboutFrame::FocusCurrentPage()
{
    switch (currentPage_)
    {
    case Page::Root:
    case Page::Info:
        itemsList_->FocusSelectedItem();
        break;
    case Page::Shortcuts:
        shortcutsTextCtrl_->SetFocus();
        break;
    case Page::ContactAdmin:
        contactMessageCtrl_->SetFocus();
        break;
    }
}

void AboutFrame::HandleEscape()
{
    if (navigationHistory_.empty())
    {
        if (onCloseRequested_)
        {
            onCloseRequested_();
        }
        return;
    }

    const auto snapshot = navigationHistory_.back();
    navigationHistory_.pop_back();
    RestoreSnapshot(snapshot);
}

void AboutFrame::UpdateStatus(const wxString& message)
{
    statusLabel_->SetLabel(message);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}

wxString AboutFrame::BuildShortcutsText() const
{
    wxString text;
    text << L"Général\n";
    text << L"- Flèches : naviguer\n";
    text << L"- Entrée : valider / sélectionner\n";
    text << L"- Échap : retour / fermer\n";
    text << L"- Ctrl+U : présence (joueurs connectés)\n";
    text << L"- F3 : contacter un administrateur\n\n";
    text << L"Table (salle)\n";
    text << L"- F2 : menu de la table (actions)\n";
    text << L"- Tab : basculer Zone de jeu vers Historique\n";
    text << L"- Maj+Tab : basculer Historique vers Zone de jeu\n";
    text << L"- i : informations table\n";
    text << L"- w : lister les joueurs\n";
    text << L"- q : quitter la table\n";
    text << L"- b : ajouter un bot (hors partie)\n";
    text << L"- Maj+B : retirer un bot (hors partie)\n";
    text << L"- Ctrl+I : inviter un joueur\n";
    text << L"- Ctrl+K : exclure un joueur ou bot\n";
    text << L"- Ctrl+B : bannir un joueur\n";
    text << L"- Ctrl+P : changer le propriétaire\n";
    text << L"- Ctrl+M : mode joueur/spectateur\n";
    text << L"- Ctrl+H : visibilité de la table\n\n";
    text << L"Objets / interface (en partie, selon le jeu)\n";
    text << L"- Espace : piocher\n";
    text << L"- Retour arrière : défausser (choisir une carte)\n";
    text << L"- s : score (Panier Express)\n";
    text << L"- l : shopping list (Panier Express)\n";
    text << L"- b : annoncer panier\n";
    text << L"- i : annoncer l'inventaire\n";
    text << L"- c : annoncer main\n";
    text << L"- f : annoncer les familles complètes\n";
    text << L"- p : position plateau\n\n";
    text << L"Tchat\n";
    text << L"- Entrée : envoyer le message\n";
    text << L"- Échap : fermer le tchat\n";
    return text;
}

AboutFrame::NavigationSnapshot AboutFrame::CaptureSnapshot() const
{
    NavigationSnapshot snapshot;
    snapshot.page = currentPage_;
    snapshot.selectedIndex = itemsList_ != nullptr && itemsList_->IsShown()
                                 ? static_cast<int>(itemsList_->GetSelectedIndex())
                                 : wxNOT_FOUND;
    return snapshot;
}

void AboutFrame::RestoreSnapshot(const NavigationSnapshot& snapshot)
{
    ShowPage(snapshot.page, false, snapshot.selectedIndex);
}

wxString AboutFrame::ResolveLocalUpdatedAt() const
{
    wxFileName executablePath(wxStandardPaths::Get().GetExecutablePath());
    if (!executablePath.FileExists())
    {
        return L"Inconnue";
    }

    const wxDateTime modifiedAt = executablePath.GetModificationTime();
    if (!modifiedAt.IsValid())
    {
        return L"Inconnue";
    }

    return modifiedAt.Format(L"%d/%m/%Y %H:%M");
}
}
