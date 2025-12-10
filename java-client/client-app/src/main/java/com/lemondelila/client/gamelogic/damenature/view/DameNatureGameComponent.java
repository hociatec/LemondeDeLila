package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.view.GameInteractionComponent;
import com.lemondelila.client.game.core.view.GenericGameInteractionComponent;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureConfigState;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureStateAdapter;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureViewState;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.Timer;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

final class DameNatureGameComponent extends JPanel implements GameInteractionComponent {

    private final GenericGameInteractionComponent baseComponent;
    private final GenericGameInteractionController controller;
    private final GameActionEmitter emitter;
    private final DameNatureSidebar sidebar = new DameNatureSidebar();
    private final DameNatureStateAdapter stateAdapter;
    private final DameNatureConfigState configState;
    private Consumer<GenericGameState> observer;
    private DameNatureViewState currentState = DameNatureViewState.empty();
    private int selectedOpponentIndex = 0;
    private int selectedCardIndex = 0;
    private boolean quizActive;
    private final Map<KeyStroke, String> arrowBindings = new HashMap<>();

    DameNatureGameComponent(GenericGameInteractionComponent baseComponent,
                            GenericGameInteractionController controller,
                            GameActionEmitter emitter,
                            ClientSession session,
                            DameNatureConfigState configState) {
        super(new BorderLayout(8, 8));
        this.baseComponent = baseComponent;
        this.controller = controller;
        this.emitter = emitter;
        this.stateAdapter = new DameNatureStateAdapter(session);
        this.configState = configState;
        add(baseComponent, BorderLayout.CENTER);
        add(sidebar, BorderLayout.EAST);
        registerShortcuts();
        updateSidebar();
    }

    @Override
    public void onAttach(int roomId) {
        registerObserver();
        baseComponent.onAttach(roomId);
    }

    @Override
    public void onDetach() {
        baseComponent.onDetach();
        if (observer != null) {
            controller.removeStateObserver(observer);
            observer = null;
        }
        currentState = DameNatureViewState.empty();
        selectedCardIndex = 0;
        selectedOpponentIndex = 0;
        updateSidebar();
    }

    @Override
    public JComponent getComponent() {
        return this;
    }

    @Override
    public ScreenId id() {
        return baseComponent.id();
    }

    private void registerObserver() {
        if (observer != null) {
            controller.removeStateObserver(observer);
        }
        observer = this::handleStateUpdate;
        controller.addStateObserver(observer);
    }

    private void handleStateUpdate(GenericGameState state) {
        this.quizActive = state.pendingQuiz() != null;
        this.currentState = stateAdapter.adapt(state);
        clampSelections();
        updateSidebar();
        toggleArrowBindings(!quizActive);
    }

    private void clampSelections() {
        int opponentCount = currentState.opponents().size();
        if (opponentCount == 0) {
            selectedOpponentIndex = -1;
        } else if (selectedOpponentIndex >= opponentCount) {
            selectedOpponentIndex = opponentCount - 1;
        } else if (selectedOpponentIndex < 0) {
            selectedOpponentIndex = 0;
        }

        int cardCount = currentState.hand().size();
        if (cardCount == 0) {
            selectedCardIndex = -1;
        } else if (selectedCardIndex >= cardCount) {
            selectedCardIndex = cardCount - 1;
        } else if (selectedCardIndex < 0) {
            selectedCardIndex = 0;
        }
    }

    private void updateSidebar() {
        sidebar.update(currentState, selectedOpponentIndex, selectedCardIndex, configState);
    }

    private void registerShortcuts() {
        InputMap windowMap = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = getActionMap();
        actions.put("damenature.ask", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                requestCard();
            }
        });
        windowMap.put(KeyStroke.getKeyStroke('E'), "damenature.ask");

        actions.put("damenature.refresh", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                controller.refresh();
            }
        });
        windowMap.put(KeyStroke.getKeyStroke('R'), "damenature.refresh");

        actions.put("damenature.config", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                new DameNatureConfigDialog(configState).show(DameNatureGameComponent.this);
                updateSidebar();
            }
        });
        windowMap.put(KeyStroke.getKeyStroke('C'), "damenature.config");

        registerArrowShortcut(KeyStroke.getKeyStroke("UP"), "damenature.opponent.prev", () -> moveOpponentSelection(-1));
        registerArrowShortcut(KeyStroke.getKeyStroke("DOWN"), "damenature.opponent.next", () -> moveOpponentSelection(1));
        registerArrowShortcut(KeyStroke.getKeyStroke("LEFT"), "damenature.card.prev", () -> moveCardSelection(-1));
        registerArrowShortcut(KeyStroke.getKeyStroke("RIGHT"), "damenature.card.next", () -> moveCardSelection(1));
        toggleArrowBindings(true);
    }

    private void registerArrowShortcut(KeyStroke keyStroke, String actionName, Runnable action) {
        arrowBindings.put(keyStroke, actionName);
        getActionMap().put(actionName, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                action.run();
            }
        });
    }

    private void toggleArrowBindings(boolean enable) {
        InputMap map = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        arrowBindings.forEach((stroke, actionName) -> {
            if (enable) {
                map.put(stroke, actionName);
            } else {
                map.remove(stroke);
            }
        });
    }

    private void moveOpponentSelection(int delta) {
        List<DameNatureViewState.OpponentView> opponents = currentState.opponents();
        if (opponents.isEmpty()) {
            selectedOpponentIndex = -1;
            updateSidebar();
            return;
        }
        selectedOpponentIndex = Math.max(0, Math.min(opponents.size() - 1, selectedOpponentIndex + delta));
        updateSidebar();
    }

    private void moveCardSelection(int delta) {
        List<DameNatureViewState.CardView> cards = currentState.hand();
        if (cards.isEmpty()) {
            selectedCardIndex = -1;
            updateSidebar();
            return;
        }
        selectedCardIndex = Math.max(0, Math.min(cards.size() - 1, selectedCardIndex + delta));
        updateSidebar();
    }

    private void requestCard() {
        if (quizActive) {
            return;
        }
        List<DameNatureViewState.CardView> cards = currentState.hand();
        List<DameNatureViewState.OpponentView> opponents = currentState.opponents();
        if (cards.isEmpty()) {
            emitter.announceError("Aucune carte disponible.");
            return;
        }
        if (opponents.isEmpty()) {
            emitter.announceError("Aucun adversaire sélectionné.");
            return;
        }
        if (selectedCardIndex < 0 || selectedCardIndex >= cards.size()) {
            selectedCardIndex = 0;
        }
        if (selectedOpponentIndex < 0 || selectedOpponentIndex >= opponents.size()) {
            selectedOpponentIndex = 0;
        }
        DameNatureViewState.CardView card = cards.get(selectedCardIndex);
        DameNatureViewState.OpponentView opponent = opponents.get(selectedOpponentIndex);
        if (opponent.id() == 0) {
            emitter.announceError("Adversaire invalide.");
            return;
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("familyId", card.familyId());
        payload.put("memberId", extractMemberId(card));
        payload.put("target", opponent.id());
        controller.sendActions(List.of(ActionRequest.of("ask_card", payload)));
    }

    private static String extractMemberId(DameNatureViewState.CardView card) {
        if (card == null) {
            return "";
        }
        if (card.code() != null && card.code().startsWith("family:")) {
            String[] parts = card.code().split(":");
            return parts.length >= 3 ? parts[2] : card.memberName();
        }
        return card.memberName();
    }
}
