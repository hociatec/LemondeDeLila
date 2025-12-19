package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.PlayerCollectionsViewModel;

import java.util.Objects;
import java.util.Optional;

public final class GamePlayerCollectionsRenderer {

    private final PlayerCollectionsViewModel viewModel;

    public GamePlayerCollectionsRenderer(PlayerCollectionsViewModel viewModel) {
        this.viewModel = Objects.requireNonNull(viewModel, "viewModel");
    }

    public Optional<PlayerCollectionsViewModel.ResolvedView> resolve(GenericGameState state, Integer localUserId, String localUsername) {
        if (state == null) {
            return Optional.empty();
        }
        JsonNode extrasNode = state.extras();
        return viewModel.resolve(extrasNode, localUserId, localUsername);
    }
}

