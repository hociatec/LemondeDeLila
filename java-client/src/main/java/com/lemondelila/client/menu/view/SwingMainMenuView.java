package com.lemondelila.client.menu.view;

import com.lemondelila.client.menu.model.CategorySummary;
import com.lemondelila.client.menu.model.RoomSummary;
import com.lemondelila.client.ui.dialog.ConfirmationDialog;

import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.KeyboardFocusManager;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Implementation Swing du menu principal pour l'utilisateur connecte.
 */
public final class SwingMainMenuView extends JPanel implements MenuView {

    private static final Color COLOR_DEFAULT = new Color(70, 70, 70);
    private static final Color COLOR_ERROR = new Color(160, 0, 0);

    private final JLabel userLabel = new JLabel("Utilisateur : ");
    private final JButton categoriesButton = new JButton("Etageres");
    private final JButton roomsButton = new JButton("Rejoindre une partie");
    private final JButton optionsButton = new JButton("Options");
    private final JButton logoutButton = new JButton("D\u00E9connexion");
    private final DefaultListModel<String> listModel = new DefaultListModel<>();
    private final JList<String> resultList = new JList<>(listModel);
    private final JLabel statusLabel = new JLabel(" ", SwingConstants.LEFT);

    private MenuListener listener;
    private Runnable focusForwardAction = this::focusNextComponent;
    private Runnable focusBackwardAction = this::focusPreviousComponent;
    private JComponent lastFocusedComponent;
    private MenuState state = MenuState.ROOT;

    private enum MenuState {
        ROOT,
        CATEGORIES,
        ROOMS,
        OPTIONS
    }

    public SwingMainMenuView() {
        super(new BorderLayout());
        initComponents();
    }

    private void initComponents() {
        setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));

        JPanel headerPanel = new JPanel();
        headerPanel.setLayout(new BoxLayout(headerPanel, BoxLayout.Y_AXIS));
        headerPanel.setBorder(BorderFactory.createEmptyBorder(0, 0, 0, 16));
        headerPanel.setOpaque(false);

        userLabel.setFont(userLabel.getFont().deriveFont(Font.BOLD, 14f));
        userLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        JPanel userPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        userPanel.setOpaque(false);
        userPanel.add(userLabel);
        userPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        headerPanel.add(userPanel);
        headerPanel.add(Box.createVerticalStrut(12));

        JPanel buttonPanel = new JPanel(new GridLayout(0, 1, 0, 8));
        buttonPanel.setOpaque(false);
        buttonPanel.add(categoriesButton);
        buttonPanel.add(roomsButton);
        buttonPanel.add(optionsButton);
        buttonPanel.add(logoutButton);
        buttonPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        headerPanel.add(buttonPanel);

        add(headerPanel, BorderLayout.WEST);

        resultList.setVisibleRowCount(10);
        resultList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        add(new JScrollPane(resultList), BorderLayout.CENTER);
        configureListNavigation();

        statusLabel.setForeground(COLOR_DEFAULT);
        add(statusLabel, BorderLayout.SOUTH);

        categoriesButton.addActionListener(e -> {
            if (listener != null) listener.onShowCategoriesRequested();
        });
        roomsButton.addActionListener(e -> {
            if (listener != null) listener.onShowRoomsRequested();
        });
        optionsButton.addActionListener(e -> {
            if (listener != null) listener.onShowOptionsRequested();
        });
 logoutButton.addActionListener(e -> {
    if (listener == null) {
        return;
    }
    boolean confirmed = ConfirmationDialog.show(
            SwingMainMenuView.this,
            "Déconnexion",
            "Voulez-vous vraiment vous déconnecter ?",
            "Se déconnecter",
            "Annuler"
    );
    if (confirmed) {
        listener.onLogoutRequested();
    }
});


        configureButtonNavigation(categoriesButton);
        configureButtonNavigation(roomsButton);
        configureButtonNavigation(optionsButton);
        configureButtonNavigation(logoutButton);
        registerFocusTracker(categoriesButton);
        registerFocusTracker(roomsButton);
        registerFocusTracker(optionsButton);
        registerFocusTracker(logoutButton);
        registerFocusTracker(resultList);
        registerGlobalEscape();

        lastFocusedComponent = categoriesButton;
    }

    @Override
    public void setMenuListener(MenuListener listener) {
        this.listener = listener;
    }

    @Override
    public void setUsername(String username) {
        SwingUtilities.invokeLater(() -> userLabel.setText("Utilisateur : " + Objects.requireNonNullElse(username, "?")));
    }

    @Override
    public void setBusy(boolean busy) {
        SwingUtilities.invokeLater(() -> {
            categoriesButton.setEnabled(!busy);
            roomsButton.setEnabled(!busy);
            optionsButton.setEnabled(!busy);
            logoutButton.setEnabled(!busy);
            statusLabel.setForeground(COLOR_DEFAULT);
            statusLabel.setText(busy ? "Chargement en cours..." : " ");
        });
    }

    @Override
    public void showCategories(List<CategorySummary> categories) {
        SwingUtilities.invokeLater(() -> {
            listModel.clear();
            if (categories == null || categories.isEmpty()) {
                listModel.addElement("Aucune categorie disponible.");
            } else {
                for (CategorySummary category : categories) {
                    listModel.addElement(category.name());
                }
            }
            statusLabel.setForeground(COLOR_DEFAULT);
            statusLabel.setText("Categories de jeux");
            state = MenuState.CATEGORIES;
        });
    }

    @Override
    public void showRooms(List<RoomSummary> rooms) {
        SwingUtilities.invokeLater(() -> {
            listModel.clear();
            if (rooms == null || rooms.isEmpty()) {
                listModel.addElement("Aucune partie en cours.");
            } else {
                for (RoomSummary room : rooms) {
                    listModel.addElement(String.format("#%d %s - %d/%d joueurs (%s)%s",
                            room.id(),
                            room.name(),
                            room.players(),
                            room.maxPlayers(),
                            room.status(),
                            room.isPrivate() ? " [privee]" : ""));
                }
            }
            statusLabel.setForeground(COLOR_DEFAULT);
            statusLabel.setText("Parties disponibles");
            state = MenuState.ROOMS;
        });
    }

    @Override
    public void showOptions() {
        SwingUtilities.invokeLater(() -> {
            listModel.clear();
            listModel.addElement("Parametres disponibles :");
            listModel.addElement(" - Modifier l'adresse du serveur");
            listModel.addElement(" - Choisir la langue de l'interface (a venir)");
            listModel.addElement(" - Gerer les notifications (a venir)");
            statusLabel.setForeground(COLOR_DEFAULT);
            statusLabel.setText("Options de l'application");
            state = MenuState.OPTIONS;
        });
    }

    @Override
    public void showMessage(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setForeground(COLOR_DEFAULT);
            statusLabel.setText(Objects.requireNonNullElse(message, " "));
        });
    }

    @Override
    public void showError(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setForeground(COLOR_ERROR);
            statusLabel.setText(Objects.requireNonNullElse(message, "Erreur inconnue"));
        });
    }

    @Override
    public void reset() {
        SwingUtilities.invokeLater(() -> {
            listModel.clear();
            listModel.addElement("Etageres - consulter les categories de jeux.");
            listModel.addElement("Rejoindre une partie - voir les rooms actives.");
            listModel.addElement("Options - ajuster les param\u00E8tres.");
            statusLabel.setForeground(COLOR_DEFAULT);
            statusLabel.setText("Menu principal");
            state = MenuState.ROOT;
            lastFocusedComponent = categoriesButton;
        });
    }

    @Override
    public void requestMenuFocus() {
        SwingUtilities.invokeLater(() -> {
            if (lastFocusedComponent != null
                    && lastFocusedComponent.isShowing()
                    && lastFocusedComponent.isEnabled()
                    && lastFocusedComponent.isFocusable()
                    && lastFocusedComponent.requestFocusInWindow()) {
                return;
            }
            for (JButton button : menuButtons()) {
                if (button.isEnabled() && button.requestFocusInWindow()) {
                    lastFocusedComponent = button;
                    return;
                }
            }
            if (resultList.isShowing() && resultList.isFocusable()) {
                resultList.requestFocusInWindow();
                lastFocusedComponent = resultList;
            }
        });
    }

    public void setFocusBridge(Runnable forwardAction, Runnable backwardAction) {
        this.focusForwardAction = forwardAction != null ? forwardAction : this::focusNextComponent;
        this.focusBackwardAction = backwardAction != null ? backwardAction : this::focusPreviousComponent;
    }

    private void configureButtonNavigation(JButton button) {
        button.setFocusTraversalKeys(KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS, Collections.emptySet());
        button.setFocusTraversalKeys(KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS, Collections.emptySet());

        InputMap inputMap = button.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actionMap = button.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_DOWN, 0), "navigateDown");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_UP, 0), "navigateUp");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0), "skipForward");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, KeyEvent.SHIFT_DOWN_MASK), "skipBackward");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ENTER, 0), "menuActivate");
        inputMap.put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
        inputMap.put(KeyStroke.getKeyStroke("released SPACE"), "none");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "menuEscape");

        actionMap.put("navigateDown", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusButtonRelative(button, 1);
            }
        });
        actionMap.put("navigateUp", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusButtonRelative(button, -1);
            }
        });
        actionMap.put("skipForward", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusForwardAction.run();
            }
        });
        actionMap.put("skipBackward", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusBackwardAction.run();
            }
        });
        actionMap.put("menuActivate", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                if (button.isEnabled()) {
                    button.doClick();
                }
            }
        });
        actionMap.put("none", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                // ignore space key
            }
        });
        actionMap.put("menuEscape", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                handleEscapeRequest();
            }
        });
    }

    private void configureListNavigation() {
        resultList.setFocusTraversalKeys(KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS, Collections.emptySet());
        resultList.setFocusTraversalKeys(KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS, Collections.emptySet());

        InputMap inputMap = resultList.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actionMap = resultList.getActionMap();

        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0), "skipForward");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_TAB, KeyEvent.SHIFT_DOWN_MASK), "skipBackward");
        inputMap.put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
        inputMap.put(KeyStroke.getKeyStroke("released SPACE"), "none");
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "menuEscape");

        actionMap.put("skipForward", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusForwardAction.run();
            }
        });
        actionMap.put("skipBackward", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                focusBackwardAction.run();
            }
        });
        actionMap.put("menuEscape", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                handleEscapeRequest();
            }
        });
        actionMap.put("none", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                // ignore space key
            }
        });
    }

    private void registerFocusTracker(JComponent component) {
        component.addFocusListener(new java.awt.event.FocusAdapter() {
            @Override
            public void focusGained(java.awt.event.FocusEvent e) {
                lastFocusedComponent = component;
            }
        });
    }

    private void registerGlobalEscape() {
        KeyStroke escapeKey = KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0);

        registerKeyboardAction(
                e -> handleEscapeRequest(),
                escapeKey,
                JComponent.WHEN_IN_FOCUSED_WINDOW
        );

        InputMap focusedMap = getInputMap(JComponent.WHEN_FOCUSED);
        InputMap ancestorMap = getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        ActionMap actionMap = getActionMap();
        focusedMap.put(escapeKey, "menuEscapeGlobal");
        ancestorMap.put(escapeKey, "menuEscapeGlobal");
        actionMap.put("menuEscapeGlobal", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                handleEscapeRequest();
            }
        });
    }

    private JButton[] menuButtons() {
        return new JButton[]{categoriesButton, roomsButton, optionsButton, logoutButton};
    }

    private void focusButtonRelative(JButton current, int offset) {
        JButton[] buttons = menuButtons();
        for (int i = 0; i < buttons.length; i++) {
            if (buttons[i] == current) {
                int targetIndex = i + offset;
                if (targetIndex >= 0 && targetIndex < buttons.length) {
                    JButton target = buttons[targetIndex];
                    if (target.isEnabled()) {
                        target.requestFocusInWindow();
                    }
                }
                break;
            }
        }
    }

    private void focusNextComponent() {
        KeyboardFocusManager.getCurrentKeyboardFocusManager()
                .focusNextComponent(SwingMainMenuView.this);
    }

    private void focusPreviousComponent() {
        KeyboardFocusManager.getCurrentKeyboardFocusManager()
                .focusPreviousComponent(SwingMainMenuView.this);
    }

    private void handleEscapeRequest() {
        if (listener == null) {
            return;
        }
        if (state != MenuState.ROOT) {
            listener.onReturnToMainMenuRequested();
        }
    }
}
