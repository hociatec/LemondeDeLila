void OptionsView::BuildGeneralPage(wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);

    confirmExitCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Demander confirmation à la déconnexion"));
    restoreSessionCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Restaurer la session au démarrage"));
    showNavigationStatusCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Annoncer l'état de navigation"));
    enableBetaGamesCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer les fonctionnalités bêta"));

    sizer->Add(confirmExitCheckbox, 0, wxBOTTOM, 10);
    sizer->Add(restoreSessionCheckbox, 0, wxBOTTOM, 10);
    sizer->Add(showNavigationStatusCheckbox, 0, wxBOTTOM, 16);
    sizer->Add(enableBetaGamesCheckbox, 0);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *restoreSessionCheckbox, wxString(L"Restaurer la session au démarrage"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *showNavigationStatusCheckbox, wxString(L"Annoncer l'état de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *confirmExitCheckbox, wxString(L"Demander confirmation à la déconnexion"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *enableBetaGamesCheckbox, wxString(L"Activer les fonctionnalités bêta"));
    AddSectionSaveButton(parent, sizer);
    parent->SetSizer(sizer);
}

void OptionsView::BuildSoundsPage(wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* soundBox = new wxStaticBoxSizer(new wxStaticBox(parent, wxID_ANY, wxString(L"Sons")), wxVERTICAL);

    muteAllCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Couper tous les sons"));
    soundAmbienceCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons d'ambiance"));
    soundAppLaunchCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons au lancement"));
    soundNavigateCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de navigation"));
    soundSelectCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de sélection"));
    soundChatMessagesCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons des messages de tchat"));

    soundMenuAmbienceSlider = new wxSlider(parent, wxID_ANY, 25, 0, 100);
    soundTavernAmbienceSlider = new wxSlider(parent, wxID_ANY, 25, 0, 100);
    soundAppLaunchSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    soundNavigateSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    soundSelectSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    soundChatMessagesSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);

    soundMenuAmbienceValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Ambiance (menu) : 25 %"));
    soundTavernAmbienceValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Ambiance (table) : 25 %"));
    soundAppLaunchValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Lancement : 50 %"));
    soundNavigateValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Navigation : 50 %"));
    soundSelectValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Sélection : 50 %"));
    soundChatMessagesValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Messages : 50 %"));

    soundBox->Add(muteAllCheckbox, 0, wxBOTTOM, 12);
    soundBox->Add(soundAmbienceCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(soundAppLaunchCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(soundNavigateCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(soundSelectCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(soundChatMessagesCheckbox, 0, wxBOTTOM, 12);

    auto addSliderRow =
        [this, parent](wxGridBagSizer* grid, wxSlider* slider, wxStaticText* label, const wxString& prefix, int row)
    {
        auto* checkRow = new wxStaticText(parent, wxID_ANY, prefix);
        grid->Add(checkRow, wxGBPosition(row, 0), wxGBSpan(1, 1), wxALIGN_CENTER_VERTICAL | wxRIGHT, 10);
        grid->Add(slider, wxGBPosition(row, 1), wxGBSpan(1, 1), wxEXPAND);
        grid->Add(label, wxGBPosition(row, 2), wxGBSpan(1, 1), wxALIGN_CENTER_VERTICAL | wxLEFT, 10);
        label->SetLabel(wxString::Format(wxString(L"%s : %d %%"), prefix, slider->GetValue()));
    };

    auto* soundGrid = new wxGridBagSizer(10, 10);
    addSliderRow(soundGrid, soundMenuAmbienceSlider, soundMenuAmbienceValueLabel, wxString(L"Ambiance (menu)"), 0);
    addSliderRow(soundGrid, soundTavernAmbienceSlider, soundTavernAmbienceValueLabel, wxString(L"Ambiance (table)"), 1);
    addSliderRow(soundGrid, soundAppLaunchSlider, soundAppLaunchValueLabel, wxString(L"Lancement"), 2);
    addSliderRow(soundGrid, soundNavigateSlider, soundNavigateValueLabel, wxString(L"Navigation"), 3);
    addSliderRow(soundGrid, soundSelectSlider, soundSelectValueLabel, wxString(L"Sélection"), 4);
    addSliderRow(soundGrid, soundChatMessagesSlider, soundChatMessagesValueLabel, wxString(L"Sons de tchat"), 5);
    soundGrid->AddGrowableCol(1, 1);

    soundBox->Add(soundGrid, 1, wxEXPAND);
    sizer->Add(soundBox, 1, wxEXPAND);
    parent->SetSizer(sizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *muteAllCheckbox, wxString(L"Couper tous les sons"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAmbienceCheckbox, wxString(L"Sons d'ambiance"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAppLaunchCheckbox, wxString(L"Sons au lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundNavigateCheckbox, wxString(L"Sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundSelectCheckbox, wxString(L"Sons de sélection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundChatMessagesCheckbox, wxString(L"Sons des messages de tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundMenuAmbienceSlider, wxString(L"Volume ambiance menu"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundTavernAmbienceSlider, wxString(L"Volume ambiance table"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAppLaunchSlider, wxString(L"Volume sons de lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundNavigateSlider, wxString(L"Volume sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundSelectSlider, wxString(L"Volume sons de sélection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundChatMessagesSlider, wxString(L"Volume sons de tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundMenuAmbienceValueLabel, wxString(L"Valeur actuelle ambiance menu"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundTavernAmbienceValueLabel, wxString(L"Valeur actuelle ambiance table"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundAppLaunchValueLabel, wxString(L"Valeur actuelle sons de lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundNavigateValueLabel, wxString(L"Valeur actuelle sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundSelectValueLabel, wxString(L"Valeur actuelle sons de sélection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundChatMessagesValueLabel, wxString(L"Valeur actuelle sons de tchat"));
    AddSectionSaveButton(parent, sizer);
}

void OptionsView::BuildChatPage(wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    chatEnabledCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer le tchat"));
    confirmChatExitCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Confirmer la sortie du tchat"));
    sizer->Add(chatEnabledCheckbox, 0, wxBOTTOM, 12);
    sizer->Add(confirmChatExitCheckbox, 0);
    parent->SetSizer(sizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*chatEnabledCheckbox, wxString(L"Activer le tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *confirmChatExitCheckbox, wxString(L"Confirmer la sortie du tchat"));
    AddSectionSaveButton(parent, sizer);
}

void OptionsView::AddSectionSaveButton(wxWindow* parent, wxBoxSizer* sectionSizer)
{
    if (parent == nullptr || sectionSizer == nullptr)
    {
        return;
    }

    auto* sectionSaveButton = new wxButton(parent, wxID_ANY, wxString(L"Enregistrer"));
    sectionSizer->AddStretchSpacer();
    sectionSizer->Add(sectionSaveButton, 0, wxALIGN_RIGHT | wxTOP, 8);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionSaveButton, wxString(L"Enregistrer"));
    sectionSaveButtons.push_back(sectionSaveButton);

    sectionSaveButton->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            if (onSave_)
            {
                onSave_();
            }
        });
}
