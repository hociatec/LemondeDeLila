package com.lemondelila.client.ui.options;

import com.lemondelila.client.settings.AppSettings;
import com.lemondelila.client.settings.AppSettingsService;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSlider;
import javax.swing.SwingConstants;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.awt.Window;

public final class OptionsDialog extends JDialog {

    private final JSlider gameVolumeSlider = slider();
    private final JSlider musicVolumeSlider = slider();
    private final JCheckBox confirmExit = new JCheckBox("Demander confirmation Ã  la fermeture");
    private final JCheckBox chatEnabled = new JCheckBox("Activer le tchat global");
    private final JCheckBox confirmChatExit = new JCheckBox("Demander confirmation avant de fermer le tchat");
    private final JButton saveButton = new JButton("Enregistrer");
    private final JButton cancelButton = new JButton("Annuler");
    private final AppSettingsService settingsService;

    public OptionsDialog(Window owner, AppSettingsService service) {
        super(owner, "Options", ModalityType.APPLICATION_MODAL);
        this.settingsService = service;
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout(12, 12));
        JPanel content = new JPanel(new GridLayout(0, 1, 8, 8));
        content.setBorder(new EmptyBorder(16, 16, 16, 16));

        content.add(labelled("Volume du jeu", gameVolumeSlider));
        content.add(labelled("Volume de la musique", musicVolumeSlider));
        content.add(confirmExit);
        content.add(chatEnabled);
        content.add(confirmChatExit);

        add(content, BorderLayout.CENTER);
        add(buildButtons(), BorderLayout.SOUTH);

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

    private JSlider slider() {
        JSlider slider = new JSlider(SwingConstants.HORIZONTAL, 0, 100, 50);
        slider.setMajorTickSpacing(25);
        slider.setPaintTicks(true);
        slider.setPaintLabels(true);
        return slider;
    }

    private JPanel buildButtons() {
        JPanel panel = new JPanel();
        saveButton.addActionListener(e -> {
            settingsService.update(new AppSettings(
                    gameVolumeSlider.getValue(),
                    musicVolumeSlider.getValue(),
                    confirmExit.isSelected(),
                    chatEnabled.isSelected(),
                    confirmChatExit.isSelected()
            ));
            dispose();
        });
        cancelButton.addActionListener(e -> dispose());
        panel.add(saveButton);
        panel.add(cancelButton);
        return panel;
    }

    private void loadValues() {
        AppSettings current = settingsService.current();
        gameVolumeSlider.setValue(current.gameVolume());
        musicVolumeSlider.setValue(current.musicVolume());
        confirmExit.setSelected(current.confirmOnExit());
        chatEnabled.setSelected(current.chatEnabled());
        confirmChatExit.setSelected(current.confirmChatExit());
    }
}

