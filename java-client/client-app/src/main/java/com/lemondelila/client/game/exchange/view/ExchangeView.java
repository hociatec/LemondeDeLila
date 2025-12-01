package com.lemondelila.client.game.exchange.view;

import com.lemondelila.client.game.exchange.controller.ExchangeController;
import com.lemondelila.client.game.exchange.model.ExchangeCollection;
import com.lemondelila.client.game.exchange.model.ExchangeOption;
import com.lemondelila.client.game.exchange.model.ExchangePrompt;
import com.lemondelila.client.game.exchange.model.ExchangeTarget;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.DefaultListCellRenderer;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.ListSelectionModel;
import javax.swing.DefaultListModel;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;

public final class ExchangeView extends JPanel implements ExchangeCollection.Listener {

    private final ExchangeController controller;
    private final JPanel cardsPanel = new JPanel(new BorderLayout(4, 4));
    private final JPanel targetsPanel = new JPanel(new BorderLayout(4, 4));
    private final JLabel titleLabel = new JLabel("Échanges");
    private final JTextArea instructionArea = new JTextArea();
    private final DefaultListModel<ExchangeOption> cardModel = new DefaultListModel<>();
    private final DefaultListModel<ExchangeTarget> targetModel = new DefaultListModel<>();
    private final JList<ExchangeOption> cardList = new JList<>(cardModel);
    private final JList<ExchangeTarget> targetList = new JList<>(targetModel);
    private final JScrollPane cardScroll = new JScrollPane(cardList);
    private final JScrollPane targetScroll = new JScrollPane(targetList);
    private ExchangePrompt currentPrompt;
    private String baseInstructionText = "Aucun échange en cours.";

    public ExchangeView(ExchangeController controller) {
        super(new BorderLayout(8, 8));
        this.controller = Objects.requireNonNull(controller, "controller");
        setBorder(BorderFactory.createTitledBorder("Échanges"));
        add(titleLabel, BorderLayout.NORTH);

        JPanel center = new JPanel(new BorderLayout(4, 4));
        cardsPanel.add(cardScroll, BorderLayout.CENTER);
        targetsPanel.add(targetScroll, BorderLayout.CENTER);
        center.add(cardsPanel, BorderLayout.CENTER);
        center.add(targetsPanel, BorderLayout.EAST);
        add(center, BorderLayout.CENTER);

        instructionArea.setEditable(false);
        instructionArea.setWrapStyleWord(true);
        instructionArea.setLineWrap(true);
        instructionArea.setOpaque(false);
        instructionArea.setFocusable(false);
        instructionArea.getAccessibleContext().setAccessibleName("Instructions d'échange");
        instructionArea.getAccessibleContext().setAccessibleDescription("Détails de l'échange en cours");
        add(instructionArea, BorderLayout.SOUTH);

        getAccessibleContext().setAccessibleDescription("Zone d'échange");
        cardsPanel.getAccessibleContext().setAccessibleName("Cartes échangeables");
        cardsPanel.getAccessibleContext().setAccessibleDescription("Liste des cartes que vous pouvez offrir");
        targetsPanel.getAccessibleContext().setAccessibleName("Cibles disponibles");
        targetsPanel.getAccessibleContext().setAccessibleDescription("Liste des joueurs disponibles pour l'échange");

        setupLists();
        controller.collection().addListener(this);
        onPromptChanged(null);
    }

    private void setupLists() {
        cardList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        targetList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

        cardList.setCellRenderer(new DefaultListCellRenderer() {
            @Override
            public JLabel getListCellRendererComponent(JList<?> list,
                                                       Object value,
                                                       int index,
                                                       boolean isSelected,
                                                       boolean cellHasFocus) {
                String labelValue = value instanceof ExchangeOption option
                        ? option.label()
                        : Objects.toString(value, "");
                JLabel renderer = (JLabel) super.getListCellRendererComponent(list, labelValue, index, isSelected, cellHasFocus);
                renderer.setOpaque(true);
                return renderer;
            }
        });
        targetList.setCellRenderer(new DefaultListCellRenderer() {
            @Override
            public JLabel getListCellRendererComponent(JList<?> list,
                                                       Object value,
                                                       int index,
                                                       boolean isSelected,
                                                       boolean cellHasFocus) {
                String labelValue = value instanceof ExchangeTarget target
                        ? target.username()
                        : Objects.toString(value, "");
                JLabel renderer = (JLabel) super.getListCellRendererComponent(list, labelValue, index, isSelected, cellHasFocus);
                renderer.setOpaque(true);
                return renderer;
            }
        });

        cardList.getAccessibleContext().setAccessibleName("Cartes échangeables");
        cardList.getAccessibleContext().setAccessibleDescription("Choisissez la carte à proposer");
        targetList.getAccessibleContext().setAccessibleName("Cibles échangeables");
        targetList.getAccessibleContext().setAccessibleDescription("Choisissez le destinataire du cadeau");

        bindListAction(cardList, () -> {
            ExchangeOption option = cardList.getSelectedValue();
            if (option != null) {
                controller.selectCard(option.id());
            }
        });
        bindListAction(targetList, () -> {
            ExchangeTarget target = targetList.getSelectedValue();
            if (target != null) {
                controller.selectTarget(target.id());
            }
        });
        configureTraversal();
    }

    private void bindListAction(JList<?> list, Runnable action) {
        InputMap inputMap = list.getInputMap(JComponent.WHEN_FOCUSED);
        inputMap.put(KeyStroke.getKeyStroke("ENTER"), "exchange.confirm");
        list.getActionMap().put("exchange.confirm", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (action != null) {
                    action.run();
                }
            }
        });
    }

    private void configureTraversal() {
        KeyStroke tab = KeyStroke.getKeyStroke("TAB");
        KeyStroke shiftTab = KeyStroke.getKeyStroke("shift TAB");
        cardList.setFocusTraversalKeysEnabled(false);
        targetList.setFocusTraversalKeysEnabled(false);

        AbstractAction toTargets = new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (!targetModel.isEmpty()) {
                    targetList.requestFocusInWindow();
                    targetList.setSelectedIndex(Math.max(0, targetList.getSelectedIndex()));
                }
            }
        };
        AbstractAction toCards = new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (!cardModel.isEmpty()) {
                    cardList.requestFocusInWindow();
                    cardList.setSelectedIndex(Math.max(0, cardList.getSelectedIndex()));
                }
            }
        };

        cardList.getInputMap(JComponent.WHEN_FOCUSED).put(tab, "exchange.nextTarget");
        cardList.getInputMap(JComponent.WHEN_FOCUSED).put(shiftTab, "exchange.prev");
        cardList.getActionMap().put("exchange.nextTarget", toTargets);
        cardList.getActionMap().put("exchange.prev", toTargets);

        targetList.getInputMap(JComponent.WHEN_FOCUSED).put(tab, "exchange.next");
        targetList.getInputMap(JComponent.WHEN_FOCUSED).put(shiftTab, "exchange.prevCard");
        targetList.getActionMap().put("exchange.next", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                toCards.actionPerformed(null);
            }
        });
        targetList.getActionMap().put("exchange.prevCard", toCards);
    }

    @Override
    public void onPromptChanged(ExchangePrompt prompt) {
        if (prompt == null) {
            baseInstructionText = "Aucun échange en cours.";
            instructionArea.setCaretPosition(0);
            targetsPanel.setVisible(false);
            resetSelection();
            refreshInstructionArea();
            revalidate();
            repaint();
            return;
        }
        currentPrompt = prompt;
        titleLabel.setText(prompt.title() == null ? "Echanges" : prompt.title());
        baseInstructionText = buildInstructionText(prompt);
        renderCards(prompt.cards());
        if (prompt.stage() == ExchangePrompt.Stage.SELECT) {
            renderTargets(prompt.targets());
            targetsPanel.setVisible(true);
        } else {
            targetModel.clear();
            targetList.clearSelection();
            targetsPanel.setVisible(false);
        }
        refreshInstructionArea();
        revalidate();
        repaint();
    }

    private void renderCards(List<ExchangeOption> cards) {
        cardModel.clear();
        if (cards != null) {
            cards.forEach(cardModel::addElement);
        }
        if (!cardModel.isEmpty()) {
            cardList.setSelectedIndex(0);
        } else {
            cardList.clearSelection();
        }
    }

    private void renderTargets(List<ExchangeTarget> targets) {
        targetModel.clear();
        if (targets != null) {
            targets.forEach(targetModel::addElement);
        }
        if (!targetModel.isEmpty()) {
            targetList.setSelectedIndex(0);
        } else {
            targetList.clearSelection();
        }
    }

    private void resetSelection() {
        cardModel.clear();
        targetModel.clear();
        cardList.clearSelection();
        targetList.clearSelection();
        currentPrompt = null;
    }

    private void refreshInstructionArea() {
        StringBuilder builder = new StringBuilder(baseInstructionText == null ? "" : baseInstructionText);
        if (currentPrompt != null && currentPrompt.stage() == ExchangePrompt.Stage.SELECT) {
            ExchangeTarget target = targetList.getSelectedValue();
            if (target != null) {
                if (builder.length() > 0) {
                    builder.append('\n');
                }
                builder.append("Cible active : ").append(target.username());
            }
        }
        instructionArea.setText(builder.toString());
        instructionArea.setCaretPosition(0);
    }

    private String buildInstructionText(ExchangePrompt prompt) {
        StringBuilder builder = new StringBuilder();
        if (prompt.description() != null && !prompt.description().isBlank()) {
            builder.append(prompt.description()).append('\n');
        }
        if (prompt.stage() == ExchangePrompt.Stage.SELECT) {
            builder.append("Utilisez Tab pour passer des cartes aux cibles, flèches pour sélectionner et Entrée pour valider.");
        } else {
            builder.append("Sélectionnez la carte à rendre à ")
                    .append(prompt.requestedBy() != null ? prompt.requestedBy().username() : "votre adversaire")
                    .append('.');
        }
        if (prompt.offer() != null && !prompt.offer().isBlank()) {
            builder.append('\n').append("Offre reçue : ").append(prompt.offer());
        }
        return builder.toString();
    }

}
