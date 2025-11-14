package com.lemondelila.client.view.options;

import com.lemondelila.client.model.settings.AppSettings;
import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.client.service.update.UpdateCheckResult;
import com.lemondelila.client.service.update.UpdateService;
import com.lemondelila.framework.ui.util.ButtonUtils;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
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
import java.awt.Desktop;
import java.awt.Window;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Objects;

public final class OptionsDialog extends JDialog {

    private final JSlider gameVolumeSlider = slider();
    private final JSlider musicVolumeSlider = slider();
    private final JCheckBox confirmExit = new JCheckBox("Demander confirmation a la fermeture");
    private final JCheckBox chatEnabled = new JCheckBox("Activer le tchat global");
    private final JCheckBox confirmChatExit = new JCheckBox("Demander confirmation avant de fermer le tchat");
    private final JLabel currentVersionLabel = new JLabel();
    private final JLabel updateStatusLabel = new JLabel("Aucune vérification en cours.");
    private final JButton checkUpdateButton = new JButton("Vérifier les mises à jour");
    private final JButton saveButton = new JButton("Enregistrer");
    private final JButton cancelButton = new JButton("Annuler");
    private final AppSettingsService settingsService;
    private final UpdateService updateService;

    public OptionsDialog(Window owner, AppSettingsService service, UpdateService updateService) {
        super(owner, "Options", ModalityType.APPLICATION_MODAL);
        this.settingsService = Objects.requireNonNull(service, "service");
        this.updateService = Objects.requireNonNull(updateService, "updateService");
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

    private JPanel buildUpdatePanel() {
        JPanel panel = verticalPanel();
        currentVersionLabel.setText("Version actuelle : " + updateService.currentVersion());
        updateStatusLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        currentVersionLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        panel.add(currentVersionLabel);
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 8)));
        checkUpdateButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        checkUpdateButton.addActionListener(e -> performUpdateCheck());
        ButtonUtils.enterActivates(checkUpdateButton);
        panel.add(checkUpdateButton);
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

    private void performUpdateCheck() {
        checkUpdateButton.setEnabled(false);
        checkUpdateButton.setText("Vérification...");
        updateStatusLabel.setText("Recherche de mises à jour...");
        updateService.checkForUpdates().whenComplete((result, error) ->
                SwingUtilities.invokeLater(() -> {
                    checkUpdateButton.setEnabled(true);
                    checkUpdateButton.setText("Vérifier les mises à jour");
                    if (error != null) {
                        updateStatusLabel.setText("Erreur : " + error.getMessage());
                        JOptionPane.showMessageDialog(
                                this,
                                "Impossible de vérifier les mises à jour : " + error.getMessage(),
                                "Erreur de mise à jour",
                                JOptionPane.ERROR_MESSAGE
                        );
                        return;
                    }
                    handleUpdateResult(result);
                })
        );
    }

    private void handleUpdateResult(UpdateCheckResult result) {
        if (result == null) {
            updateStatusLabel.setText("Réponse inattendue.");
            return;
        }
        if (result.updateAvailable()) {
            String remote = result.remoteVersion().isBlank() ? "inconnue" : result.remoteVersion();
            updateStatusLabel.setText("Nouvelle version disponible : " + remote);
            StringBuilder message = new StringBuilder("Une nouvelle version (")
                    .append(remote)
                    .append(") est disponible.\n");
            if (!result.notes().isBlank()) {
                message.append("\n").append(result.notes()).append("\n\n");
            }
            message.append("Voulez-vous ouvrir la page de téléchargement ?");
            int choice = JOptionPane.showConfirmDialog(
                    this,
                    message.toString(),
                    "Mise à jour disponible",
                    JOptionPane.YES_NO_OPTION
            );
            if (choice == JOptionPane.YES_OPTION) {
                openDownloadLink(result.downloadUrl());
            }
        } else {
            updateStatusLabel.setText("Client à jour ("
                    + (result.currentVersion().isBlank() ? "version inconnue" : result.currentVersion())
                    + ").");
            JOptionPane.showMessageDialog(
                    this,
                    "Vous disposez déjà de la dernière version.",
                    "Mise à jour",
                    JOptionPane.INFORMATION_MESSAGE
            );
        }
    }

    private void openDownloadLink(String url) {
        if (url == null || url.isBlank()) {
            JOptionPane.showMessageDialog(
                    this,
                    "URL de téléchargement indisponible. Consultez le site officiel.",
                    "Téléchargement indisponible",
                    JOptionPane.WARNING_MESSAGE
            );
            return;
        }
        try {
            URI uri = new URI(url);
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(uri);
            } else {
                throw new UnsupportedOperationException("Desktop non supporté");
            }
        } catch (IOException | URISyntaxException | UnsupportedOperationException ex) {
            JOptionPane.showMessageDialog(
                    this,
                    "Impossible d'ouvrir le navigateur : " + ex.getMessage(),
                    "Téléchargement",
                    JOptionPane.ERROR_MESSAGE
            );
        }
    }
}
