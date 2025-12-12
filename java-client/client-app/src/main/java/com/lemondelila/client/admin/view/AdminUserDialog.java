package com.lemondelila.client.admin.view;

import com.lemondelila.client.admin.dto.AdminUser;
import com.lemondelila.client.admin.dto.AdminUserCreateRequest;
import com.lemondelila.client.admin.dto.AdminUserUpdateRequest;
import com.lemondelila.client.admin.dto.AdminUserPage;
import com.lemondelila.client.admin.dto.AdminBanRequest;
import com.lemondelila.client.admin.service.AdminUserService;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTable;
import javax.swing.JTextField;
import javax.swing.JPasswordField;
import javax.swing.JOptionPane;
import javax.swing.KeyStroke;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.table.DefaultTableModel;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.FocusTraversalPolicy;
import java.awt.Container;
import java.awt.event.ActionEvent;
import java.awt.event.FocusAdapter;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.Window;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

public final class AdminUserDialog extends JDialog {

    private static final int PAGE_SIZE = 50;

    private final AdminUserService service;
    private final DialogService dialogService;
    private final Window ownerWindow;

    // Navigation menu (flèches + Entrée)
    private final JList<String> navigationList = new JList<>(new String[]{
            "Modifier un utilisateur",
            "Bannir un utilisateur",
            "Créer un utilisateur",
            "Fermer"
    });

    // Panneaux et composants dynamiques
    private final CardLayout cardLayout = new CardLayout();
    private final JPanel contentPanel = new JPanel(cardLayout);

    private final DefaultTableModel tableModel = new DefaultTableModel(
            new Object[]{"ID", "Utilisateur", "Email", "Rôles", "Vérifié", "Banni jusqu'au", "Motif ban", "Créé le"},
            0
    ) {
        @Override
        public boolean isCellEditable(int row, int column) {
            return false;
        }
    };
    private final JTable table = new JTable(tableModel);
    private final JScrollPane tableScrollPane = new JScrollPane(table);
    private JPanel resetTableHolder;
    private JPanel editTableHolder;
    private JPanel banTableHolder;

    private final JTextField resetSearchField = new JTextField();
    private final JLabel resetSearchLabel = new JLabel("Rechercher un utilisateur (email ou identifiant) :");
    private final JButton resetButton = new JButton("Réinitialiser MDP");
    private final JButton editButton = new JButton("Modifier l'utilisateur");
    private final JButton focusTableButton = new JButton("Aller au tableau");
    private final JLabel banReasonLabel = new JLabel("Motif");
    private final JTextField banReasonField = new JTextField();
    private final JLabel banDurationLabel = new JLabel("Durée (jours)");
    private final JTextField banDurationDaysField = new JTextField("7");
    private final JLabel banUntilLabel = new JLabel("Jusqu'au (jj/mm/aaaa)");
    private final JTextField banUntilField = new JTextField("jj/mm/aaaa");
    private final JButton banButton = new JButton("Bannir");
    private final JButton unbanButton = new JButton("Débannir");
    private JPanel banFormPanel;

    private static final List<RoleOption> AVAILABLE_ROLES = List.of(
            new RoleOption("ROLE_USER", "Utilisateur"),
            new RoleOption("ROLE_ADMIN", "Administrateur")
    );
    private final JTextField emailField = new JTextField();
    private final JLabel emailLabel = new JLabel("Email");
    private final JTextField usernameField = new JTextField();
    private final JLabel usernameLabel = new JLabel("Nom d'utilisateur");
    private final JPasswordField passwordField = new JPasswordField();
    private final JLabel passwordLabel = new JLabel("Mot de passe (optionnel)");
    private final List<JCheckBox> createRoleCheckboxes = buildRoleCheckboxes();
    private final JLabel rolesLabel = new JLabel("Rôle");
    private final JCheckBox emailVerified = new JCheckBox("Email vérifié", true);
    private final JButton createButton = new JButton("Créer l'utilisateur");

    // Edition inline
    private final JTextField editEmailField = new JTextField();
    private final JTextField editUsernameField = new JTextField();
    private final JPasswordField editPasswordField = new JPasswordField();
    private final List<JCheckBox> editRoleCheckboxes = buildRoleCheckboxes();
    private final JCheckBox editEmailVerified = new JCheckBox("Email vérifié", true);
    private final JButton deleteButton = new JButton("Supprimer l'utilisateur");
    private final JButton saveEditButton = new JButton("Enregistrer les modifications");

    private final JLabel statusLabel = new JLabel("Choisissez une option avec les flèches, Entrée pour valider.");
    private String currentCard = "empty";

    public AdminUserDialog(Window owner, AdminUserService service, DialogService dialogService) {
        super(owner, "Administration - Utilisateurs", ModalityType.MODELESS);
        this.service = Objects.requireNonNull(service, "service");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.ownerWindow = owner;

        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        table.setFocusTraversalKeysEnabled(false);
        setLayout(new BorderLayout());
        add(buildNavigationPanel(), BorderLayout.WEST);
        add(buildContent(), BorderLayout.CENTER);
        setPreferredSize(new Dimension(980, 680));
        pack();
        setLocationRelativeTo(owner);
        registerActions();
        registerShortcuts();
        applyAccessibility();
        enforceSingleRoleSelection(createRoleCheckboxes);
        enforceSingleRoleSelection(editRoleCheckboxes);
        SwingUtilities.invokeLater(() -> navigationList.requestFocusInWindow());
    }

    private Component buildNavigationPanel() {
        navigationList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        navigationList.setFocusTraversalKeysEnabled(true);
        navigationList.setSelectedIndex(0);
        navigationList.addListSelectionListener(e -> {
            if (e.getValueIsAdjusting()) {
                return;
            }
            String value = navigationList.getSelectedValue();
            if (value == null) {
                return;
            }
            setStatus("Option : " + value);
        });
        navigationList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() == 1) {
                    String value = navigationList.getSelectedValue();
                    if (value != null) {
                        openSelection(value, true, true);
                    }
                }
            }
        });

        JPanel navPanel = new JPanel(new BorderLayout());
        navPanel.setBorder(BorderFactory.createTitledBorder("Menu admin"));
        navPanel.add(new JScrollPane(navigationList), BorderLayout.CENTER);
        navPanel.setPreferredSize(new Dimension(220, 600));
        return navPanel;
    }

    private Component buildContent() {
        contentPanel.add(buildEmptyPanel(), "empty");
        contentPanel.add(buildResetPanel(), "reset");
        contentPanel.add(buildCreatePanel(), "create");
        contentPanel.add(buildEditPanel(), "edit");
        contentPanel.add(buildBanPanel(), "ban");
        contentPanel.setFocusCycleRoot(true);
        contentPanel.setFocusTraversalPolicyProvider(true);

        JPanel wrapper = new JPanel(new BorderLayout());
        wrapper.add(contentPanel, BorderLayout.CENTER);
        wrapper.add(buildStatusPanel(), BorderLayout.SOUTH);
        return wrapper;
    }

    private Component buildEmptyPanel() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(BorderFactory.createEmptyBorder(24, 24, 24, 24));
        JLabel label = new JLabel("Flèches pour naviguer dans le menu de gauche, Entrée pour choisir une action.");
        label.setAlignmentX(Component.LEFT_ALIGNMENT);
        panel.add(label);
        return panel;
    }

    private Component buildResetPanel() {
        JPanel panel = new JPanel();
        panel.setLayout(new BorderLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        JPanel top = new JPanel();
        top.setLayout(new BoxLayout(top, BoxLayout.Y_AXIS));
        resetSearchLabel.setLabelFor(resetSearchField);
        top.add(resetSearchLabel);
        top.add(Box.createRigidArea(new Dimension(0, 4)));
        resetSearchField.setMaximumSize(new Dimension(320, 28));
        top.add(resetSearchField);
        top.add(Box.createRigidArea(new Dimension(0, 8)));
        JButton resetSearchButton = new JButton("Rechercher et afficher");
        resetSearchButton.addActionListener(e -> loadUsers(resetSearchField.getText(), true));
        top.add(resetSearchButton);
        top.add(Box.createRigidArea(new Dimension(0, 8)));
        top.add(new JLabel("Sélectionnez un utilisateur dans la liste, puis activez \"Réinitialiser MDP\"."));
        panel.add(top, BorderLayout.NORTH);

        resetTableHolder = new JPanel(new BorderLayout());
        panel.add(resetTableHolder, BorderLayout.CENTER);

        JPanel bottom = new JPanel();
        bottom.setLayout(new BoxLayout(bottom, BoxLayout.X_AXIS));
        resetButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        editButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        bottom.add(resetButton);
        bottom.add(Box.createRigidArea(new Dimension(8, 0)));
        bottom.add(editButton);
        bottom.add(Box.createHorizontalGlue());
        panel.add(bottom, BorderLayout.SOUTH);

        // Entrée dans le champ lance la recherche
        resetSearchField.addActionListener(e -> loadUsers(resetSearchField.getText(), true));

        // Entrée sur le bouton déclenche aussi la réinitialisation
        resetButton.addActionListener(e -> resetPassword());
        resetButton.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.reset.enter");
        resetButton.getActionMap().put("admin.reset.enter", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                resetPassword();
            }
        });
        resetButton.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("shift TAB"), "admin.reset.back");
        resetButton.getActionMap().put("admin.reset.back", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusTable();
            }
        });

        // Entrée sur le bouton éditer : pré-remplir le formulaire de modification avec l'utilisateur sélectionné
        editButton.addActionListener(e -> applyUserEdit());

        return panel;
    }

    private Component buildCreatePanel() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        panel.add(new JLabel("Créer un utilisateur :"));
        panel.add(Box.createRigidArea(new Dimension(0, 8)));
        panel.add(buildLabeledField(emailLabel, emailField));
        panel.add(buildLabeledField(usernameLabel, usernameField));
        panel.add(buildLabeledField(passwordLabel, passwordField));
        panel.add(buildLabeledField(rolesLabel, buildRolesPanel(createRoleCheckboxes)));
        emailVerified.setAlignmentX(Component.LEFT_ALIGNMENT);
        panel.add(emailVerified);
        panel.add(Box.createRigidArea(new Dimension(0, 8)));
        createButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        panel.add(createButton);
        panel.setFocusCycleRoot(true);
        List<Component> createOrder = new ArrayList<>();
        createOrder.add(emailField);
        createOrder.add(usernameField);
        createOrder.add(passwordField);
        createOrder.addAll(createRoleCheckboxes);
        createOrder.add(emailVerified);
        createOrder.add(createButton);
        panel.setFocusTraversalPolicy(new OrderedFocusTraversalPolicy(createOrder));
        return panel;
    }

    private Component buildEditPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        editTableHolder = new JPanel(new BorderLayout());
        panel.add(editTableHolder, BorderLayout.CENTER);

        JPanel form = new JPanel();
        form.setLayout(new BoxLayout(form, BoxLayout.Y_AXIS));
        form.setBorder(BorderFactory.createEmptyBorder(0, 12, 0, 0));
        form.add(new JLabel("Modifier l'utilisateur sélectionné :"));
        form.add(Box.createRigidArea(new Dimension(0, 8)));
        form.add(buildLabeledField(new JLabel("Email"), editEmailField));
        form.add(buildLabeledField(new JLabel("Nom d'utilisateur"), editUsernameField));
        form.add(buildLabeledField(new JLabel("Mot de passe (laisser vide pour conserver)"), editPasswordField));
        form.add(buildLabeledField(new JLabel("Rôle"), buildRolesPanel(editRoleCheckboxes)));
        editEmailVerified.setAlignmentX(Component.LEFT_ALIGNMENT);
        form.add(editEmailVerified);
        form.add(Box.createRigidArea(new Dimension(0, 8)));
        JPanel actions = new JPanel();
        actions.setLayout(new BoxLayout(actions, BoxLayout.X_AXIS));
        focusTableButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        actions.add(focusTableButton);
        actions.add(Box.createRigidArea(new Dimension(8, 0)));
        resetButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        actions.add(resetButton);
        actions.add(Box.createRigidArea(new Dimension(8, 0)));
        deleteButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        actions.add(deleteButton);
        actions.add(Box.createRigidArea(new Dimension(8, 0)));
        saveEditButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        actions.add(saveEditButton);
        actions.setAlignmentX(Component.LEFT_ALIGNMENT);
        form.add(actions);

        panel.add(form, BorderLayout.EAST);
        panel.setFocusCycleRoot(true);
        panel.setFocusTraversalPolicyProvider(true);
        List<Component> editOrder = new ArrayList<>();
        editOrder.add(editEmailField);
        editOrder.add(editUsernameField);
        editOrder.add(editPasswordField);
        editOrder.addAll(editRoleCheckboxes);
        editOrder.add(editEmailVerified);
        editOrder.add(focusTableButton);
        editOrder.add(resetButton);
        editOrder.add(deleteButton);
        editOrder.add(saveEditButton);
        editOrder.add(table);
        panel.setFocusTraversalPolicy(new OrderedFocusTraversalPolicy(editOrder));

        // Sélection de table -> remplir le formulaire
        table.getSelectionModel().addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting() && "edit".equals(currentCard)) {
                fillEditFormFromSelection();
                scrollFirstColumnIntoView(table.getSelectedRow());
            }
        });

        // Tab/Enter : Entrée sur la table préremplit et focus sur email, Tab passe au formulaire
        table.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.edit.fill");
        table.getActionMap().put("admin.edit.fill", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                fillEditFormFromSelection();
                editEmailField.requestFocusInWindow();
            }
        });
        table.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("TAB"), "admin.edit.tab");
        table.getActionMap().put("admin.edit.tab", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                fillEditFormFromSelection();
                editEmailField.requestFocusInWindow();
            }
        });
        table.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("shift TAB"), "admin.edit.shift-tab");
        table.getActionMap().put("admin.edit.shift-tab", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                saveEditButton.requestFocusInWindow();
            }
        });
        forceShiftTabToSave(editEmailField);
        focusTableButton.addActionListener(e -> focusTable());
        focusTableButton.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.edit.focus-table");
        focusTableButton.getActionMap().put("admin.edit.focus-table", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusTable();
            }
        });
        saveEditButton.addActionListener(e -> saveEdit());
        saveEditButton.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.edit.save");
        saveEditButton.getActionMap().put("admin.edit.save", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                saveEdit();
            }
        });
        deleteButton.addActionListener(e -> deleteUser());
        deleteButton.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.edit.delete");
        deleteButton.getActionMap().put("admin.edit.delete", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                deleteUser();
            }
        });
        return panel;
    }

    private Component buildBanPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        banTableHolder = new JPanel(new BorderLayout());
        panel.add(banTableHolder, BorderLayout.CENTER);

        JPanel form = new JPanel();
        form.setLayout(new BoxLayout(form, BoxLayout.Y_AXIS));
        form.setBorder(BorderFactory.createEmptyBorder(0, 12, 0, 0));
        form.add(new JLabel("Bannir l'utilisateur sélectionné :"));
        form.add(Box.createRigidArea(new Dimension(0, 8)));

        banFormPanel = new JPanel();
        banFormPanel.setLayout(new BoxLayout(banFormPanel, BoxLayout.Y_AXIS));
        banFormPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        banFormPanel.add(buildLabeledField(banReasonLabel, banReasonField));
        banFormPanel.add(buildLabeledField(banDurationLabel, banDurationDaysField));
        banFormPanel.add(buildLabeledField(banUntilLabel, banUntilField));
        banFormPanel.add(Box.createRigidArea(new Dimension(0, 8)));
        form.add(banFormPanel);

        banButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        unbanButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        JPanel banActions = new JPanel();
        banActions.setLayout(new BoxLayout(banActions, BoxLayout.X_AXIS));
        banActions.setAlignmentX(Component.LEFT_ALIGNMENT);
        banActions.add(banButton);
        banActions.add(Box.createRigidArea(new Dimension(8, 0)));
        banActions.add(unbanButton);
        form.add(banActions);

        panel.add(form, BorderLayout.EAST);
        panel.setFocusCycleRoot(true);
        panel.setFocusTraversalPolicyProvider(true);
        List<Component> order = new ArrayList<>();
        order.add(table);
        order.add(banReasonField);
        order.add(banDurationDaysField);
        order.add(banUntilField);
        order.add(banButton);
        order.add(unbanButton);
        panel.setFocusTraversalPolicy(new OrderedFocusTraversalPolicy(order));

        table.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("TAB"), "admin.ban.tab");
        table.getActionMap().put("admin.ban.tab", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusBanFormFromSelection();
            }
        });
        table.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.ban.enter");
        table.getActionMap().put("admin.ban.enter", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusBanFormFromSelection();
            }
        });
        table.getSelectionModel().addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting() && "ban".equals(currentCard)) {
                updateBanFormVisibility();
            }
        });
        banButton.addActionListener(e -> applyBan());
        banButton.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.ban.apply");
        banButton.getActionMap().put("admin.ban.apply", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                applyBan();
            }
        });
        unbanButton.addActionListener(e -> applyUnban());
        unbanButton.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "admin.ban.unban");
        unbanButton.getActionMap().put("admin.ban.unban", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                applyUnban();
            }
        });
        return panel;
    }

    private Component buildStatusPanel() {
        JPanel statusPanel = new JPanel();
        statusPanel.setLayout(new BoxLayout(statusPanel, BoxLayout.X_AXIS));
        statusPanel.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        statusPanel.add(statusLabel);
        statusPanel.add(Box.createHorizontalGlue());
        JButton close = new JButton("Fermer");
        close.addActionListener(e -> dispose());
        statusPanel.add(close);
        return statusPanel;
    }

    private Component buildLabeledField(JLabel label, JComponent field) {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.X_AXIS));
        label.setPreferredSize(new Dimension(180, 24));
        label.setLabelFor(field);
        panel.add(label);
        field.setMaximumSize(new Dimension(360, 28));
        panel.add(field);
        panel.add(Box.createHorizontalGlue());
        return panel;
    }

    private List<JCheckBox> buildRoleCheckboxes() {
        List<JCheckBox> boxes = new ArrayList<>();
        for (RoleOption role : AVAILABLE_ROLES) {
            JCheckBox cb = new JCheckBox(role.label());
            cb.setActionCommand(role.id());
            cb.putClientProperty("roleId", role.id());
            cb.setSelected("ROLE_USER".equalsIgnoreCase(role.id()));
            boxes.add(cb);
        }
        return boxes;
    }

    private JComponent buildRolesPanel(List<JCheckBox> boxes) {
        JPanel rolesPanel = new JPanel();
        rolesPanel.setLayout(new BoxLayout(rolesPanel, BoxLayout.Y_AXIS));
        for (JCheckBox cb : boxes) {
            cb.setAlignmentX(Component.LEFT_ALIGNMENT);
            rolesPanel.add(cb);
        }
        rolesPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        return rolesPanel;
    }

    private void enforceSingleRoleSelection(List<JCheckBox> boxes) {
        for (JCheckBox box : boxes) {
            box.addActionListener(e -> {
                if (box.isSelected()) {
                    for (JCheckBox other : boxes) {
                        if (other != box) {
                            other.setSelected(false);
                        }
                    }
                } else if (boxes.stream().noneMatch(JCheckBox::isSelected)) {
                    box.setSelected(true);
                }
            });
        }
    }

    // ========================
    // Actions et navigation
    // ========================

    private void registerActions() {
        resetButton.addActionListener(e -> resetPassword());
        createButton.addActionListener(e -> createUser());
        editButton.addActionListener(e -> applyUserEdit());

        registerNavigationActions();
        navigationList.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(java.awt.event.FocusEvent e) {
                getRootPane().setDefaultButton(null);
                if (navigationList.getSelectedIndex() < 0) {
                    navigationList.setSelectedIndex(0);
                }
            }
        });
    }

    private void registerNavigationActions() {
        AbstractAction openSelected = new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                activateSelectedMenu();
            }
        };
        navigationList.getInputMap(JComponent.WHEN_FOCUSED)
                .put(KeyStroke.getKeyStroke("ENTER"), "admin.menu.enter");
        navigationList.getActionMap().put("admin.menu.enter", openSelected);
        navigationList.getInputMap(JComponent.WHEN_FOCUSED)
                .put(KeyStroke.getKeyStroke("SPACE"), "admin.menu.space");
        navigationList.getActionMap().put("admin.menu.space", openSelected);
    }

    private void openSelection(String selection, boolean focusTable, boolean allowClose) {
        if (selection == null) {
            return;
        }
        switch (selection) {
            case "Modifier un utilisateur" -> {
                boolean changed = !"edit".equals(currentCard);
                attachTableTo(editTableHolder);
                showCard("edit");
                getRootPane().setDefaultButton(saveEditButton);
                if (changed || focusTable) {
                    loadUsers(null, true);
                } else {
                    focusTable();
                }
            }
            case "Bannir un utilisateur" -> {
                boolean changed = !"ban".equals(currentCard);
                attachTableTo(banTableHolder);
                showCard("ban");
                getRootPane().setDefaultButton(banButton);
                if (changed || focusTable) {
                    loadUsers(null, true);
                } else {
                    focusTable();
                }
                updateBanFormVisibility();
            }
            case "Créer un utilisateur" -> {
                showCard("create");
                emailField.requestFocusInWindow();
            }
            case "Fermer" -> {
                if (allowClose) {
                    dispose();
                }
            }
            default -> showCard("empty");
        }
    }

    private void activateSelectedMenu() {
        String value = navigationList.getSelectedValue();
        if (value == null) {
            setStatus("Choisissez une option avec les flèches, Entrée pour valider.");
            return;
        }
        openSelection(value, true, true);
    }

    private void registerShortcuts() {
        getRootPane().getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW)
                .put(KeyStroke.getKeyStroke("ESCAPE"), "admin.back");
        getRootPane().getActionMap().put("admin.back", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (!"empty".equals(currentCard)) {
                    showCard("empty");
                    navigationList.requestFocusInWindow();
                    setStatus("Choisissez une option avec les flèches, Entrée pour valider.");
                } else {
                    dispose();
                }
            }
        });

        getRootPane().getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW)
                .put(KeyStroke.getKeyStroke("control R"), "admin.refresh");
        getRootPane().getActionMap().put("admin.refresh", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                loadUsers(null, true);
            }
        });
    }

    // ========================
    // Données
    // ========================

    private void loadUsers(String search, boolean focusTable) {
        setStatus("Chargement en cours...");
        CompletableFuture<AdminUserPage> future = service.listUsers(
                1,
                PAGE_SIZE,
                search,
                null
        );
        future.whenComplete((page, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        dialogService.error("Administration", error.getMessage());
                        setStatus("Erreur de chargement.");
                        return;
                    }
                    renderUsers(page);
                    if (focusTable) {
                        focusTable();
                    }
                    setStatus("Utilisateurs chargés (" + page.total() + " au total).");
                }));
    }

    private void renderUsers(AdminUserPage page) {
        tableModel.setRowCount(0);
        if (page == null || page.items() == null) {
            return;
        }
        for (AdminUser user : page.items()) {
            String roles = Optional.ofNullable(user.roles())
                    .orElseGet(List::of)
                    .stream()
                    .collect(Collectors.joining(", "));
            String createdAt = Optional.ofNullable(user.createdAt()).orElse("");
            String bannedUntil = Optional.ofNullable(user.bannedUntil()).orElse("");
            String banReason = Optional.ofNullable(user.banReason()).orElse("");
            tableModel.addRow(new Object[]{
                    user.id(),
                    user.username(),
                    user.email(),
                    roles,
                    user.emailVerified() ? "Oui" : "Non",
                    bannedUntil,
                    banReason,
                    createdAt
            });
        }
        fillEditFormFromSelection();
    }

    private void resetPassword() {
        int row = table.getSelectedRow();
        if (row < 0) {
            dialogService.info("Administration", "Sélectionnez un utilisateur avant de réinitialiser son mot de passe.");
            return;
        }
        int userId = (int) tableModel.getValueAt(row, 0);
        setStatus("Réinitialisation du mot de passe...");
        service.resetPassword(userId)
                .whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        dialogService.error("Administration", error.getMessage());
                        setStatus("Échec de la réinitialisation.");
                        return;
                    }
                    String tempPwd = Optional.ofNullable(result.temporaryPassword()).orElse("");
                    setStatus("Mot de passe réinitialisé pour l'utilisateur #" + userId);
                    showTempPassword(tempPwd);
                }));
    }

    private void createUser() {
        String email = emailField.getText().trim();
        String username = usernameField.getText().trim();
        String password = new String(passwordField.getPassword()).trim();
        List<String> roles = getSelectedRoles();

        if (email.isBlank() || username.isBlank()) {
            dialogService.error("Création", "Email et nom d'utilisateur sont requis.");
            return;
        }

        AdminUserCreateRequest request = new AdminUserCreateRequest(
                email,
                username,
                password.isBlank() ? null : password,
                roles,
                emailVerified.isSelected()
        );
        setStatus("Création de l'utilisateur...");
        service.createUser(request)
                .whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        dialogService.error("Création", error.getMessage());
                        setStatus("Échec de la création.");
                        return;
                    }
                    StringBuilder message = new StringBuilder("Utilisateur créé : ").append(result.user().username());
                    if (result.temporaryPassword() != null && !result.temporaryPassword().isBlank()) {
                        message.append("\nMot de passe temporaire : ").append(result.temporaryPassword());
                    }
                    dialogService.info("Administration", message.toString());
                    clearCreateForm();
                    loadUsers(null, false);
                }));
    }

    private List<String> getSelectedRoles() {
        return getSelectedRoles(createRoleCheckboxes);
    }

    private void clearCreateForm() {
        emailField.setText("");
        usernameField.setText("");
        passwordField.setText("");
        setSelectedRoles(createRoleCheckboxes, List.of("ROLE_USER"));
        emailVerified.setSelected(true);
    }

    // ========================
    // Accessibilité
    // ========================

    private void applyAccessibility() {
        setAccessible(navigationList, "Menu admin", "Flèches ou tabulation pour naviguer, Entrée pour choisir : rechercher, réinitialiser mot de passe, créer, fermer.");
        setAccessible(table, "Table utilisateurs", "Tableau des utilisateurs. Sélectionnez une ligne et appuyez sur Entrée ou utilisez le bouton Réinitialiser.");
        setAccessible(statusLabel, "Statut", "Indications en cours pour l'administration.");

        // Recherche globale retirée
        setAccessible(resetButton, "Réinitialiser le mot de passe", "Réinitialiser le mot de passe de la ligne sélectionnée.");
        setAccessible(resetSearchField, "Champ recherche réinitialisation", "Saisissez un email ou identifiant pour filtrer avant de sélectionner un utilisateur.");
        setAccessible(resetSearchLabel, "Libellé recherche réinitialisation", "Rechercher un utilisateur pour réinitialiser son mot de passe.");

        setAccessible(emailField, "Email", "Email de l'utilisateur à créer.");
        setAccessible(usernameField, "Nom d'utilisateur", "Nom d'utilisateur à créer.");
        setAccessible(passwordField, "Mot de passe", "Mot de passe initial (laisser vide pour générer). Champ masqué.");
        createRoleCheckboxes.forEach(cb -> setAccessible(cb, cb.getText(), "Choisissez le rôle pour le nouvel utilisateur."));
        editRoleCheckboxes.forEach(cb -> setAccessible(cb, cb.getText(), "Choisissez le rôle de l'utilisateur sélectionné."));
        setAccessible(emailVerified, "Email vérifié", "Indique si l'email est vérifié.");
        setAccessible(focusTableButton, "Aller au tableau", "Revenir au tableau des utilisateurs pour changer la sélection.");
        setAccessible(createButton, "Créer l'utilisateur", "Créer l'utilisateur.");
        setAccessible(banReasonField, "Motif du ban", "Saisissez la raison du bannissement.");
        setAccessible(banDurationDaysField, "Durée du ban (jours)", "Indiquez le nombre de jours de bannissement.");
        setAccessible(banUntilField, "Date de fin de ban", "Saisissez une date au format jj/mm/aaaa pour la fin du ban (optionnel).");
        setAccessible(banButton, "Bannir", "Confirmer le bannissement de l'utilisateur sélectionné.");
    }

    private void setAccessible(JComponent component, String name, String description) {
        if (component.getAccessibleContext() != null) {
            component.getAccessibleContext().setAccessibleName(name);
            component.getAccessibleContext().setAccessibleDescription(description);
        }
    }

    private void setStatus(String text) {
        statusLabel.setText(text);
    }

    private void showCard(String card) {
        if (card != null) {
            currentCard = card;
            cardLayout.show(contentPanel, card);
            if ("create".equals(card)) {
                getRootPane().setDefaultButton(createButton);
            } else if ("reset".equals(card)) {
                getRootPane().setDefaultButton(resetButton);
            } else if ("edit".equals(card)) {
                getRootPane().setDefaultButton(saveEditButton);
            } else {
                getRootPane().setDefaultButton(null);
            }
        }
    }

    private void attachTableTo(JPanel target) {
        if (target == null || tableScrollPane.getParent() == target) {
            return;
        }
        Container parent = tableScrollPane.getParent();
        if (parent != null) {
            parent.remove(tableScrollPane);
            parent.revalidate();
            parent.repaint();
        }
        target.add(tableScrollPane, BorderLayout.CENTER);
        target.revalidate();
        target.repaint();
    }

    private void focusTable() {
        if (tableModel.getRowCount() > 0) {
            table.setRowSelectionAllowed(true);
            table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            table.setRowSelectionInterval(0, 0);
            scrollFirstColumnIntoView(table.getSelectedRow());
            table.requestFocusInWindow();
        }
    }

    private void scrollFirstColumnIntoView(int row) {
        if (row < 0) {
            return;
        }
        try {
            table.scrollRectToVisible(table.getCellRect(row, 0, true));
        } catch (Exception ignored) {
            // best-effort
        }
    }

    private void showTempPassword(String tempPwd) {
        JDialog dialog = new JDialog(ownerWindow, "Mot de passe réinitialisé", ModalityType.DOCUMENT_MODAL);
        dialog.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        JTextField field = new JTextField(tempPwd);
        field.setEditable(false);
        field.setFocusable(true);
        field.selectAll();

        JButton ok = new JButton("OK");
        ok.addActionListener(e -> dialog.dispose());

        JPanel content = new JPanel();
        content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
        content.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
        content.add(new JLabel("Mot de passe temporaire :"));
        content.add(Box.createRigidArea(new Dimension(0, 8)));
        content.add(field);
        content.add(Box.createRigidArea(new Dimension(0, 12)));
        ok.setAlignmentX(Component.CENTER_ALIGNMENT);
        content.add(ok);

        dialog.setContentPane(content);
        dialog.pack();
        dialog.setLocationRelativeTo(ownerWindow);

        dialog.getRootPane().setDefaultButton(ok);
        // ESC ferme le dialogue sans nouvelle action
        dialog.getRootPane().getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW)
                .put(KeyStroke.getKeyStroke("ESCAPE"), "temp.close");
        dialog.getRootPane().getActionMap().put("temp.close", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                dialog.dispose();
            }
        });
        // Shift+Tab depuis le champ ramène sur OK pour fermer
        field.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("shift TAB"), "temp.focus-ok");
        field.getActionMap().put("temp.focus-ok", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                ok.requestFocusInWindow();
            }
        });

        SwingUtilities.invokeLater(() -> field.requestFocusInWindow());
        dialog.setVisible(true);
    }

    private void applyUserEdit() {
        int row = table.getSelectedRow();
        if (row < 0) {
            dialogService.info("Administration", "Sélectionnez un utilisateur à modifier dans la table.");
            return;
        }
        int userId = (int) tableModel.getValueAt(row, 0);
        String email = (String) tableModel.getValueAt(row, 2);
        String username = (String) tableModel.getValueAt(row, 1);
        String roles = (String) tableModel.getValueAt(row, 3);
        boolean verified = "Oui".equalsIgnoreCase(String.valueOf(tableModel.getValueAt(row, 4)));
        List<String> currentRoles = parseRolesStatic(roles);

        editEmailField.putClientProperty("userId", userId);
        editEmailField.setText(email);
        editUsernameField.setText(username);
        editPasswordField.setText("");
        setSelectedRoles(editRoleCheckboxes, currentRoles);
        editEmailVerified.setSelected(verified);
        attachTableTo(editTableHolder);
        showCard("edit");
        editEmailField.requestFocusInWindow();
    }

    private void fillEditFormFromSelection() {
        int row = table.getSelectedRow();
        if (row < 0 || !"edit".equals(currentCard)) {
            return;
        }
        int userId = (int) tableModel.getValueAt(row, 0);
        String email = (String) tableModel.getValueAt(row, 2);
        String username = (String) tableModel.getValueAt(row, 1);
        String roles = (String) tableModel.getValueAt(row, 3);
        boolean verified = "Oui".equalsIgnoreCase(String.valueOf(tableModel.getValueAt(row, 4)));
        editEmailField.putClientProperty("userId", userId);
        editEmailField.setText(email);
        editUsernameField.setText(username);
        editPasswordField.setText("");
        setSelectedRoles(editRoleCheckboxes, parseRolesStatic(roles));
        editEmailVerified.setSelected(verified);
    }

    private void saveEdit() {
        Object idProp = editEmailField.getClientProperty("userId");
        if (!(idProp instanceof Integer userId)) {
            dialogService.error("Modification", "Aucun utilisateur sélectionné.");
            return;
        }
        String email = editEmailField.getText().trim();
        String username = editUsernameField.getText().trim();
        String password = new String(editPasswordField.getPassword()).trim();
        List<String> roles = getSelectedRoles(editRoleCheckboxes);
        boolean verified = editEmailVerified.isSelected();

        if (email.isBlank() || username.isBlank()) {
            dialogService.error("Modification", "Email et nom d'utilisateur sont requis.");
            return;
        }

        AdminUserUpdateRequest req = new AdminUserUpdateRequest(
                email,
                username,
                password.isBlank() ? null : password,
                roles.isEmpty() ? null : roles,
                verified
        );
        setStatus("Mise à jour en cours...");
        saveEditButton.setEnabled(false);
        deleteButton.setEnabled(false);
        service.updateUser(userId, req)
                .whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
                    saveEditButton.setEnabled(true);
                    deleteButton.setEnabled(true);
                    if (error != null) {
                        dialogService.error("Modification", error.getMessage());
                        setStatus("Échec de la mise à jour.");
                        return;
                    }
                    dialogService.info("Modification", "Utilisateur mis à jour : " + result.username());
                    setStatus("Utilisateur mis à jour.");
                    loadUsers(null, true);
                }));
    }

    private void deleteUser() {
        Object idProp = editEmailField.getClientProperty("userId");
        if (!(idProp instanceof Integer userId)) {
            dialogService.error("Suppression", "Aucun utilisateur sélectionné.");
            return;
        }
        int choice = JOptionPane.showConfirmDialog(
                ownerWindow,
                "Supprimer l'utilisateur sélectionné ?",
                "Confirmation",
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.WARNING_MESSAGE
        );
        if (choice != JOptionPane.OK_OPTION) {
            return;
        }
        setStatus("Suppression en cours...");
        saveEditButton.setEnabled(false);
        deleteButton.setEnabled(false);
        service.deleteUser(userId)
                .whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
                    saveEditButton.setEnabled(true);
                    deleteButton.setEnabled(true);
                    if (error != null) {
                        dialogService.error("Suppression", error.getMessage());
                        setStatus("Échec de la suppression.");
                        return;
                    }
                    dialogService.info("Suppression", "Utilisateur supprimé.");
                    setStatus("Utilisateur supprimé.");
                    loadUsers(null, true);
                }));
    }

    private void applyBan() {
        int row = table.getSelectedRow();
        if (row < 0) {
            dialogService.error("Ban", "Sélectionnez un utilisateur à bannir.");
            return;
        }
        int userId = (int) tableModel.getValueAt(row, 0);
        String reason = banReasonField.getText().trim();
        int duration = parseDurationDays();
        String untilIso = parseBanUntilIso();
        final String fallbackUntil = untilIso != null
                ? untilIso
                : (duration > 0 ? computeUntilIsoFromDuration(duration) : null);
        if (reason.isBlank()) {
            dialogService.error("Ban", "Motif requis.");
            return;
        }
        if (duration < 1 && untilIso == null) {
            dialogService.error("Ban", "Indiquez une durée en jours ou une date de fin (jj/mm/aaaa).");
            return;
        }
        banButton.setEnabled(false);
        setStatus("Ban en cours...");
        service.banUser(userId, new AdminBanRequest(reason, duration, untilIso))
                .whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
                    banButton.setEnabled(true);
                    if (error != null) {
                        dialogService.error("Ban", error.getMessage());
                        setStatus("Échec du ban.");
                        return;
                    }
                    String untilText = Optional.ofNullable(result.bannedUntil()).orElse(Optional.ofNullable(fallbackUntil).orElse("non définie"));
                    dialogService.info("Ban", "Utilisateur banni jusqu'au " + untilText);
                    setStatus("Utilisateur banni.");
                    loadUsers(null, true);
                }));
    }
    private void applyUnban() {
        int row = table.getSelectedRow();
        if (row < 0) {
            dialogService.error("Ban", "Sélectionnez un utilisateur à débannir.");
            return;
        }
        int userId = (int) tableModel.getValueAt(row, 0);
        unbanButton.setEnabled(false);
        setStatus("Déban en cours...");
        service.unbanUser(userId)
                .whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
                    unbanButton.setEnabled(true);
                    if (error != null) {
                        dialogService.error("Ban", error.getMessage());
                        setStatus("Échec du débannissement.");
                        return;
                    }
                    dialogService.info("Ban", "Utilisateur débanni.");
                    setStatus("Utilisateur débanni.");
                    loadUsers(null, true);
                }));
    }
    private int parseDurationDays() {
        try {
            return Integer.parseInt(banDurationDaysField.getText().trim());
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String parseBanUntilIso() {
        String value = banUntilField.getText().trim();
        if (value.isBlank() || value.contains("jj/")) {
            return null;
        }
        String[] parts = value.split("/");
        if (parts.length != 3) {
            return null;
        }
        try {
            int day = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]) - 1;
            int year = Integer.parseInt(parts[2]);
            Calendar cal = Calendar.getInstance();
            cal.setLenient(false);
            cal.set(year, month, day, 23, 59, 59);
            cal.set(Calendar.MILLISECOND, 0);
            cal.getTime(); // force validation
            return String.format("%04d-%02d-%02dT23:59:59Z", year, month + 1, day);
        } catch (Exception ex) {
            return null;
        }
    }

    private String computeUntilIsoFromDuration(int durationDays) {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.MILLISECOND, 0);
        cal.set(Calendar.SECOND, 59);
        cal.set(Calendar.MINUTE, 59);
        cal.set(Calendar.HOUR_OF_DAY, 23);
        cal.add(Calendar.DAY_OF_MONTH, durationDays);
        int year = cal.get(Calendar.YEAR);
        int month = cal.get(Calendar.MONTH) + 1;
        int day = cal.get(Calendar.DAY_OF_MONTH);
        return String.format("%04d-%02d-%02dT23:59:59Z", year, month, day);
    }

    private static List<String> parseRolesStatic(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        String[] parts = value.split(",");
        List<String> roles = new ArrayList<>();
        for (String p : parts) {
            String role = p.trim();
            if (!role.isBlank()) {
                roles.add(role);
            }
        }
        return roles;
    }

    private void setSelectedRoles(List<JCheckBox> boxes, List<String> roles) {
        List<String> normalized = roles == null ? List.of() : roles.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toUpperCase)
                .toList();
        for (JCheckBox box : boxes) {
            String roleId = String.valueOf(box.getClientProperty("roleId"));
            boolean selected = normalized.isEmpty()
                    ? "ROLE_USER".equalsIgnoreCase(roleId)
                    : normalized.contains(roleId.toUpperCase());
            box.setSelected(selected);
        }
    }

    private List<String> getSelectedRoles(List<JCheckBox> boxes) {
        List<String> selected = new ArrayList<>();
        for (JCheckBox box : boxes) {
            if (box.isSelected()) {
                String roleId = String.valueOf(box.getClientProperty("roleId"));
                selected.add(roleId);
            }
        }
        if (selected.isEmpty()) {
            return List.of("ROLE_USER");
        }
        return selected;
    }

    private void focusBanFormFromSelection() {
        fillEditFormFromSelection();
        updateBanFormVisibility();
        if (isSelectedUserBanned()) {
            unbanButton.requestFocusInWindow();
        } else {
            banReasonField.requestFocusInWindow();
        }
    }

    private void updateBanFormVisibility() {
        boolean banned = isSelectedUserBanned();
        banFormPanel.setVisible(!banned);
        banButton.setVisible(!banned);
        unbanButton.setVisible(banned);
        getRootPane().setDefaultButton(banned ? unbanButton : banButton);
    }

    private boolean isSelectedUserBanned() {
        int row = table.getSelectedRow();
        if (row < 0) {
            return false;
        }
        Object val = tableModel.getValueAt(row, 5);
        if (val == null) {
            return false;
        }
        String s = val.toString().trim();
        return !s.isEmpty();
    }

    private void forceShiftTabToSave(JComponent component) {
        component.getInputMap(JComponent.WHEN_FOCUSED)
                .put(KeyStroke.getKeyStroke("shift TAB"), "admin.edit.wrap-save");
        component.getActionMap().put("admin.edit.wrap-save", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                saveEditButton.requestFocusInWindow();
            }
        });
    }

    private static final class OrderedFocusTraversalPolicy extends FocusTraversalPolicy {
        private final List<Component> order;

        OrderedFocusTraversalPolicy(List<Component> order) {
            this.order = List.copyOf(order);
        }

        @Override
        public Component getComponentAfter(Container aContainer, Component aComponent) {
            int idx = order.indexOf(aComponent);
            int next = (idx + 1) % order.size();
            return order.get(next);
        }

        @Override
        public Component getComponentBefore(Container aContainer, Component aComponent) {
            int idx = order.indexOf(aComponent);
            int prev = (idx - 1 + order.size()) % order.size();
            return order.get(prev);
        }

        @Override
        public Component getFirstComponent(Container aContainer) {
            return order.get(0);
        }

        @Override
        public Component getLastComponent(Container aContainer) {
            return order.get(order.size() - 1);
        }

        @Override
        public Component getDefaultComponent(Container aContainer) {
            return getFirstComponent(aContainer);
        }
    }

    private record RoleOption(String id, String label) { }
}
