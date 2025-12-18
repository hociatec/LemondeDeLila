package com.lemondelila.client.game.core.controller;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.service.GameInteractionRegistry;
import com.lemondelila.client.game.core.service.GameRealtimeClient;
import com.lemondelila.client.game.core.view.GameInteractionComponent;
import com.lemondelila.client.game.core.view.GenericGameInteractionComponent;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;
import com.lemondelila.client.game.room.event.StartRoomRequested;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.turn.controller.TurnController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

/**
 * Fournisseur générique qui sert pour tous les jeux (gameType="*").
 * Il crée un composant d'interaction générique qui s'appuie uniquement
 * sur l'état et la liste d'actions exposés par le serveur.
 */
public final class GenericUniversalInteractionProvider implements GameInteractionProvider {

    private static final Logger LOGGER = LoggerFactory.getLogger(GenericUniversalInteractionProvider.class);

    private final GameRealtimeClient realtimeClient;
    private final GameActionEmitter emitter;
    private final GameHistoryController history;
    private final TableState tableState;
    private final RoomDetailsState detailsState;
    private final FocusHighlighter focusHighlighter;
    private final Optional<GameQuizComponentFactory> quizFactory;
    private final DomainEventBus eventBus;
    private final TurnController turnController;

    @Inject
    public GenericUniversalInteractionProvider(GameInteractionRegistry registry,
                                               GameRealtimeClient realtimeClient,
                                               GameActionEmitter emitter,
                                               GameHistoryController history,
                                               TableState tableState,
                                               RoomDetailsState detailsState,
                                               TurnController turnController,
                                               FocusHighlighter focusHighlighter,
                                               Optional<GameQuizComponentFactory> quizFactory,
                                               DomainEventBus eventBus) {
        this.realtimeClient = realtimeClient;
        this.emitter = emitter;
        this.history = history;
        this.tableState = tableState;
        this.detailsState = detailsState;
        this.turnController = turnController;
        this.focusHighlighter = focusHighlighter;
        this.quizFactory = quizFactory;
        this.eventBus = eventBus;
        registry.register(this);
        LOGGER.info("[interaction-provider] registre provider générique gameType=*");
    }

    @Override
    public String gameType() {
        // Fournisseur par défaut pour tous les jeux.
        return "*";
    }

    @Override
    public GameInteractionComponent create() {
        LOGGER.info("[interaction-provider] create component gameType={}", resolvedGameType());
        GenericGameInteractionController controller = new GenericGameInteractionController(
                resolvedGameType(),
                realtimeClient,
                null, // pas d'action primaire par défaut
                tableState,
                2 // minimum participants par défaut, le serveur reste source de vérité
        );
        controller.setHistorySink(history::addStructured);
        return new GenericGameInteractionComponent(
                controller,
                emitter,
                history,
                tableState,
                turnController,
                focusHighlighter,
                quizFactory,
                (PrimaryActionDescriptor) null,
                this::requestStart,
                false
        );
    }

    private String resolvedGameType() {
        String type = tableState.gameType();
        if (type == null || type.isBlank()) {
            type = detailsState.gameType();
        }
        return (type == null || type.isBlank()) ? "generic" : type;
    }

    private void requestStart() {
        Integer roomId = tableState.roomId();
        if (roomId != null) {
            LOGGER.info("[interaction-provider] request start room={}", roomId);
            eventBus.publish(new StartRoomRequested(roomId));
        }
    }
}
