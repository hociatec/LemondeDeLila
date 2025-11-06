package com.lemondelila.client.ui.screens;

import com.lemondelila.client.settings.AppSettingsService;
import com.lemondelila.client.ui.options.OptionsDialog;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;

import javax.swing.DefaultListModel;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.Window;

public final class MainMenuScreen extends JPanel implements Screen {

    private final DialogService dialogService;
    private final AppSettingsService settingsService;
    private final DefaultListModel<MenuEntry> model = new DefaultListModel<>();
    private final JList<MenuEntry> menuList = new JList<>(model);

    public MainMenuScreen(DialogService dialogService, AppSettingsService settingsService) {
        this.dialogService = dialogService;
        this.settingsService = settingsService;
        buildUi();
    }

    private void buildUi() {
        setLayout(new BorderLayout(16, 16));
        setBorder(javax.swing.BorderFactory.createEmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel("Menu principal");
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(28f));
        add(title, BorderLayout.NORTH);

        model.addElement(new MenuEntry("Étagères", () ->
                dialogService.info("Étagères", "Cette section sera disponible prochainement.")));
        model.addElement(new MenuEntry("Rejoindre une table", () ->
                dialogService.info("Rejoindre une table", "Fonctionnalité bientôt disponible.")));
        model.addElement(new MenuEntry("Options", this::openOptions));

        menuList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        menuList.setSelectedIndex(0);
        menuList.setVisibleRowCount(model.size());
        menuList.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER) {
                    triggerSelection();
                }
            }
        });

        add(new JScrollPane(menuList), BorderLayout.CENTER);
        setPreferredSize(new Dimension(480, 360));
    }

    private void triggerSelection() {
        MenuEntry entry = menuList.getSelectedValue();
        if (entry != null) {
            entry.action().run();
        }
    }

    private void openOptions() {
        Component parentComponent = SwingUtilities.getWindowAncestor(this);
        Window owner = parentComponent instanceof Window ? (Window) parentComponent : null;
        OptionsDialog dialog = new OptionsDialog(owner, settingsService);
        dialog.setVisible(true);
    }

    @Override
    public String id() {
        return "main-menu";
    }

    @Override
    public MainMenuScreen getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        SwingUtilities.invokeLater(() -> menuList.requestFocusInWindow());
    }

    private record MenuEntry(String label, Runnable action) {
        @Override
        public String toString() {
            return label;
        }
    }
}
