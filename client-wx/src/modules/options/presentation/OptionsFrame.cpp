#include "modules/options/presentation/OptionsFrame.h"

#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/gbsizer.h>
#include <wx/event.h>
#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/simplebook.h>
#include <wx/slider.h>
#include <wx/statbox.h>
#include <wx/stattext.h>
#include <tuple>

#include "modules/session/application/SessionStore.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
#include "shared/ui/Theme.h"

namespace
{
constexpr int WindowWidth = 960;
constexpr int WindowHeight = 780;
constexpr int SectionMenuMinWidth = 220;

bool AreOptionsStatesEqual(const lila::modules::options::domain::OptionsState& left,
    const lila::modules::options::domain::OptionsState& right)
{
    return std::tie(
               left.restoreSessionOnStartup,
               left.showNavigationStatus,
               left.muteAll,
               left.confirmExit,
               left.repairBrokenAccents,
               left.enableBetaGames,
               left.soundAmbience,
               left.soundAppLaunch,
               left.soundNavigate,
               left.soundSelect,
               left.soundChatMessages,
               left.soundTableAmbience,
               left.soundAmbienceVolume,
               left.soundAmbienceSplit,
               left.soundMenuAmbienceVolume,
               left.soundTavernAmbienceVolume,
               left.soundAppLaunchVolume,
               left.soundNavigateVolume,
               left.soundSelectVolume,
               left.soundChatMessagesVolume,
               left.soundTableAmbienceVolume,
               left.chatEnabled,
               left.confirmChatExit,
               left.adminChatModerationLoadLimit,
               left.currentVersion)
        == std::tie(
            right.restoreSessionOnStartup,
            right.showNavigationStatus,
            right.muteAll,
            right.confirmExit,
            right.repairBrokenAccents,
            right.enableBetaGames,
            right.soundAmbience,
            right.soundAppLaunch,
            right.soundNavigate,
            right.soundSelect,
            right.soundChatMessages,
            right.soundTableAmbience,
            right.soundAmbienceVolume,
            right.soundAmbienceSplit,
            right.soundMenuAmbienceVolume,
            right.soundTavernAmbienceVolume,
            right.soundAppLaunchVolume,
            right.soundNavigateVolume,
            right.soundSelectVolume,
            right.soundChatMessagesVolume,
            right.soundTableAmbienceVolume,
            right.chatEnabled,
            right.confirmChatExit,
            right.adminChatModerationLoadLimit,
            right.currentVersion);
}
}

namespace lila::modules::options::presentation
{
OptionsFrame::OptionsFrame(
    application::OptionsStore& optionsStore,
    lila::modules::session::application::SessionStore& sessionStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              wxString(L"Options - %s"),
              wxString::FromUTF8(shared::config::AppConfig::AppTitle.data())),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      optionsStore_(optionsStore),
      sessionStore_(sessionStore),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    BuildLayout();
    ApplyTheme();
    BindEvents();
    LoadState();
    CentreOnScreen();
    UpdateStatus(wxString(L"Modifiez les options puis Enregistrer."));
    CallAfter(
        [this]()
        {
            if (sectionsMenu_ != nullptr)
            {
                sectionsMenu_->SetSelectedIndex(0);
                sectionsMenu_->FocusFirstItem();
            }
        });
}

void OptionsFrame::BuildLayout()
{
    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    auto* titleLabel = new wxStaticText(headerPanel, wxID_ANY, wxString(L"Options"));
    auto* subtitleLabel = new wxStaticText(
        headerPanel,
        wxID_ANY,
        wxString(L"Préférences du client"));
    headerSizer->Add(titleLabel, 0, wxALIGN_CENTER_HORIZONTAL);
    headerSizer->Add(subtitleLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    headerPanel->SetSizer(headerSizer);

    auto* optionsLayout = new wxBoxSizer(wxHORIZONTAL);
    sectionsPanel_ = new lila::shared::accessibility::NonFocusablePanel(root);
    sectionsPanel_->SetMinSize(wxSize(SectionMenuMinWidth, -1));
    BuildSectionMenu(sectionsPanel_);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* contentSizer = new wxBoxSizer(wxVERTICAL);
    BuildSectionPages(contentPanel);
    contentSizer->Add(sectionBook_, 1, wxEXPAND);

    auto* actionFooterPanel = new lila::shared::accessibility::NonFocusablePanel(contentPanel);
    auto* actionFooterSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel_ = new wxStaticText(actionFooterPanel, wxID_ANY, wxEmptyString);
    cancelButton_ = new wxButton(actionFooterPanel, wxID_ANY, wxString(L"Annuler"));
    actionFooterSizer->Add(statusLabel_, 1, wxALIGN_CENTER_VERTICAL);
    actionFooterSizer->Add(cancelButton_, 0);
    actionFooterPanel->SetSizer(actionFooterSizer);

    contentSizer->Add(actionFooterPanel, 0, wxEXPAND | wxTOP, 8);
    contentPanel->SetSizer(contentSizer);

    optionsLayout->Add(sectionsPanel_, 0, wxEXPAND | wxRIGHT, 16);
    optionsLayout->Add(contentPanel, 1, wxEXPAND);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 20);
    rootSizer->Add(optionsLayout, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 16);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel, wxString(L"Options"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *subtitleLabel, wxString(L"Préférences du client"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel_, wxString(L"État"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelButton_, wxString(L"Annuler"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionBook_, wxString(L"Contenu des options"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionsPanel_, wxString(L"Navigation des options"));
}

void OptionsFrame::BuildSectionMenu(wxWindow* parent)
{
    static const lila::shared::ui::navigation::MenuBlueprintItem menuItems[] = {
        {"general", wxString(L"Général"), wxString(L"Section Général")},
        {"sounds", wxString(L"Sons"), wxString(L"Section Sons")},
        {"chat", wxString(L"Tchat"), wxString(L"Section Tchat")},
    };

    if (parent == nullptr)
    {
        return;
    }

    auto* sectionSizer = new wxBoxSizer(wxVERTICAL);
    sectionsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        parent, lila::shared::ui::navigation::BuildMenuItems(std::span(menuItems)));
    sectionsMenu_->SetTabNavigationEnabled(false);
    sectionSizer->Add(sectionsMenu_, 1, wxEXPAND);
    parent->SetSizer(sectionSizer);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionsMenu_, wxString(L"Sections des options"));
}

void OptionsFrame::BuildSectionPages(wxWindow* parent)
{
    if (parent == nullptr || sectionBook_ != nullptr)
    {
        return;
    }

    sectionBook_ = new wxSimplebook(parent, wxID_ANY);
    generalPage_ = new lila::shared::accessibility::NonFocusablePanel(sectionBook_);
    soundsPage_ = new lila::shared::accessibility::NonFocusablePanel(sectionBook_);
    chatPage_ = new lila::shared::accessibility::NonFocusablePanel(sectionBook_);

    BuildGeneralPage(generalPage_);
    BuildSoundsPage(soundsPage_);
    BuildChatPage(chatPage_);

    sectionBook_->AddPage(generalPage_, wxString(L"Général"));
    sectionBook_->AddPage(soundsPage_, wxString(L"Sons"));
    sectionBook_->AddPage(chatPage_, wxString(L"Tchat"));

    sectionBook_->SetSelection(0);
}

void OptionsFrame::ActivateSection(std::size_t index)
{
    if (sectionBook_ == nullptr)
    {
        return;
    }

    const int pageCount = sectionBook_->GetPageCount();
    if (pageCount <= 0 || index >= static_cast<std::size_t>(pageCount))
    {
        return;
    }

    sectionBook_->SetSelection(static_cast<int>(index));
    isInsideSection_ = true;
    if (sectionsMenu_ != nullptr)
    {
        if (sectionsMenu_->GetSelectedIndex() != index)
        {
            sectionsMenu_->SetSelectedIndex(index);
        }
    }
    if (wxWindow* firstControl = GetFirstSectionControl(index); firstControl != nullptr)
    {
        firstControl->SetFocus();
    }
}

wxWindow* OptionsFrame::GetFirstSectionControl(std::size_t sectionIndex) const
{
    if (sectionIndex == 0)
    {
        return confirmExitCheckbox_;
    }

    if (sectionIndex == 1)
    {
        return muteAllCheckbox_ != nullptr ? static_cast<wxWindow*>(muteAllCheckbox_) : soundAmbienceCheckbox_;
    }

    return chatEnabledCheckbox_;
}

void OptionsFrame::BuildGeneralPage(wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);

    confirmExitCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Demander confirmation à la déconnexion"));
    repairBrokenAccentsCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Réparer les caractères accentués dégradés"));
    restoreSessionCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Restaurer la session au démarrage"));
    showNavigationStatusCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Annoncer l'état de navigation"));
    enableBetaGamesCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer les fonctionnalités bêta"));

    sizer->Add(confirmExitCheckbox_, 0, wxBOTTOM, 10);
    sizer->Add(repairBrokenAccentsCheckbox_, 0, wxBOTTOM, 10);
    sizer->Add(restoreSessionCheckbox_, 0, wxBOTTOM, 10);
    sizer->Add(showNavigationStatusCheckbox_, 0, wxBOTTOM, 16);
    sizer->Add(enableBetaGamesCheckbox_, 0);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *restoreSessionCheckbox_, wxString(L"Restaurer la session au démarrage"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *showNavigationStatusCheckbox_, wxString(L"Annoncer l'état de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *confirmExitCheckbox_, wxString(L"Demander confirmation à la déconnexion"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *repairBrokenAccentsCheckbox_, wxString(L"Réparer les caractères accentués dégradés"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *enableBetaGamesCheckbox_, wxString(L"Activer les fonctionnalités bêta"));
    AddSectionSaveButton(parent, sizer);
    parent->SetSizer(sizer);
}

void OptionsFrame::BuildSoundsPage(wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* soundBox = new wxStaticBoxSizer(new wxStaticBox(parent, wxID_ANY, wxString(L"Sons")), wxVERTICAL);

    muteAllCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Couper tous les sons"));
    soundAmbienceCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons d'ambiance"));
    soundAppLaunchCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons au lancement"));
    soundNavigateCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de navigation"));
    soundSelectCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de sélection"));
    soundChatMessagesCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons des messages de tchat"));

    soundMenuAmbienceSlider_ = new wxSlider(parent, wxID_ANY, 25, 0, 100);
    soundTavernAmbienceSlider_ = new wxSlider(parent, wxID_ANY, 25, 0, 100);
    soundAppLaunchSlider_ = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    soundNavigateSlider_ = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    soundSelectSlider_ = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    soundChatMessagesSlider_ = new wxSlider(parent, wxID_ANY, 50, 0, 100);

    soundMenuAmbienceValueLabel_ = new wxStaticText(parent, wxID_ANY, wxString(L"Ambiance (menu) : 25 %"));
    soundTavernAmbienceValueLabel_ = new wxStaticText(parent, wxID_ANY, wxString(L"Ambiance (table) : 25 %"));
    soundAppLaunchValueLabel_ = new wxStaticText(parent, wxID_ANY, wxString(L"Lancement : 50 %"));
    soundNavigateValueLabel_ = new wxStaticText(parent, wxID_ANY, wxString(L"Navigation : 50 %"));
    soundSelectValueLabel_ = new wxStaticText(parent, wxID_ANY, wxString(L"Sélection : 50 %"));
    soundChatMessagesValueLabel_ = new wxStaticText(parent, wxID_ANY, wxString(L"Messages : 50 %"));

    soundBox->Add(muteAllCheckbox_, 0, wxBOTTOM, 12);
    soundBox->Add(soundAmbienceCheckbox_, 0, wxBOTTOM, 10);
    soundBox->Add(soundAppLaunchCheckbox_, 0, wxBOTTOM, 10);
    soundBox->Add(soundNavigateCheckbox_, 0, wxBOTTOM, 10);
    soundBox->Add(soundSelectCheckbox_, 0, wxBOTTOM, 10);
    soundBox->Add(soundChatMessagesCheckbox_, 0, wxBOTTOM, 12);

    auto addSliderRow =
        [this, parent](wxGridBagSizer* grid, wxSlider* slider, wxStaticText* label, const wxString& prefix, int row)
    {
        auto* checkRow = new wxStaticText(parent, wxID_ANY, prefix);
        grid->Add(checkRow, wxGBPosition(row, 0), wxGBSpan(1, 1), wxALIGN_CENTER_VERTICAL | wxRIGHT, 10);
        grid->Add(slider, wxGBPosition(row, 1), wxGBSpan(1, 1), wxEXPAND);
        grid->Add(label, wxGBPosition(row, 2), wxGBSpan(1, 1), wxALIGN_CENTER_VERTICAL | wxLEFT, 10);
        BindSliderStatus(*slider, *label, prefix);
    };

    auto* soundGrid = new wxGridBagSizer(10, 10);
    addSliderRow(soundGrid, soundMenuAmbienceSlider_, soundMenuAmbienceValueLabel_, wxString(L"Ambiance (menu)"), 0);
    addSliderRow(soundGrid, soundTavernAmbienceSlider_, soundTavernAmbienceValueLabel_, wxString(L"Ambiance (table)"), 1);
    addSliderRow(soundGrid, soundAppLaunchSlider_, soundAppLaunchValueLabel_, wxString(L"Lancement"), 2);
    addSliderRow(soundGrid, soundNavigateSlider_, soundNavigateValueLabel_, wxString(L"Navigation"), 3);
    addSliderRow(soundGrid, soundSelectSlider_, soundSelectValueLabel_, wxString(L"Sélection"), 4);
    addSliderRow(soundGrid, soundChatMessagesSlider_, soundChatMessagesValueLabel_, wxString(L"Sons de tchat"), 5);
    soundGrid->AddGrowableCol(1, 1);

    soundBox->Add(soundGrid, 1, wxEXPAND);
    sizer->Add(soundBox, 1, wxEXPAND);
    parent->SetSizer(sizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *muteAllCheckbox_, wxString(L"Couper tous les sons"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAmbienceCheckbox_, wxString(L"Sons d'ambiance"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAppLaunchCheckbox_, wxString(L"Sons au lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundNavigateCheckbox_, wxString(L"Sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundSelectCheckbox_, wxString(L"Sons de sélection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundChatMessagesCheckbox_, wxString(L"Sons des messages de tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundMenuAmbienceSlider_, wxString(L"Volume ambiance menu"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundTavernAmbienceSlider_, wxString(L"Volume ambiance table"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAppLaunchSlider_, wxString(L"Volume sons de lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundNavigateSlider_, wxString(L"Volume sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundSelectSlider_, wxString(L"Volume sons de sélection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundChatMessagesSlider_, wxString(L"Volume sons de tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundMenuAmbienceValueLabel_, wxString(L"Valeur actuelle ambiance menu"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundTavernAmbienceValueLabel_, wxString(L"Valeur actuelle ambiance table"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAppLaunchValueLabel_, wxString(L"Valeur actuelle sons de lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundNavigateValueLabel_, wxString(L"Valeur actuelle sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundSelectValueLabel_, wxString(L"Valeur actuelle sons de sélection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundChatMessagesValueLabel_, wxString(L"Valeur actuelle sons de tchat"));
    AddSectionSaveButton(parent, sizer);
}

void OptionsFrame::BuildChatPage(wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    chatEnabledCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer le tchat"));
    confirmChatExitCheckbox_ = new wxCheckBox(parent, wxID_ANY, wxString(L"Confirmer la sortie du tchat"));
    sizer->Add(chatEnabledCheckbox_, 0, wxBOTTOM, 12);
    sizer->Add(confirmChatExitCheckbox_, 0);
    parent->SetSizer(sizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*chatEnabledCheckbox_, wxString(L"Activer le tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *confirmChatExitCheckbox_, wxString(L"Confirmer la sortie du tchat"));
    AddSectionSaveButton(parent, sizer);
}

void OptionsFrame::AddSectionSaveButton(wxWindow* parent, wxBoxSizer* sectionSizer)
{
    if (parent == nullptr || sectionSizer == nullptr)
    {
        return;
    }

    auto* sectionSaveButton = new wxButton(parent, wxID_ANY, wxString(L"Enregistrer"));
    sectionSizer->AddStretchSpacer();
    sectionSizer->Add(sectionSaveButton, 0, wxALIGN_RIGHT | wxTOP, 8);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionSaveButton, wxString(L"Enregistrer"));
    sectionSaveButtons_.push_back(sectionSaveButton);

    sectionSaveButton->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            SaveState();
        });
}

void OptionsFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    auto applyWindowTheme = [](wxWindow* window)
    {
        if (window == nullptr)
        {
            return;
        }

        window->SetBackgroundColour(Theme::PanelBackground());
        window->SetForegroundColour(Theme::TextPrimary());
    };

    for (wxWindow* child : GetChildren())
    {
        applyWindowTheme(child);
    }

    if (sectionBook_ != nullptr)
    {
        sectionBook_->SetBackgroundColour(Theme::PanelBackground());
        sectionBook_->SetForegroundColour(Theme::TextPrimary());
    }

    if (statusLabel_ != nullptr)
    {
        statusLabel_->SetForegroundColour(Theme::Accent());
    }
}

void OptionsFrame::BindEvents()
{
    if (sectionsMenu_ != nullptr)
    {
        sectionsMenu_->SetSelectionChangedHandler(
            [this](std::size_t)
            {
                (void)this;
            });
        sectionsMenu_->SetActivatedHandler(
            [this](std::size_t index)
            {
                ActivateSection(index);
            });
    }

    if (cancelButton_ != nullptr)
    {
        cancelButton_->Bind(
            wxEVT_BUTTON,
            [this](wxCommandEvent&)
            {
                CancelChanges();
            });
    }

    const auto bindUnsavedFlag = [this](wxCheckBox& checkbox, bool updateSoundInteractivity)
    {
        checkbox.Bind(
            wxEVT_CHECKBOX,
            [this, updateSoundInteractivity](wxCommandEvent&)
            {
                if (updateSoundInteractivity)
                {
                    UpdateSoundControlInteractivity();
                    wxWindow* focused = wxWindow::FindFocus();
                    if (focused != nullptr && !focused->IsEnabled())
                    {
                        (void)TryNavigateSectionControls(WXK_TAB, false);
                    }
                }
                RefreshUnsavedState();
            });
    };

    if (restoreSessionCheckbox_ != nullptr) bindUnsavedFlag(*restoreSessionCheckbox_, false);
    if (showNavigationStatusCheckbox_ != nullptr) bindUnsavedFlag(*showNavigationStatusCheckbox_, false);
    if (confirmExitCheckbox_ != nullptr) bindUnsavedFlag(*confirmExitCheckbox_, false);
    if (repairBrokenAccentsCheckbox_ != nullptr) bindUnsavedFlag(*repairBrokenAccentsCheckbox_, false);
    if (enableBetaGamesCheckbox_ != nullptr) bindUnsavedFlag(*enableBetaGamesCheckbox_, false);
    if (muteAllCheckbox_ != nullptr) bindUnsavedFlag(*muteAllCheckbox_, true);
    if (soundAmbienceCheckbox_ != nullptr) bindUnsavedFlag(*soundAmbienceCheckbox_, true);
    if (soundAppLaunchCheckbox_ != nullptr) bindUnsavedFlag(*soundAppLaunchCheckbox_, true);
    if (soundNavigateCheckbox_ != nullptr) bindUnsavedFlag(*soundNavigateCheckbox_, true);
    if (soundSelectCheckbox_ != nullptr) bindUnsavedFlag(*soundSelectCheckbox_, true);
    if (soundChatMessagesCheckbox_ != nullptr) bindUnsavedFlag(*soundChatMessagesCheckbox_, true);
    if (chatEnabledCheckbox_ != nullptr) bindUnsavedFlag(*chatEnabledCheckbox_, false);
    if (confirmChatExitCheckbox_ != nullptr) bindUnsavedFlag(*confirmChatExitCheckbox_, false);

    BindSliderStatusEvents();

    Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            const int keyCode = event.GetKeyCode();
            if ((keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB))
            {
                if (isInsideSection_ && TryNavigateSectionControls(keyCode, event.ShiftDown()))
                {
                    event.Skip(false);
                    return;
                }

                event.Skip(false);
                return;
            }

            if ((keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP || keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN))
            {
                if (isInsideSection_)
                {
                    wxWindow* focused = wxWindow::FindFocus();
                    const bool focusOnSlider =
                        focused != nullptr && dynamic_cast<wxSlider*>(focused) != nullptr;
                    if (!focusOnSlider && TryNavigateSectionControls(keyCode, false))
                    {
                        event.Skip(false);
                        return;
                    }
                }
            }

            if (keyCode == WXK_ESCAPE)
            {
                HandleEscape();
                event.Skip(false);
                return;
            }

            event.Skip();
        });

    Bind(
        wxEVT_CLOSE_WINDOW,
        [this](wxCloseEvent& event)
        {
            if (event.CanVeto())
            {
                event.Veto();
            }

            event.Skip(false);
            if (onExitRequested_ != nullptr && event.CanVeto())
            {
                onExitRequested_();
            }
    });
    RefreshUnsavedState();
}

void OptionsFrame::UpdateSoundControlInteractivity()
{
    const bool soundsEnabled = soundAmbienceCheckbox_ != nullptr && soundAmbienceCheckbox_->GetValue();
    const bool isMuted = muteAllCheckbox_ != nullptr && muteAllCheckbox_->GetValue();
    const bool canInteract = !isMuted;

    if (soundMenuAmbienceSlider_ != nullptr)
    {
        soundMenuAmbienceSlider_->Enable(canInteract && soundsEnabled);
    }
    if (soundTavernAmbienceSlider_ != nullptr)
    {
        soundTavernAmbienceSlider_->Enable(canInteract && soundsEnabled);
    }
    if (soundAppLaunchSlider_ != nullptr)
    {
        soundAppLaunchSlider_->Enable(
            canInteract
            && soundAppLaunchCheckbox_ != nullptr
            && soundAppLaunchCheckbox_->GetValue());
    }
    if (soundNavigateSlider_ != nullptr)
    {
        soundNavigateSlider_->Enable(
            canInteract
            && soundNavigateCheckbox_ != nullptr
            && soundNavigateCheckbox_->GetValue());
    }
    if (soundSelectSlider_ != nullptr)
    {
        soundSelectSlider_->Enable(
            canInteract
            && soundSelectCheckbox_ != nullptr
            && soundSelectCheckbox_->GetValue());
    }
    if (soundChatMessagesSlider_ != nullptr)
    {
        soundChatMessagesSlider_->Enable(
            canInteract
            && soundChatMessagesCheckbox_ != nullptr
            && soundChatMessagesCheckbox_->GetValue());
    }
}

bool OptionsFrame::TryNavigateSectionControls(int keyCode, bool reverseTabNavigation)
{
    if (sectionBook_ == nullptr)
    {
        return false;
    }

    const int sectionIndex = sectionBook_->GetSelection();
    if (sectionIndex < 0)
    {
        return false;
    }

    if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB)
    {
        wxWindow* focusedWindow = wxWindow::FindFocus();
        wxWindow* tabFocusables[3]{};
        std::size_t tabFocusableCount = 0;

        const auto appendTabIfFocusable = [&tabFocusables, &tabFocusableCount](wxWindow* control)
        {
            if (control != nullptr && control->IsShown() && control->IsEnabled())
            {
                tabFocusables[tabFocusableCount++] = control;
            }
        };

        if (sectionIndex == 1)
        {
            if (
                focusedWindow == soundAmbienceCheckbox_ || focusedWindow == soundMenuAmbienceSlider_
                || focusedWindow == soundTavernAmbienceSlider_)
            {
                appendTabIfFocusable(soundAmbienceCheckbox_);
                appendTabIfFocusable(soundMenuAmbienceSlider_);
                appendTabIfFocusable(soundTavernAmbienceSlider_);
            }
            else if (focusedWindow == soundAppLaunchCheckbox_ || focusedWindow == soundAppLaunchSlider_)
            {
                appendTabIfFocusable(soundAppLaunchCheckbox_);
                appendTabIfFocusable(soundAppLaunchSlider_);
            }
            else if (focusedWindow == soundNavigateCheckbox_ || focusedWindow == soundNavigateSlider_)
            {
                appendTabIfFocusable(soundNavigateCheckbox_);
                appendTabIfFocusable(soundNavigateSlider_);
            }
            else if (focusedWindow == soundSelectCheckbox_ || focusedWindow == soundSelectSlider_)
            {
                appendTabIfFocusable(soundSelectCheckbox_);
                appendTabIfFocusable(soundSelectSlider_);
            }
            else if (
                focusedWindow == soundChatMessagesCheckbox_ || focusedWindow == soundChatMessagesSlider_)
            {
                appendTabIfFocusable(soundChatMessagesCheckbox_);
                appendTabIfFocusable(soundChatMessagesSlider_);
            }
        }

        if (tabFocusableCount < 2)
        {
            return false;
        }

        std::size_t focusedIndex = tabFocusableCount;
        for (std::size_t index = 0; index < tabFocusableCount; ++index)
        {
            if (tabFocusables[index] == focusedWindow)
            {
                focusedIndex = index;
                break;
            }
        }

        if (focusedIndex == tabFocusableCount)
        {
            focusedIndex = reverseTabNavigation ? tabFocusableCount - 1 : 0;
        }

        std::size_t targetIndex =
            reverseTabNavigation ? (focusedIndex == 0 ? tabFocusableCount - 1 : focusedIndex - 1)
                                : (focusedIndex + 1) % tabFocusableCount;
        if (tabFocusables[targetIndex] != nullptr)
        {
            tabFocusables[targetIndex]->SetFocus();
            return true;
        }
        return false;
    }

    wxWindow* focusables[12]{};
    std::size_t focusableCount = 0;
    const auto appendIfFocusable = [&focusables, &focusableCount](wxWindow* control)
    {
        if (control != nullptr && control->IsShown() && control->IsEnabled())
        {
            focusables[focusableCount++] = control;
        }
    };

    switch (sectionIndex)
    {
    case 0:
        appendIfFocusable(confirmExitCheckbox_);
        appendIfFocusable(repairBrokenAccentsCheckbox_);
        appendIfFocusable(restoreSessionCheckbox_);
        appendIfFocusable(showNavigationStatusCheckbox_);
        appendIfFocusable(enableBetaGamesCheckbox_);
        break;
    case 1:
        appendIfFocusable(muteAllCheckbox_);
        appendIfFocusable(soundAmbienceCheckbox_);
        appendIfFocusable(soundMenuAmbienceSlider_);
        appendIfFocusable(soundTavernAmbienceSlider_);
        appendIfFocusable(soundAppLaunchCheckbox_);
        appendIfFocusable(soundAppLaunchSlider_);
        appendIfFocusable(soundNavigateCheckbox_);
        appendIfFocusable(soundNavigateSlider_);
        appendIfFocusable(soundSelectCheckbox_);
        appendIfFocusable(soundSelectSlider_);
        appendIfFocusable(soundChatMessagesCheckbox_);
        appendIfFocusable(soundChatMessagesSlider_);
        break;
    case 2:
        appendIfFocusable(chatEnabledCheckbox_);
        appendIfFocusable(confirmChatExitCheckbox_);
        break;
    default:
        return false;
    }

    if (focusableCount == 0)
    {
        return false;
    }

    wxWindow* focusedWindow = wxWindow::FindFocus();
    std::size_t focusedIndex = focusableCount;
    for (std::size_t index = 0; index < focusableCount; ++index)
    {
        if (focusables[index] == focusedWindow)
        {
            focusedIndex = index;
            break;
        }
    }

    if (focusedIndex == focusableCount)
    {
        focusedIndex = reverseTabNavigation ? focusableCount - 1 : 0;
    }

    std::size_t targetIndex = focusedIndex;
    if (keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP)
    {
        if (focusedIndex > 0)
        {
            targetIndex = focusedIndex - 1;
        }
    }
    else if (keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN)
    {
        if (focusedIndex + 1 < focusableCount)
        {
            targetIndex = focusedIndex + 1;
        }
    }
    else
    {
        return false;
    }

    if (focusables[targetIndex] != nullptr)
    {
        focusables[targetIndex]->SetFocus();
        return true;
    }

    return false;
}

void OptionsFrame::BindSliderStatus(wxSlider& slider, wxStaticText& label, const wxString& prefix)
{
    const auto updateLabel = [&slider, &label, prefix]()
    {
        label.SetLabel(wxString::Format(wxString(L"%s : %d %%"), prefix, slider.GetValue()));
    };

    updateLabel();
    slider.Bind(
        wxEVT_SLIDER,
        [this, updateLabel](wxCommandEvent&)
        {
            updateLabel();
            RefreshUnsavedState();
        });
}

void OptionsFrame::BindImmediateApply(wxCheckBox& checkbox)
{
    checkbox.Bind(
        wxEVT_CHECKBOX,
        [this](wxCommandEvent&)
        {
            UpdateStatus(wxString(L"Options non enregistrées. Enregistrez pour appliquer définitivement."), false);
        });
}

void OptionsFrame::BindSliderStatusEvents()
{
    if (soundMenuAmbienceSlider_ != nullptr)
    {
        BindSliderStatus(*soundMenuAmbienceSlider_, *soundMenuAmbienceValueLabel_, wxString(L"Ambiance (menu)"));
    }
    if (soundTavernAmbienceSlider_ != nullptr)
    {
        BindSliderStatus(*soundTavernAmbienceSlider_, *soundTavernAmbienceValueLabel_, wxString(L"Ambiance (table)"));
    }
    if (soundAppLaunchSlider_ != nullptr)
    {
        BindSliderStatus(*soundAppLaunchSlider_, *soundAppLaunchValueLabel_, wxString(L"Lancement"));
    }
    if (soundNavigateSlider_ != nullptr)
    {
        BindSliderStatus(*soundNavigateSlider_, *soundNavigateValueLabel_, wxString(L"Navigation"));
    }
    if (soundSelectSlider_ != nullptr)
    {
        BindSliderStatus(*soundSelectSlider_, *soundSelectValueLabel_, wxString(L"Sélection"));
    }
    if (soundChatMessagesSlider_ != nullptr)
    {
        BindSliderStatus(*soundChatMessagesSlider_, *soundChatMessagesValueLabel_, wxString(L"Sons de tchat"));
    }
}

void OptionsFrame::LoadState()
{
    initialState_ = optionsStore_.Current();
    ApplyState(initialState_, false);
    RefreshUnsavedState();
}

domain::OptionsState OptionsFrame::BuildStateFromControls() const
{
    domain::OptionsState state = optionsStore_.Current();

    if (restoreSessionCheckbox_ != nullptr)
    {
        state.restoreSessionOnStartup = restoreSessionCheckbox_->GetValue();
    }

    if (showNavigationStatusCheckbox_ != nullptr)
    {
        state.showNavigationStatus = showNavigationStatusCheckbox_->GetValue();
    }

    if (confirmExitCheckbox_ != nullptr)
    {
        state.confirmExit = confirmExitCheckbox_->GetValue();
    }
    if (repairBrokenAccentsCheckbox_ != nullptr)
    {
        state.repairBrokenAccents = repairBrokenAccentsCheckbox_->GetValue();
    }
    if (enableBetaGamesCheckbox_ != nullptr)
    {
        state.enableBetaGames = enableBetaGamesCheckbox_->GetValue();
    }
    if (muteAllCheckbox_ != nullptr)
    {
        state.muteAll = muteAllCheckbox_->GetValue();
    }
    if (soundAmbienceCheckbox_ != nullptr)
    {
        state.soundAmbience = soundAmbienceCheckbox_->GetValue();
    }
    if (soundAppLaunchCheckbox_ != nullptr)
    {
        state.soundAppLaunch = soundAppLaunchCheckbox_->GetValue();
    }
    if (soundNavigateCheckbox_ != nullptr)
    {
        state.soundNavigate = soundNavigateCheckbox_->GetValue();
    }
    if (soundSelectCheckbox_ != nullptr)
    {
        state.soundSelect = soundSelectCheckbox_->GetValue();
    }
    if (soundChatMessagesCheckbox_ != nullptr)
    {
        state.soundChatMessages = soundChatMessagesCheckbox_->GetValue();
    }
    if (soundMenuAmbienceSlider_ != nullptr)
    {
        state.soundMenuAmbienceVolume = soundMenuAmbienceSlider_->GetValue();
    }
    if (soundTavernAmbienceSlider_ != nullptr)
    {
        state.soundTavernAmbienceVolume = soundTavernAmbienceSlider_->GetValue();
    }
    if (soundAppLaunchSlider_ != nullptr)
    {
        state.soundAppLaunchVolume = soundAppLaunchSlider_->GetValue();
    }
    if (soundNavigateSlider_ != nullptr)
    {
        state.soundNavigateVolume = soundNavigateSlider_->GetValue();
    }
    if (soundSelectSlider_ != nullptr)
    {
        state.soundSelectVolume = soundSelectSlider_->GetValue();
    }
    if (soundChatMessagesSlider_ != nullptr)
    {
        state.soundChatMessagesVolume = soundChatMessagesSlider_->GetValue();
    }
    if (chatEnabledCheckbox_ != nullptr)
    {
        state.chatEnabled = chatEnabledCheckbox_->GetValue();
    }
    if (confirmChatExitCheckbox_ != nullptr)
    {
        state.confirmChatExit = confirmChatExitCheckbox_->GetValue();
    }

    return state;
}

void OptionsFrame::ApplyState(const domain::OptionsState& state, bool persist, const wxString& successMessage)
{
    if (restoreSessionCheckbox_ != nullptr)
    {
        restoreSessionCheckbox_->SetValue(state.restoreSessionOnStartup);
    }
    if (showNavigationStatusCheckbox_ != nullptr)
    {
        showNavigationStatusCheckbox_->SetValue(state.showNavigationStatus);
    }
    if (confirmExitCheckbox_ != nullptr)
    {
        confirmExitCheckbox_->SetValue(state.confirmExit);
    }
    if (repairBrokenAccentsCheckbox_ != nullptr)
    {
        repairBrokenAccentsCheckbox_->SetValue(state.repairBrokenAccents);
    }
    if (enableBetaGamesCheckbox_ != nullptr)
    {
        enableBetaGamesCheckbox_->SetValue(state.enableBetaGames);
    }
    if (muteAllCheckbox_ != nullptr)
    {
        muteAllCheckbox_->SetValue(state.muteAll);
    }
    if (soundAmbienceCheckbox_ != nullptr)
    {
        soundAmbienceCheckbox_->SetValue(state.soundAmbience);
    }
    if (soundAppLaunchCheckbox_ != nullptr)
    {
        soundAppLaunchCheckbox_->SetValue(state.soundAppLaunch);
    }
    if (soundNavigateCheckbox_ != nullptr)
    {
        soundNavigateCheckbox_->SetValue(state.soundNavigate);
    }
    if (soundSelectCheckbox_ != nullptr)
    {
        soundSelectCheckbox_->SetValue(state.soundSelect);
    }
    if (soundChatMessagesCheckbox_ != nullptr)
    {
        soundChatMessagesCheckbox_->SetValue(state.soundChatMessages);
    }
    if (soundMenuAmbienceSlider_ != nullptr)
    {
        soundMenuAmbienceSlider_->SetValue(state.soundMenuAmbienceVolume);
        if (soundMenuAmbienceValueLabel_ != nullptr)
        {
            soundMenuAmbienceValueLabel_->SetLabel(wxString::Format(wxString(L"Ambiance (menu) : %d %%"), state.soundMenuAmbienceVolume));
        }
    }
    if (soundTavernAmbienceSlider_ != nullptr)
    {
        soundTavernAmbienceSlider_->SetValue(state.soundTavernAmbienceVolume);
        if (soundTavernAmbienceValueLabel_ != nullptr)
        {
            soundTavernAmbienceValueLabel_->SetLabel(
                wxString::Format(wxString(L"Ambiance (table) : %d %%"), state.soundTavernAmbienceVolume));
        }
    }
    if (soundAppLaunchSlider_ != nullptr)
    {
        soundAppLaunchSlider_->SetValue(state.soundAppLaunchVolume);
        if (soundAppLaunchValueLabel_ != nullptr)
        {
            soundAppLaunchValueLabel_->SetLabel(wxString::Format(wxString(L"Lancement : %d %%"), state.soundAppLaunchVolume));
        }
    }
    if (soundNavigateSlider_ != nullptr)
    {
        soundNavigateSlider_->SetValue(state.soundNavigateVolume);
        if (soundNavigateValueLabel_ != nullptr)
        {
            soundNavigateValueLabel_->SetLabel(wxString::Format(wxString(L"Navigation : %d %%"), state.soundNavigateVolume));
        }
    }
    if (soundSelectSlider_ != nullptr)
    {
        soundSelectSlider_->SetValue(state.soundSelectVolume);
        if (soundSelectValueLabel_ != nullptr)
        {
            soundSelectValueLabel_->SetLabel(wxString::Format(wxString(L"Sélection : %d %%"), state.soundSelectVolume));
        }
    }
    if (soundChatMessagesSlider_ != nullptr)
    {
        soundChatMessagesSlider_->SetValue(state.soundChatMessagesVolume);
        if (soundChatMessagesValueLabel_ != nullptr)
        {
            soundChatMessagesValueLabel_->SetLabel(wxString::Format(wxString(L"Sons de tchat : %d %%"), state.soundChatMessagesVolume));
        }
    }
    if (chatEnabledCheckbox_ != nullptr)
    {
        chatEnabledCheckbox_->SetValue(state.chatEnabled);
    }
    if (confirmChatExitCheckbox_ != nullptr)
    {
        confirmChatExitCheckbox_->SetValue(state.confirmChatExit);
    }

    UpdateSoundControlInteractivity();

    if (persist)
    {
        try
        {
            optionsStore_.Update(state);
            initialState_ = state;
            UpdateStatus(successMessage.empty() ? wxString(L"Options enregistrées.") : successMessage, false);
        }
        catch (const std::exception& error)
        {
            UpdateStatus(wxString::FromUTF8(error.what()), true);
        }

        return;
    }

    if (!successMessage.empty())
    {
        UpdateStatus(successMessage, false);
    }
}

void OptionsFrame::SaveState()
{
    ApplyState(BuildStateFromControls(), true, wxString(L"Options enregistrées."));
    RefreshUnsavedState();
}

void OptionsFrame::CancelChanges()
{
    ApplyState(initialState_, false, wxString(L"Modifications annulées."));
    RefreshUnsavedState();
}

void OptionsFrame::RefreshUnsavedState()
{
    const auto stateFromControls = BuildStateFromControls();
    const bool hasUnsavedChanges = !AreOptionsStatesEqual(stateFromControls, initialState_);

    for (wxButton* sectionSaveButton : sectionSaveButtons_)
    {
        if (sectionSaveButton != nullptr)
        {
            sectionSaveButton->Enable(hasUnsavedChanges);
        }
    }

    if (cancelButton_ != nullptr)
    {
        cancelButton_->Enable(hasUnsavedChanges);
    }

    if (hasUnsavedChanges)
    {
        UpdateStatus(wxString(L"Modifications en attente d'enregistrement."), false);
        return;
    }

    UpdateStatus(wxString(L"Aucune modification en attente."), false);
}

bool OptionsFrame::HasUnsavedChanges() const
{
    const auto stateFromControls = BuildStateFromControls();
    return !AreOptionsStatesEqual(stateFromControls, initialState_);
}

void OptionsFrame::HandleEscape()
{
    if (isInsideSection_)
    {
        isInsideSection_ = false;
        if (sectionsMenu_ != nullptr)
        {
            if (sectionBook_ != nullptr)
            {
                const int currentSection = sectionBook_->GetSelection();
                if (currentSection >= 0)
                {
                    sectionsMenu_->SetSelectedIndex(static_cast<std::size_t>(currentSection));
                }
            }
            sectionsMenu_->FocusSelectedItem();
        }
        return;
    }

    if (onCloseRequested_ != nullptr)
    {
        onCloseRequested_();
    }
}

void OptionsFrame::UpdateStatus(const wxString& message, bool isError)
{
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(isError ? wxColour(240, 130, 130) : lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}

}

