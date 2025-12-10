package com.lemondelila.client.admin.view;

import com.lemondelila.client.admin.dto.AdminUserUpdateRequest;
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
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.JList;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;
import java.awt.Dimension;
import java.awt.Window;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class EditUserDialog extends JDialog {

    private final AdminUserService service;
    private final DialogService dialogService;
    private final int userId;

    private final JTextField emailField = new JTextField();
    private final JTextField usernameField = new JTextField();
    private final JPasswordField passwordField = new JPasswordField();
    private final JList<String> rolesList;
    private final JCheckBox emailVerified = new JCheckBox("Email vérifié", true);
    private final JButton saveButton = new JButton("Enregistrer");

    public EditUserDialog(Window owner,
                          AdminUserService service,
                          DialogService dialogService,
                          int userId,
                          String email,
                          String username,
                          List<String> availableRoles,
                          List<String> roles,
                          boolean verified) {
        super(owner, "Modifier l'utilisateur", ModalityType.APPLICATION_MODAL);
        this.service = Objects.requireNonNull(service, "service");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.userId = userId;
        this.rolesList = new JList<>(availableRoles.toArray(new String[0]));
        this.rolesList.setSelectionMode(ListSelectionModel.MULTIPLE_INTERVAL_SELECTION);

        emailField.setText(email);
        usernameField.setText(username);
        setSelectedRoles(roles);
        emailVerified.setSelected(verified);

        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        setLayout(new BoxLayout(getContentPane(), BoxLayout.Y_AXIS));
        setBorder();

        add(labeledField("Email", emailField));
        add(labeledField("Nom d'utilisateur", usernameField));
        add(labeledField("Mot de passe (laisser vide pour conserver)", passwordField));
        add(labeledField("Rôles (sélection multiple)", new JScrollPane(rolesList)));
        emailVerified.setAlignmentX(JComponent.LEFT_ALIGNMENT);
        add(emailVerified);
        add(Box.createRigidArea(new Dimension(0, 12)));

        JPanel actions = new JPanel();
        actions.setLayout(new BoxLayout(actions, BoxLayout.X_AXIS));
        actions.setAlignmentX(JComponent.LEFT_ALIGNMENT);
        saveButton.setAlignmentX(JComponent.LEFT_ALIGNMENT);
        JButton cancel = new JButton("Annuler");
        cancel.addActionListener(e -> dispose());
        saveButton.addActionListener(new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                save();
            }
        });
        actions.add(saveButton);
        actions.add(Box.createRigidArea(new Dimension(8, 0)));
        actions.add(cancel);
        actions.add(Box.createHorizontalGlue());
        add(actions);

        pack();
        setLocationRelativeTo(owner);
    }

    private void setBorder() {
        ((JComponent) getContentPane()).setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
    }

    private JComponent labeledField(String label, JComponent field) {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.X_AXIS));
        JLabel lbl = new JLabel(label + " : ");
        lbl.setPreferredSize(new Dimension(200, 24));
        lbl.setLabelFor(field);
        panel.add(lbl);
        field.setMaximumSize(new Dimension(360, 28));
        panel.add(field);
        panel.add(Box.createHorizontalGlue());
        panel.setAlignmentX(JComponent.LEFT_ALIGNMENT);
        return panel;
    }

    private void save() {
        String email = emailField.getText().trim();
        String username = usernameField.getText().trim();
        String password = new String(passwordField.getPassword()).trim();
        List<String> roles = getSelectedRoles();
        boolean verified = emailVerified.isSelected();

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
        saveButton.setEnabled(false);
        CompletableFuture<?> fut = service.updateUser(userId, req)
                .whenComplete((result, error) -> javax.swing.SwingUtilities.invokeLater(() -> {
                    saveButton.setEnabled(true);
                    if (error != null) {
                        dialogService.error("Modification", error.getMessage());
                        return;
                    }
                    dialogService.info("Modification", "Utilisateur mis à jour.");
                    dispose();
                }));
    }

    private void setSelectedRoles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            rolesList.clearSelection();
            rolesList.setSelectedValue("ROLE_USER", true);
            return;
        }
        int[] indices = rolesList.getModel().getSize() > 0
                ? roles.stream()
                .mapToInt(r -> {
                    for (int i = 0; i < rolesList.getModel().getSize(); i++) {
                        if (rolesList.getModel().getElementAt(i).equalsIgnoreCase(r.trim())) {
                            return i;
                        }
                    }
                    return -1;
                })
                .filter(i -> i >= 0)
                .toArray()
                : new int[0];
        rolesList.clearSelection();
        rolesList.setSelectedIndices(indices);
        if (rolesList.getSelectedIndices().length == 0) {
            rolesList.setSelectedValue("ROLE_USER", true);
        }
    }

    private List<String> getSelectedRoles() {
        List<String> selected = rolesList.getSelectedValuesList();
        if (selected == null || selected.isEmpty()) {
            return List.of("ROLE_USER");
        }
        return selected;
    }
}
