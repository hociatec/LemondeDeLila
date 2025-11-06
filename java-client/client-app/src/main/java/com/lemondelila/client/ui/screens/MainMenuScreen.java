package com.lemondelila.client.ui.screens;

import com.lemondelila.client.chat.ChatConnectionFactory;
import com.lemondelila.client.session.ClientSession;
import com.lemondelila.client.settings.AppSettingsService;
import com.lemondelila.client.ui.chat.ChatWindow;
import com.lemondelila.client.ui.options.OptionsDialog;
import com.lemondelila.client.ui.presence.PresenceListDialog;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;

import javax.swing.AbstractAction;
import javax.swing.DefaultListModel;
import javax.swing.KeyStroke;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;

public final class MainMenuScreen extends JPanel implements Screen {

    private final DialogService dialogService;
    private final AppSettingsService settingsService;
    private final ChatConnectionFactory chatConnectionFactory;
    private final ClientSession session;
    private final DefaultListModel<MenuEntry> model = new DefaultListModel<>();
    private final JList<MenuEntry> menuList = new JList<>(model);

    public MainMenuScreen(DialogService dialogService,
                          AppSettingsService settingsService,
                          ChatConnectionFactory chatConnectionFactory,
                          ClientSession session) {
        this.dialogService = dialogService;
        this.settingsService = settingsService;
        this.chatConnectionFactory = chatConnectionFactory;
        this.session = session;
        buildUi();
    }

    private void buildUi() {
        setLayout(new BorderLayout(16, 16));
        setBorder(javax.swing.BorderFactory.createEmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel("Menu principal");
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(28f));
        add(title, BorderLayout.NORTH);

        model.addElement(new MenuEntry("Etageres",
                () -> dialogService.info("Etageres", "Cette section sera disponible prochainement.")));
        model.addElement(new MenuEntry("Rejoindre une table",
                () -> dialogService.info("Rejoindre une table", "Fonctionnalite bientot disponible.")));
        model.addElement(new MenuEntry("Tchat", this::openChat));
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
        registerShortcuts();
    }

    private void triggerSelection() {
        MenuEntry entry = menuList.getSelectedValue();
        if (entry != null) {
            entry.action().run();
        }
    }

    private void openOptions() {
        Window owner = SwingUtilities.getWindowAncestor(this) instanceof Window
                ? (Window) SwingUtilities.getWindowAncestor(this)
                : null;
        new OptionsDialog(owner, settingsService).setVisible(true);
    }

    private void openChat() {
        var settings = settingsService.current();
        if (!settings.chatEnabled()) {
            dialogService.info("Tchat", "Vous avez desactive le tchat dans les options.");
            return;
        }
        if (session.authenticated().isEmpty()) {
            dialogService.error("Tchat", "Vous devez etre connecte pour acceder au tchat.");
            return;
        }
        Window owner = SwingUtilities.getWindowAncestor(this) instanceof Window
                ? (Window) SwingUtilities.getWindowAncestor(this)
                : null;
        try {
            ChatWindow window = new ChatWindow(owner, chatConnectionFactory, settingsService, dialogService);
            window.setVisible(true);
        } catch (IllegalStateException ex) {
            dialogService.error("Tchat", ex.getMessage());
        }
    }

    private void openPresenceDialog() {
        var settings = settingsService.current();
        if (!settings.chatEnabled()) {
            dialogService.info("Presence", "Activez le tchat pour consulter la liste des connectes.");
            return;
        }
        if (session.authenticated().isEmpty()) {
            dialogService.error("Presence", "Vous devez etre connecte pour consulter la liste.");
            return;
        }
        Window owner = SwingUtilities.getWindowAncestor(this) instanceof Window
                ? (Window) SwingUtilities.getWindowAncestor(this)
                : null;
        new PresenceListDialog(owner, chatConnectionFactory, dialogService).setVisible(true);
    }

    private void registerShortcuts() {
        getInputMap(WHEN_IN_FOCUSED_WINDOW)
                .put(KeyStroke.getKeyStroke(KeyEvent.VK_U, KeyEvent.CTRL_DOWN_MASK), "showPresence");
        getActionMap().put("showPresence", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                openPresenceDialog();
            }
        });
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
