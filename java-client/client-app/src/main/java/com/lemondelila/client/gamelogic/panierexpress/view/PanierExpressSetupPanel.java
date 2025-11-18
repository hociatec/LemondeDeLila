package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JSpinner;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SpinnerNumberModel;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.KeyboardFocusManager;
import java.awt.event.ActionEvent;
import java.util.Objects;

/**
 * Vue de configuration avant le lancement de Panier Express.
 */
final class PanierExpressSetupPanel extends JPanel {

    interface Listener {
        void onStart(PanierExpressGameOptions options);

        void onCancel();
    }

    private final JSpinner robotSpinner;

    PanierExpressSetupPanel(Listener listener) {
        Objects.requireNonNull(listener, "listener");
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(BorderFactory.createEmptyBorder(24, 32, 24, 32));
        setFocusCycleRoot(true);
        setFocusable(true);

        JLabel title = new JLabel(Internationalization.text("panier.setup.title"));
        title.setAlignmentX(Component.LEFT_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(title.getFont().getStyle() | java.awt.Font.BOLD, 20f));
        AccessibleDecorator.apply(title, AccessibleSpec.builder()
                .name(Internationalization.text("panier.setup.title"))
                .description(Internationalization.text("panier.setup.title.desc"))
                .build());
        add(title);
        add(Box.createRigidArea(new Dimension(0, 16)));

        JTextArea instructions = new JTextArea(Internationalization.text("panier.setup.instructions"));
        instructions.setEditable(false);
        instructions.setLineWrap(true);
        instructions.setWrapStyleWord(true);
        instructions.setFocusable(false);
        instructions.setAlignmentX(Component.LEFT_ALIGNMENT);
        AccessibleDecorator.apply(instructions, AccessibleSpec.builder()
                .name(Internationalization.text("panier.setup.instructions.title"))
                .description(instructions.getText())
                .build());
        add(instructions);
        add(Box.createRigidArea(new Dimension(0, 20)));

        JPanel robotPanel = new JPanel();
        robotPanel.setLayout(new BoxLayout(robotPanel, BoxLayout.X_AXIS));
        robotPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        JLabel robotLabel = new JLabel(Internationalization.text("panier.setup.robot.label"));
        AccessibleDecorator.apply(robotLabel, AccessibleSpec.builder()
                .name(Internationalization.text("panier.setup.robot.name"))
                .description(Internationalization.text("panier.setup.robot.desc"))
                .build());
        robotPanel.add(robotLabel);

        robotSpinner = new JSpinner(new SpinnerNumberModel(
                PanierExpressGameOptions.DEFAULT_ROBOT_COUNT,
                PanierExpressGameOptions.MIN_ROBOT_COUNT,
                PanierExpressGameOptions.MAX_ROBOT_COUNT,
                1
        ));
        robotSpinner.setAlignmentX(Component.LEFT_ALIGNMENT);
        robotSpinner.getAccessibleContext().setAccessibleName(Internationalization.text("panier.setup.robot.field"));
        robotSpinner.getAccessibleContext().setAccessibleDescription(Internationalization.text("panier.setup.robot.field.desc"));
        ((JComponent) robotSpinner.getEditor()).setFocusable(true);
        robotPanel.add(robotSpinner);
        add(robotPanel);
        add(Box.createRigidArea(new Dimension(0, 20)));

        JButton cancelButton = new JButton(Internationalization.text("panier.setup.cancel"));
        cancelButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        AccessibleDecorator.apply(cancelButton, AccessibleSpec.builder()
                .name(Internationalization.text("panier.setup.cancel.name"))
                .description(Internationalization.text("panier.setup.cancel.desc"))
                .build());
        cancelButton.addActionListener(e -> listener.onCancel());

        JButton startButton = new JButton(Internationalization.text("panier.setup.start"));
        startButton.setAlignmentX(Component.LEFT_ALIGNMENT);
        AccessibleDecorator.apply(startButton, AccessibleSpec.builder()
                .name(Internationalization.text("panier.setup.start.name"))
                .description(Internationalization.text("panier.setup.start.desc"))
                .build());
        startButton.addActionListener(e -> {
            int robots = (int) robotSpinner.getValue();
            listener.onStart(PanierExpressGameOptions.of(robots));
        });

        add(cancelButton);
        add(Box.createRigidArea(new Dimension(0, 8)));
        add(startButton);

        installNavigationShortcuts();
    }

    private void installNavigationShortcuts() {
        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("DOWN"), "focusNext");
        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("UP"), "focusPrev");
        getActionMap().put("focusNext", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                KeyboardFocusManager.getCurrentKeyboardFocusManager().focusNextComponent();
            }
        });
        getActionMap().put("focusPrev", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                KeyboardFocusManager.getCurrentKeyboardFocusManager().focusPreviousComponent();
            }
        });
    }

    void focusFirstComponent() {
        robotSpinner.requestFocusInWindow();
    }

    PanierExpressGameOptions currentOptions() {
        return PanierExpressGameOptions.of((int) robotSpinner.getValue());
    }
}

