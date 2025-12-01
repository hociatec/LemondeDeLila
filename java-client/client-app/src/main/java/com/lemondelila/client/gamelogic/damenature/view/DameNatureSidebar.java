package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.gamelogic.damenature.service.DameNatureConfigState;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureViewState;

import javax.swing.DefaultListModel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JLabel;
import javax.swing.JProgressBar;
import javax.swing.JScrollPane;
import javax.swing.SwingConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.util.List;

final class DameNatureSidebar extends JPanel {

    private final DefaultListModel<String> opponentModel = new DefaultListModel<>();
    private final DefaultListModel<String> cardModel = new DefaultListModel<>();
    private final JList<String> opponents = new JList<>(opponentModel);
    private final JList<String> cards = new JList<>(cardModel);
    private final JLabel pollutionLabel = new JLabel("Pollution : 0/12");
    private final JProgressBar pollutionBar = new JProgressBar();
    private final JLabel deckLabel = new JLabel("Pioche : 0 cartes");
    private final JLabel booksLabel = new JLabel("Familles : 0/4");
    private final JLabel variantLabel = new JLabel("Variante : Dame Nature");
    private final JLabel helperLabel = new JLabel("↑/↓ adversaires | ←/→ cartes | E pour demander");

    DameNatureSidebar() {
        super(new BorderLayout(6, 6));
        opponents.setVisibleRowCount(6);
        opponents.setFocusable(false);
        cards.setVisibleRowCount(8);
        cards.setFocusable(false);
        helperLabel.setHorizontalAlignment(SwingConstants.CENTER);
        helperLabel.setOpaque(true);
        helperLabel.setBackground(new Color(245, 245, 245));

        JPanel top = new JPanel(new BorderLayout(4, 4));
        top.add(variantLabel, BorderLayout.NORTH);
        top.add(deckLabel, BorderLayout.CENTER);
        top.add(pollutionLabel, BorderLayout.SOUTH);

        pollutionBar.setMinimum(0);
        pollutionBar.setMaximum(12);
        pollutionBar.setStringPainted(true);

        JPanel gauges = new JPanel(new BorderLayout(4, 4));
        gauges.add(top, BorderLayout.NORTH);
        gauges.add(pollutionBar, BorderLayout.CENTER);
        gauges.add(booksLabel, BorderLayout.SOUTH);

        JPanel lists = new JPanel(new BorderLayout(4, 4));
        JScrollPane opponentsPane = new JScrollPane(opponents);
        opponentsPane.setBorder(javax.swing.BorderFactory.createTitledBorder("Adversaires"));
        JScrollPane cardsPane = new JScrollPane(cards);
        cardsPane.setBorder(javax.swing.BorderFactory.createTitledBorder("Cartes disponibles"));
        lists.add(opponentsPane, BorderLayout.NORTH);
        lists.add(cardsPane, BorderLayout.CENTER);

        add(gauges, BorderLayout.NORTH);
        add(lists, BorderLayout.CENTER);
        add(helperLabel, BorderLayout.SOUTH);
        setPreferredSize(new Dimension(320, 0));
    }

    void update(DameNatureViewState state,
                int opponentIndex,
                int cardIndex,
                DameNatureConfigState configState) {
        updateVariant(configState);
        updatePollution(state);
        updateDeck(state);
        updateBooks(state);
        fillList(opponentModel, state.opponents().stream().map(DameNatureViewState.OpponentView::label).toList());
        fillList(cardModel, state.hand().stream().map(DameNatureViewState.CardView::label).toList());
        selectIndex(opponents, opponentIndex);
        selectIndex(cards, cardIndex);
    }

    private void updateVariant(DameNatureConfigState configState) {
        variantLabel.setText("Variante : " + configState.describeVariant());
    }

    private void updatePollution(DameNatureViewState state) {
        int max = Math.max(1, state.maxPollution());
        pollutionBar.setMaximum(max);
        pollutionBar.setValue(Math.min(max, Math.max(0, state.pollution())));
        pollutionBar.setString(state.pollution() + " / " + max);
        pollutionLabel.setText("Pollution : " + state.pollution() + "/" + max);
    }

    private void updateDeck(DameNatureViewState state) {
        deckLabel.setText("Pioche : " + state.deckRemaining() + " cartes restantes");
    }

    private void updateBooks(DameNatureViewState state) {
        booksLabel.setText(String.format("Familles complétées : %d / %d", state.completedFamilies().size(), state.familyGoal()));
    }

    private static void fillList(DefaultListModel<String> model, List<String> values) {
        model.clear();
        for (String value : values) {
            model.addElement(value);
        }
    }

    private static void selectIndex(JList<String> list, int index) {
        if (index < 0 || index >= list.getModel().getSize()) {
            list.clearSelection();
        } else {
            list.setSelectedIndex(index);
        }
    }
}
