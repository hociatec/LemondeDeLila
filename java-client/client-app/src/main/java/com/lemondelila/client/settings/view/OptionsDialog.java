package com.lemondelila.client.settings.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.component.AccessibleStatusPanel;
import com.lemondelila.client.framework.ui.util.ButtonUtils;
import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.settings.model.AppSettings;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.settings.update.UpdateCheckResult;
import com.lemondelila.client.settings.update.UpdateService;

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
import javax.swing.JTabbedPane;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
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
    private final JCheckBox muteAll = new JCheckBox(Internationalization.text("options.sound.muteAll"));
    private final JCheckBox confirmExit = new JCheckBox(Internationalization.text("options.sound.confirmExit"));
    private final JCheckBox chatEnabled = new JCheckBox(Internationalization.text("options.chat.enabled"));
    private final JCheckBox confirmChatExit = new JCheckBox(Internationalization.text("options.chat.confirmExit"));
    private final JCheckBox stayConnected = new JCheckBox(Internationalization.text("options.general.stayConnected"));
    private final JCheckBox extraDescriptions = new JCheckBox(Internationalization.text("options.general.extraDescriptions"));
    private final JCheckBox soundAppLaunch = new JCheckBox(Internationalization.text("options.sound.appLaunch"));
    private final JCheckBox soundBackground = new JCheckBox(Internationalization.text("options.sound.background"));
    private final JCheckBox soundNavigate = new JCheckBox(Internationalization.text("options.sound.navigate"));
    private final JCheckBox soundSelect = new JCheckBox(Internationalization.text("options.sound.select"));
    private final JButton saveButton = new JButton(Internationalization.text("options.buttons.save"));
    private final JButton cancelButton = new JButton(Internationalization.text("options.buttons.cancel"));
    private final AppSettingsService settingsService;
    private final UpdateService updateService;
    private final SoundEffectManager sounds;
    private final JLabel currentVersionLabel = new JLabel();
    private final AccessibleStatusPanel updateStatusPanel = new AccessibleStatusPanel(
            Internationalization.text("options.updates.status.accessible.name"),
            Internationalization.text("options.updates.status.accessible.desc")
    );
    private final int updateTabIndex;
    private final JButton checkUpdateButton = new JButton(Internationalization.text("options.updates.check"));
    private final JButton installUpdateButton = new JButton(Internationalization.text("options.updates.install"));
    private volatile UpdateCheckResult pendingUpdate;

    public OptionsDialog(Window owner,
                         AppSettingsService service,
                         UpdateService updateService,
                         SoundEffectManager sounds) {
        super(owner, Internationalization.text("options.dialog.title"), ModalityType.APPLICATION_MODAL);
        this.settingsService = service;
        this.updateService = updateService;
        this.sounds = sounds;
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BorderLayout(12, 12));
        JTabbedPane tabs = new JTabbedPane();
        tabs.setBorder(new EmptyBorder(8, 16, 8, 16));
        tabs.addTab(Internationalization.text("options.tab.volume"), buildVolumePanel());
        tabs.addTab(Internationalization.text("options.tab.chat"), buildChatPanel());
        tabs.addTab(Internationalization.text("options.tab.general"), buildGeneralPanel());
        tabs.addTab(Internationalization.text("options.tab.updates"), buildUpdatePanel());
        updateTabIndex = tabs.getTabCount() - 1;
        TabDefaultButtonSwitcher switcher = new TabDefaultButtonSwitcher(tabs);
        tabs.addChangeListener(switcher);
        switcher.stateChanged(null);

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
        registerNavigationSound(extraDescriptions);
        registerNavigationSound(saveButton);
        registerNavigationSound(cancelButton);
        registerNavigationSound(checkUpdateButton);
        registerNavigationSound(installUpdateButton);
        loadValues();
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
        panel.add(labelled(Internationalization.text("options.volume.music"), musicVolumeSlider));
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
        panel.add(Box.createRigidArea(new java.awt.Dimension(0, 8)));
        panel.add(extraDescriptions);
        return panel;
    }

    private JPanel buildUpdatePanel() {
        JPanel panel = verticalPanel();
        currentVersionLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        String currentVersion = updateService != null ? updateService.currentVersion() : Internationalization.text("options.updates.version.unknown");
        currentVersionLabel.setText(Internationalization.text("options.updates.currentVersion", currentVersion));
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
        panel.add(updateStatusPanel.component());
        setUpdateStatus(Internationalization.text("options.updates.status.none"));
        applyAccessibility(currentVersionLabel, "options.updates.currentVersion", "options.updates.currentVersion.desc");
        applyAccessibility(checkUpdateButton, "options.updates.check");
        applyAccessibility(installUpdateButton, "options.updates.install");
        applyAccessibility(updateStatusPanel.component(), "options.updates.status.accessible.name", "options.updates.status.accessible.desc");
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
                    stayConnected.isSelected(),
                    extraDescriptions.isSelected()
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
        extraDescriptions.setSelected(current.extraDescriptionsEnabled());
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
            setUpdateStatus(Internationalization.text("options.updates.status.unavailable"));
            setUpdateButtonsState(true, false);
            return;
        }
        playSelect();
        pendingUpdate = null;
        setUpdateStatus(Internationalization.text("options.updates.status.checking"));
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
        currentVersionLabel.setText(Internationalization.text("options.updates.currentVersion", result.currentVersion()));
        boolean mandatory = isMandatory(result);
        if (result.updateAvailable()) {
            pendingUpdate = result;
            StringBuilder message = new StringBuilder(Internationalization.text("options.updates.status.new", result.remoteVersion()));
            if (mandatory && result.minSupportedVersion() != null) {
                message.append(Internationalization.text("options.updates.status.mandatorySuffix", result.minSupportedVersion()));
            }
            String changelog = summarizeChangelog(result);
            if (changelog != null) {
                message.append(" ").append(changelog);
            } else if (result.notes() != null && !result.notes().isBlank()) {
                message.append(" ").append(result.notes());
            }
            setUpdateStatus(message.toString());
            setUpdateButtonsState(true, true);
            showUpdateDialog(message.toString(), JOptionPane.INFORMATION_MESSAGE);
        } else {
            if (mandatory) {
                setUpdateStatus(Internationalization.text("options.updates.status.mandatory"));
            } else {
                setUpdateStatus(Internationalization.text("options.updates.status.uptodate"));
            }
            setUpdateButtonsState(true, false);
            showUpdateDialog(updateStatusPanel.component().getText(), JOptionPane.INFORMATION_MESSAGE);
        }
    }

    private void handleUpdateFailure(Throwable error) {
        pendingUpdate = null;
        String message = error != null && error.getMessage() != null
                ? error.getMessage()
                : Internationalization.text("options.updates.status.unknownError");
        setUpdateStatus(Internationalization.text("options.updates.status.error", message));
        setUpdateButtonsState(true, false);
        showUpdateDialog(Internationalization.text("options.updates.status.error", message), JOptionPane.ERROR_MESSAGE);
    }

    private void performUpdateInstall() {
        if (updateService == null) {
            return;
        }
        if (pendingUpdate == null) {
            setUpdateStatus(Internationalization.text("options.updates.status.noneAvailable"));
            setUpdateButtonsState(true, false);
            return;
        }
        playSelect();
        UpdateCheckResult target = pendingUpdate;
        setUpdateButtonsState(false, false);
        setUpdateStatus(Internationalization.text("options.updates.status.downloading"));
        updateService.downloadAndInstall(target, status ->
                SwingUtilities.invokeLater(() -> setUpdateStatus(status))
        ).whenComplete((ignored, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                handleUpdateFailure(error);
                pendingUpdate = target;
                return;
            }
            pendingUpdate = null;
            setUpdateStatus(Internationalization.text("options.updates.status.installed"));
            JOptionPane.showMessageDialog(
                    this,
                    Internationalization.text("options.updates.status.installingDialogBody"),
                    Internationalization.text("options.updates.status.installingDialogTitle"),
                    JOptionPane.INFORMATION_MESSAGE
            );
            setUpdateButtonsState(true, false);
        }));
    }

    private void setUpdateButtonsState(boolean checkEnabled, boolean installEnabled) {
        checkUpdateButton.setEnabled(checkEnabled);
        installUpdateButton.setEnabled(installEnabled);
    }

    private void setUpdateStatus(String text) {
        updateStatusPanel.setStatus(text, text);
    }

    private void showUpdateDialog(String message, int messageType) {
        JOptionPane.showMessageDialog(
                this,
                message,
                Internationalization.text("options.updates.dialog.title"),
                messageType
        );
    }

    private void applyAccessibility(JComponent component, String nameKey) {
        applyAccessibility(component, nameKey, nameKey + ".desc");
    }

    private void applyAccessibility(JComponent component, String nameKey, String descKey) {
        AccessibleDecorator.apply(component, AccessibleSpec.builder()
                .name(Internationalization.text(nameKey))
                .description(Internationalization.text(descKey))
                .build());
    }

    private final class TabDefaultButtonSwitcher implements ChangeListener {
        private final JTabbedPane tabs;

        private TabDefaultButtonSwitcher(JTabbedPane tabs) {
            this.tabs = tabs;
        }

        @Override
        public void stateChanged(ChangeEvent e) {
            int index = tabs.getSelectedIndex();
            if (index == updateTabIndex) {
                getRootPane().setDefaultButton(checkUpdateButton);
            } else {
                getRootPane().setDefaultButton(saveButton);
            }
        }
    }

    private boolean isMandatory(UpdateCheckResult result) {
        if (result == null || result.minSupportedVersion() == null) {
            return false;
        }
        return compareVersions(result.minSupportedVersion(), result.currentVersion()) > 0;
    }

    private int compareVersions(String left, String right) {
        if (left == null || right == null) {
            return 0;
        }
        String[] leftParts = left.split("[\\.\\-]");
        String[] rightParts = right.split("[\\.\\-]");
        int length = Math.max(leftParts.length, rightParts.length);
        for (int i = 0; i < length; i++) {
            int leftValue = i < leftParts.length ? parsePart(leftParts[i]) : 0;
            int rightValue = i < rightParts.length ? parsePart(rightParts[i]) : 0;
            if (leftValue != rightValue) {
                return Integer.compare(leftValue, rightValue);
            }
        }
        return 0;
    }

    private int parsePart(String part) {
        try {
            return Integer.parseInt(part.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String summarizeChangelog(UpdateCheckResult result) {
        if (result == null || result.changelog() == null || result.changelog().isEmpty()) {
            return null;
        }
        var entry = result.changelog().get(0);
        if (entry.notes() != null && !entry.notes().isBlank()) {
            return entry.notes();
        }
        if (!entry.highlights().isEmpty()) {
            return Internationalization.text("options.updates.status.features", String.join(", ", entry.highlights()));
        }
        if (!entry.fixes().isEmpty()) {
            return Internationalization.text("options.updates.status.fixes", String.join(", ", entry.fixes()));
        }
        return null;
    }
}
