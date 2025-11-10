package com.lemondelila.client.view.options;

import com.lemondelila.client.model.settings.AppSettings;
import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.framework.ui.util.ButtonUtils;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
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

public final class OptionsDialog extends JDialog {

    private final JSlider gameVolumeSlider = slider();
    private final JSlider musicVolumeSlider = slider();
    private final JCheckBox confirmExit = new JCheckBox("Demander confirmation a la fermeture");
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
        JTabbedPane tabs = new JTabbedPane();
        tabs.setBorder(new EmptyBorder(8, 16, 8, 16));
        tabs.addTab("Volume", buildVolumePanel());
        tabs.addTab("Chat", buildChatPanel());
        tabs.addTab("Général", buildGeneralPanel());

        add(tabs, BorderLayout.CENTER);
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

    private JPanel buildVolumePanel() {
        JPanel panel = verticalPanel();
        panel.add(labelled("Effets sonores", gameVolumeSlider));
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 12)));
        panel.add(labelled("Musique", musicVolumeSlider));
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
        ButtonUtils.enterActivates(saveButton);
        ButtonUtils.enterActivates(cancelButton);
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



