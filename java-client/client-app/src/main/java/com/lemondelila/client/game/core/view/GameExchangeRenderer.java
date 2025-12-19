package com.lemondelila.client.game.core.view;

import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.GameExchangeNavigator;
import com.lemondelila.client.game.room.model.TableState;

import javax.swing.DefaultListModel;
import javax.swing.JList;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;

public final class GameExchangeRenderer {

    private final TableState tableState;
    private final GameExchangeNavigator exchangeNavigator;
    private final DefaultListModel<GenericGameState.GenericAction> actionsModel;
    private final JList<GenericGameState.GenericAction> actionsList;
    private final Function<Object, Map<String, Object>> payloadMapper;
    private final Consumer<String> announcer;
    private final Consumer<String> infoLabelSetter;

    public GameExchangeRenderer(TableState tableState,
                                GameExchangeNavigator exchangeNavigator,
                                DefaultListModel<GenericGameState.GenericAction> actionsModel,
                                JList<GenericGameState.GenericAction> actionsList,
                                Function<Object, Map<String, Object>> payloadMapper,
                                Consumer<String> announcer,
                                Consumer<String> infoLabelSetter) {
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.exchangeNavigator = Objects.requireNonNull(exchangeNavigator, "exchangeNavigator");
        this.actionsModel = Objects.requireNonNull(actionsModel, "actionsModel");
        this.actionsList = Objects.requireNonNull(actionsList, "actionsList");
        this.payloadMapper = Objects.requireNonNull(payloadMapper, "payloadMapper");
        this.announcer = Objects.requireNonNull(announcer, "announcer");
        this.infoLabelSetter = Objects.requireNonNull(infoLabelSetter, "infoLabelSetter");
    }

    public void handleNavigation(int delta, boolean exchangePending) {
        if (!exchangePending || actionsModel.isEmpty()) {
            return;
        }
        int size = actionsModel.size();
        int current = exchangeNavigator.nextIndex(actionsList.getSelectedIndex(), size, delta);
        if (current < 0) return;
        actionsList.setSelectedIndex(current);
        actionsList.ensureIndexIsVisible(current);
        announceSelectionIfNeeded(current, exchangePending);
        refreshInfoLabel(exchangePending);
    }

    public void refreshInfoLabel(boolean exchangePending) {
        if (!exchangePending || actionsModel.isEmpty()) {
            exchangeNavigator.reset();
            return;
        }
        int idx = actionsList.getSelectedIndex();
        if (idx < 0 || idx >= actionsModel.size()) {
            idx = 0;
            actionsList.setSelectedIndex(idx);
        }
        GenericGameState.GenericAction act = actionsModel.get(idx);
        infoLabelSetter.accept(buildExchangeLabel(act, idx, actionsModel.size()));
    }

    public void announceSelectionIfNeeded(int index, boolean exchangePending) {
        if (!exchangeNavigator.shouldAnnounce(index, exchangePending, actionsModel.size())) {
            return;
        }
        GenericGameState.GenericAction act = actionsModel.get(index);
        announcer.accept(buildExchangeLabel(act, index, actionsModel.size()));
    }

    private String buildExchangeLabel(GenericGameState.GenericAction action, int index, int total) {
        Map<String, Object> payload = payloadMapper.apply(action.payload());
        Object target = payload.getOrDefault("targetPlayerId", "?");
        Object give = payload.getOrDefault("give", "?");
        Object take = payload.getOrDefault("take", "?");
        String targetName = resolveNameForId(target);
        return "Échanger " + give + " contre " + take + " avec " + targetName + " (" + (index + 1) + "/" + total + ")";
    }

    private String resolveNameForId(Object idObj) {
        if (idObj == null) return "?";
        try {
            Integer id = Integer.valueOf(idObj.toString());
            for (var p : tableState.players()) {
                if (p != null && p.id() != null && p.id().equals(id)) {
                    return p.username() == null || p.username().isBlank() ? "Joueur" : p.username();
                }
            }
            for (var b : tableState.bots()) {
                if (b != null && b.id() != null && b.id().equals(id)) {
                    return b.name() == null || b.name().isBlank() ? "Bot" : b.name();
                }
            }
            return "Joueur " + id;
        } catch (NumberFormatException e) {
            return idObj.toString();
        }
    }
}

