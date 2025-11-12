package com.lemondelila.client.view.options;

import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.model.settings.AppSettings;
import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.framework.media.sound.SoundEffectManager;
import com.lemondelila.framework.ui.util.ButtonUtils;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSlider;
import javax.swing.SwingConstants;
import javax.swing.JTabbedPane;
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
    private final JCheckBox soundAppLaunch = new JCheckBox("Son d'entrée dans la taverne");
    private final JCheckBox soundBackground = new JCheckBox("Ambiance de taverne en fond");
    private final JCheckBox soundNavigate = new JCheckBox("Son lors de la navigation");
    private final JCheckBox soundSelect = new JCheckBox("Son lors de la sélection");
    private final JButton saveButton = new JButton("Enregistrer");
    private final JButton cancelButton = new JButton("Annuler");
    private final AppSettingsService settingsService;
    private final SoundEffectManager sounds;

    public OptionsDialog(Window owner, AppSettingsService service, SoundEffectManager sounds) {
        super(owner, "Options", ModalityType.APPLICATION_MODAL);
        this.settingsService = service;
        this.sounds = sounds;
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout(12, 12));
        JTabbedPane tabs = new JTabbedPane();
        tabs.setBorder(new EmptyBorder(8, 16, 8, 16));
        tabs.addTab("Volume", buildVolumePanel());
        tabs.addTab("Chat", buildChatPanel());
        tabs.addTab("Général", buildGeneralPanel());

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
        registerNavigationSound(saveButton);
        registerNavigationSound(cancelButton);
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
                    confirmChatExit.isSelected()
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

}



