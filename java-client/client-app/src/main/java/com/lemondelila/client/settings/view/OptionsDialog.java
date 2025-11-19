package com.lemondelila.client.settings.view;

import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.settings.model.AppSettings;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.settings.update.UpdateCheckResult;
import com.lemondelila.client.settings.update.UpdateService;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JSlider;
import javax.swing.SwingConstants;
import javax.swing.JTabbedPane;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Window;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;

public final class OptionsDialog extends JDialog {

    private final JSlider musicVolumeSlider = slider();
    private final JSlider appLaunchVolumeSlider = slider();
    private final JSlider backgroundVolumeSlider = slider();
    private final JSlider navigateVolumeSlider = slider();
    private final JSlider selectVolumeSlider = slider();
    private final JCheckBox muteAll = new JCheckBox("Désactiver tous les sons");
    private final JCheckBox confirmExit = new JCheckBox("Demander confirmation a la fermeture");
    private final JCheckBox chatEnabled = new JCheckBox("Activer le tchat global");
    private final JCheckBox confirmChatExit = new JCheckBox("Demander confirmation avant de fermer le tchat");
    private final JCheckBox stayConnected = new JCheckBox("Rester connecté automatiquement");
    private final JCheckBox soundAppLaunch = new JCheckBox("Son d'entrée dans la taverne");
    private final JCheckBox soundBackground = new JCheckBox("Ambiance de taverne en fond");
    private final JCheckBox soundNavigate = new JCheckBox("Son lors de la navigation");
    private final JCheckBox soundSelect = new JCheckBox("Son lors de la sélection");
    private final JButton saveButton = new JButton("Enregistrer");
    private final JButton cancelButton = new JButton("Annuler");
    private final AppSettingsService settingsService;
    private final UpdateService updateService;
    private final SoundEffectManager sounds;
    private final JLabel currentVersionLabel = new JLabel();
    private final JLabel updateStatusLabel = new JLabel("Aucune vérification en cours.");
    private final JButton checkUpdateButton = new JButton("Vérifier les mises à jour");
    private final JButton installUpdateButton = new JButton("Installer la mise à jour");
    private volatile UpdateCheckResult pendingUpdate;

    public OptionsDialog(Window owner,
                         AppSettingsService service,
                         UpdateService updateService,
                         SoundEffectManager sounds) {
        super(owner, "Options", ModalityType.APPLICATION_MODAL);
        this.settingsService = service;
        this.updateService = updateService;
        this.sounds = sounds;
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout(12, 12));
        JTabbedPane tabs = new JTabbedPane();
        tabs.setBorder(new EmptyBorder(8, 16, 8, 16));
        tabs.addTab("Volume", buildVolumePanel());
        tabs.addTab("Chat", buildChatPanel());
        tabs.addTab("Général", buildGeneralPanel());
        tabs.addTab("Mises à jour", buildUpdatePanel());

        add(tabs, BorderLayout.CENTER);
        add(buildButtons(), BorderLayout.SOUTH);

        muteAll.addActionListener(e -> updateVolumeControls());
        soundAppLaunch.addActionListener(e -> updateVolumeControls());
        soundBackground.addActionListener(e -> updateVolumeControls());
        soundNavigate.addActionListener(e -> updateVolumeControls());
        soundSelect.addActionListener(e -> updateVolumeControls());
        registerNavigationSound(musicVolumeSlider);
        registerNavigationSound(appLaunchVolumeSlider);
        registerNavigationSound(backgroundVolumeSlider);
        registerNavigationSound(navigateVolumeSlider);
        registerNavigationSound(selectVolumeSlider);
        registerNavigationSound(muteAll);
        registerNavigationSound(soundAppLaunch);
        registerNavigationSound(soundBackground);
        registerNavigationSound(soundNavigate);
        registerNavigationSound(soundSelect);
        registerNavigationSound(confirmExit);
        registerNavigationSound(chatEnabled);
        registerNavigationSound(confirmChatExit);
        registerNavigationSound(stayConnected);
        registerNavigationSound(saveButton);
        registerNavigationSound(cancelButton);
        registerNavigationSound(checkUpdateButton);
        registerNavigationSound(installUpdateButton);
        loadValues();
        getRootPane().setDefaultButton(saveButton);
        pack();
        setLocationRelativeTo(owner);
    }

    private JPanel labelled(String title, JSlider slider) {
        JPanel panel = new JPanel(new BorderLayout());
        JLabel label = new JLabel(title);
        label.setLabelFor(slider);
        panel.add(label, BorderLayout.NORTH);
        panel.add(slider, BorderLayout.CENTER);
        panel.setBorder(BorderFactory.createEmptyBorder(0, 0, 8, 0));
        return panel;
    }

    private JPanel soundOption(JCheckBox toggle, JSlider slider) {
        JPanel container = new JPanel(new BorderLayout());
        container.setOpaque(false);
        container.add(toggle, BorderLayout.NORTH);
        container.add(slider, BorderLayout.CENTER);
        container.setBorder(BorderFactory.createEmptyBorder(0, 0, 12, 0));
        return container;
    }

    private JSlider slider() {
        JSlider slider = new JSlider(SwingConstants.HORIZONTAL, 0, 100, 50);
        slider.setMajorTickSpacing(25);
        slider.setPaintTicks(true);
        slider.setPaintLabels(true);
        return slider;
    }

    private JPanel buildVolumePanel() {
        JPanel panel = verticalPanel();
        panel.add(labelled("Musique", musicVolumeSlider));
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 12)));
        panel.add(muteAll);
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 12)));
        panel.add(soundOption(soundAppLaunch, appLaunchVolumeSlider));
        panel.add(soundOption(soundBackground, backgroundVolumeSlider));
        panel.add(soundOption(soundNavigate, navigateVolumeSlider));
        panel.add(soundOption(soundSelect, selectVolumeSlider));
        return panel;
    }

    private JPanel buildChatPanel() {
        JPanel panel = verticalPanel();
        panel.add(chatEnabled);
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 8)));
        panel.add(confirmChatExit);
        return panel;
    }

    private JPanel buildGeneralPanel() {
        JPanel panel = verticalPanel();
        panel.add(confirmExit);
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 8)));
        panel.add(stayConnected);
        return panel;
    }

    private JPanel buildUpdatePanel() {
        JPanel panel = verticalPanel();
        currentVersionLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        String currentVersion = updateService != null ? updateService.currentVersion() : "inconnue";
        currentVersionLabel.setText("Version actuelle : " + currentVersion);
        updateStatusLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        checkUpdateButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        installUpdateButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        installUpdateButton.setEnabled(false);
        checkUpdateButton.addActionListener(e -> performUpdateCheck());
        installUpdateButton.addActionListener(e -> performUpdateInstall());
        ButtonUtils.enterActivates(checkUpdateButton);
        ButtonUtils.enterActivates(installUpdateButton);
        panel.add(currentVersionLabel);
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 8)));
        panel.add(checkUpdateButton);
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 8)));
        panel.add(installUpdateButton);
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 8)));
        panel.add(updateStatusLabel);
        return panel;
    }

    private JPanel verticalPanel() {
        JPanel panel = new JPanel();
        panel.setOpaque(false);
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(new EmptyBorder(12, 12, 12, 12));
        panel.setAlignmentX(Component.LEFT_ALIGNMENT);
        return panel;
    }

    private JPanel buildButtons() {
        JPanel panel = new JPanel();
        saveButton.addActionListener(e -> {
            playSelect();
            settingsService.update(new AppSettings(
                    musicVolumeSlider.getValue(),
                    !muteAll.isSelected(),
                    soundAppLaunch.isSelected(),
                    appLaunchVolumeSlider.getValue(),
                    soundBackground.isSelected(),
                    backgroundVolumeSlider.getValue(),
                    soundNavigate.isSelected(),
                    navigateVolumeSlider.getValue(),
                    soundSelect.isSelected(),
                    selectVolumeSlider.getValue(),
                    confirmExit.isSelected(),
                    chatEnabled.isSelected(),
                    confirmChatExit.isSelected(),
                    stayConnected.isSelected()
            ));
            dispose();
        });
        cancelButton.addActionListener(e -> {
            playSelect();
            dispose();
        });
        ButtonUtils.enterActivates(saveButton);
        ButtonUtils.enterActivates(cancelButton);
        panel.add(saveButton);
        panel.add(cancelButton);
        return panel;
    }

    private void loadValues() {
        AppSettings current = settingsService.current();
        musicVolumeSlider.setValue(current.musicVolume());
        muteAll.setSelected(!current.soundEnabled());
        soundAppLaunch.setSelected(current.soundAppLaunch());
        appLaunchVolumeSlider.setValue(current.soundAppLaunchVolume());
        soundBackground.setSelected(current.soundBackground());
        backgroundVolumeSlider.setValue(current.soundBackgroundVolume());
        soundNavigate.setSelected(current.soundNavigate());
        navigateVolumeSlider.setValue(current.soundNavigateVolume());
        soundSelect.setSelected(current.soundSelect());
        selectVolumeSlider.setValue(current.soundSelectVolume());
        confirmExit.setSelected(current.confirmOnExit());
        chatEnabled.setSelected(current.chatEnabled());
        confirmChatExit.setSelected(current.confirmChatExit());
        stayConnected.setSelected(current.stayConnected());
        updateVolumeControls();
    }

    private void updateVolumeControls() {
        boolean enabled = !muteAll.isSelected();
        musicVolumeSlider.setEnabled(enabled);
        soundAppLaunch.setEnabled(enabled);
        appLaunchVolumeSlider.setEnabled(enabled && soundAppLaunch.isSelected());
        soundBackground.setEnabled(enabled);
        backgroundVolumeSlider.setEnabled(enabled && soundBackground.isSelected());
        soundNavigate.setEnabled(enabled);
        navigateVolumeSlider.setEnabled(enabled && soundNavigate.isSelected());
        soundSelect.setEnabled(enabled);
        selectVolumeSlider.setEnabled(enabled && soundSelect.isSelected());
    }

    private void registerNavigationSound(JComponent component) {
        component.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                playNavigate();
            }
        });
    }

    private void playSelect() {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_SELECT);
        }
    }

    private void playNavigate() {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_NAVIGATE);
        }
    }

    private void performUpdateCheck() {
        if (updateService == null) {
            updateStatusLabel.setText("Service de mise à jour indisponible.");
            setUpdateButtonsState(true, false);
            return;
        }
        playSelect();
        pendingUpdate = null;
        updateStatusLabel.setText("Recherche de mise à jour...");
        setUpdateButtonsState(false, false);
        updateService.checkForUpdates().whenComplete((result, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        handleUpdateFailure(error);
                    } else {
                        handleUpdateCheckSuccess(result);
                    }
                })
        );
    }

    private void handleUpdateCheckSuccess(UpdateCheckResult result) {
        pendingUpdate = null;
        currentVersionLabel.setText("Version actuelle : " + result.currentVersion());
        if (result.updateAvailable()) {
            pendingUpdate = result;
            String message = "Nouvelle version " + result.remoteVersion() + " disponible.";
            if (result.notes() != null && !result.notes().isBlank()) {
                message += " " + result.notes();
            }
            updateStatusLabel.setText(message);
            setUpdateButtonsState(true, true);
        } else {
            updateStatusLabel.setText("Vous disposez déjà de la dernière version.");
            setUpdateButtonsState(true, false);
        }
    }

    private void handleUpdateFailure(Throwable error) {
        pendingUpdate = null;
        String message = error != null && error.getMessage() != null
                ? error.getMessage()
                : "erreur inconnue";
        updateStatusLabel.setText("Erreur : " + message);
        setUpdateButtonsState(true, false);
    }

    private void performUpdateInstall() {
        if (updateService == null) {
            return;
        }
        if (pendingUpdate == null) {
            updateStatusLabel.setText("Aucune mise à jour disponible.");
            setUpdateButtonsState(true, false);
            return;
        }
        playSelect();
        UpdateCheckResult target = pendingUpdate;
        setUpdateButtonsState(false, false);
        updateStatusLabel.setText("Téléchargement de la mise à jour...");
        updateService.downloadAndInstall(target, status ->
                SwingUtilities.invokeLater(() -> updateStatusLabel.setText(status))
        ).whenComplete((ignored, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                handleUpdateFailure(error);
                pendingUpdate = target;
                return;
            }
            pendingUpdate = null;
            updateStatusLabel.setText("Mise à jour installée. Redémarrez l'application pour l'appliquer.");
            JOptionPane.showMessageDialog(
                    this,
                    "La mise à jour a été installée avec succès.\nVeuillez redémarrer l'application.",
                    "Mise à jour terminée",
                    JOptionPane.INFORMATION_MESSAGE
            );
            setUpdateButtonsState(true, false);
        }));
    }

    private void setUpdateButtonsState(boolean checkEnabled, boolean installEnabled) {
        checkUpdateButton.setEnabled(checkEnabled);
        installUpdateButton.setEnabled(installEnabled);
    }
}
