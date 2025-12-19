package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.game.core.viewmodel.GameExchangeNavigator;
import com.lemondelila.client.game.core.viewmodel.PendingViewModel;

import java.util.Objects;

public final class GamePendingRenderer {

    public record Outcome(
            boolean exchangePending,
            boolean resetExchangeNavigator,
            boolean clearInfoLabelIfNotQuiz,
            String pendingLabel
    ) {}

    private final ObjectMapper mapper;
    private final PendingViewModel pendingViewModel;
    private final GameExchangeNavigator exchangeNavigator;

    public GamePendingRenderer(ObjectMapper mapper, PendingViewModel pendingViewModel, GameExchangeNavigator exchangeNavigator) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.pendingViewModel = Objects.requireNonNull(pendingViewModel, "pendingViewModel");
        this.exchangeNavigator = Objects.requireNonNull(exchangeNavigator, "exchangeNavigator");
    }

    public Outcome render(Object pending, boolean exchangePending, boolean infoLabelStartsWithQuiz) {
        boolean wasExchangePending = exchangePending;
        JsonNode node = pending == null ? null : mapper.valueToTree(pending);
        PendingViewModel.Result result = pendingViewModel.compute(node, wasExchangePending, exchangePending, infoLabelStartsWithQuiz);
        if (result.resetExchangeNavigator()) {
            exchangeNavigator.reset();
        }
        return new Outcome(
                result.exchangePending(),
                result.resetExchangeNavigator(),
                result.clearInfoLabelIfNotQuiz(),
                result.pendingLabel()
        );
    }
}

