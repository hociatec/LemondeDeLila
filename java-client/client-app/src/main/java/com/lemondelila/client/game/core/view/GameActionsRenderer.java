package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.PendingActionSelector;

import javax.swing.DefaultListModel;
import javax.swing.JList;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.IntConsumer;

public final class GameActionsRenderer {

    private final ObjectMapper mapper;
    private final PendingActionSelector pendingActionSelector;
    private final DefaultListModel<GenericGameState.GenericAction> actionsModel;
    private final JList<GenericGameState.GenericAction> actionsList;
    private final Consumer<GenericGameState> discardOptionsRefresher;
    private final Runnable exchangeInfoRefresher;
    private final IntConsumer exchangeSelectionAnnouncer;

    public GameActionsRenderer(ObjectMapper mapper,
                               PendingActionSelector pendingActionSelector,
                               DefaultListModel<GenericGameState.GenericAction> actionsModel,
                               JList<GenericGameState.GenericAction> actionsList,
                               Consumer<GenericGameState> discardOptionsRefresher,
                               Runnable exchangeInfoRefresher,
                               IntConsumer exchangeSelectionAnnouncer) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.pendingActionSelector = Objects.requireNonNull(pendingActionSelector, "pendingActionSelector");
        this.actionsModel = Objects.requireNonNull(actionsModel, "actionsModel");
        this.actionsList = Objects.requireNonNull(actionsList, "actionsList");
        this.discardOptionsRefresher = Objects.requireNonNull(discardOptionsRefresher, "discardOptionsRefresher");
        this.exchangeInfoRefresher = Objects.requireNonNull(exchangeInfoRefresher, "exchangeInfoRefresher");
        this.exchangeSelectionAnnouncer = Objects.requireNonNull(exchangeSelectionAnnouncer, "exchangeSelectionAnnouncer");
    }

    public void render(GenericGameState state, boolean exchangePending) {
        actionsModel.clear();
        if (state != null && state.actions() != null) {
            state.actions().forEach(actionsModel::addElement);
        }
        discardOptionsRefresher.accept(state);
        if (actionsModel.isEmpty()) {
            return;
        }

        selectActionForPending(state);
        if (exchangePending) {
            exchangeInfoRefresher.run();
            int selected = actionsList.getSelectedIndex();
            exchangeSelectionAnnouncer.accept(selected < 0 ? 0 : selected);
        }
    }

    private void selectActionForPending(GenericGameState state) {
        String pendingType = extractPendingType(state);
        int selected = pendingActionSelector.selectIndex(
                availableActionsSnapshot(),
                pendingType,
                a -> a instanceof GenericGameState.GenericAction ga ? ga.type() : null
        );
        if (selected < 0) {
            return;
        }
        actionsList.setSelectedIndex(selected);
        actionsList.ensureIndexIsVisible(selected);
    }

    private List<GenericGameState.GenericAction> availableActionsSnapshot() {
        ArrayList<GenericGameState.GenericAction> out = new ArrayList<>();
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction action = actionsModel.get(i);
            if (action != null) {
                out.add(action);
            }
        }
        return out;
    }

    private String extractPendingType(GenericGameState state) {
        if (state == null) return null;
        Object pendingRaw = state.pending();
        if (pendingRaw instanceof JsonNode node) {
            return node.path("type").asText("");
        }
        if (pendingRaw != null) {
            JsonNode node = mapper.valueToTree(pendingRaw);
            return node.path("type").asText("");
        }
        return null;
    }
}

