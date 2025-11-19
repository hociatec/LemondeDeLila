package com.lemondelila.client.game.service;

import com.lemondelila.client.game.controller.GameControllerSupport;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.model.GameSession;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Service utilitaire pour g�rer l'ajout/retrait de bots dans une salle de jeu.
 */
public final class GameRoomBotManager<S extends GameSession<?>> {

    public record Messages(String noSession,
                           String addError,
                           String listError,
                           String removeError,
                           String noBotAvailable) {

        public static Messages defaults() {
            return new Messages(
                    "Aucune partie active pour gérer les bots.",
                    "Impossible d'ajouter un bot.",
                    "Impossible de récupérer la liste des bots.",
                    "Impossible de retirer le bot.",
                    "Aucun bot disponible."
            );
        }
    }

    private final RoomBotRemoteClient roomBots;
    private final DialogGameErrorHandler errorHandler;
    private final Supplier<Optional<S>> sessionSupplier;
    private final Supplier<CompletableFuture<S>> refresher;
    private final Function<S, Collection<String>> botNamesResolver;
    private final Messages messages;

    public GameRoomBotManager(RoomBotRemoteClient roomBots,
                              DialogGameErrorHandler errorHandler,
                              Supplier<Optional<S>> sessionSupplier,
                              Supplier<CompletableFuture<S>> refresher,
                              Function<S, Collection<String>> botNamesResolver,
                              Messages messages) {
        this.roomBots = Objects.requireNonNull(roomBots, "roomBots");
        this.errorHandler = Objects.requireNonNull(errorHandler, "errorHandler");
        this.sessionSupplier = Objects.requireNonNull(sessionSupplier, "sessionSupplier");
        this.refresher = Objects.requireNonNull(refresher, "refresher");
        this.botNamesResolver = Objects.requireNonNull(botNamesResolver, "botNamesResolver");
        this.messages = Objects.requireNonNull(messages, "messages");
    }

    public GameRoomBotManager(RoomBotRemoteClient roomBots,
                              DialogGameErrorHandler errorHandler,
                              Supplier<Optional<S>> sessionSupplier,
                              Supplier<CompletableFuture<S>> refresher,
                              Function<S, Collection<String>> botNamesResolver) {
        this(roomBots, errorHandler, sessionSupplier, refresher, botNamesResolver, Messages.defaults());
    }

    public CompletableFuture<S> addBot() {
        Optional<S> snapshot = sessionSupplier.get();
        if (snapshot.isEmpty()) {
            return GameControllerSupport.failedFuture(new IllegalStateException(messages.noSession()));
        }
        int roomId = snapshot.get().roomId();
        return roomBots.addBot(roomId)
                .handle((info, error) -> {
                    if (error != null) {
                        errorHandler.show(messages.addError(), error);
                        throw GameControllerSupport.propagate(error);
                    }
                    return info;
                })
                .thenCompose(ignored -> refresher.get());
    }

    public CompletableFuture<S> removeBot() {
        Optional<S> snapshot = sessionSupplier.get();
        if (snapshot.isEmpty()) {
            return GameControllerSupport.failedFuture(new IllegalStateException(messages.noSession()));
        }
        S session = snapshot.get();
        int roomId = session.roomId();
        return roomBots.listBots(roomId)
                .handle((bots, error) -> {
                    if (error != null) {
                        errorHandler.show(messages.listError(), error);
                        throw GameControllerSupport.propagate(error);
                    }
                    return bots;
                })
                .thenCompose(bots -> {
                    RoomBotRemoteClient.RoomBotInfo target = selectBotToRemove(session, bots);
                    if (target == null) {
                        return GameControllerSupport.failedFuture(new IllegalStateException(messages.noBotAvailable()));
                    }
                    return roomBots.removeBot(roomId, target.id())
                            .handle((ignored, error) -> {
                                if (error != null) {
                                    errorHandler.show(messages.removeError(), error);
                                    throw GameControllerSupport.propagate(error);
                                }
                                return null;
                            })
                            .thenCompose(ignored -> refresher.get());
                });
    }

    private RoomBotRemoteClient.RoomBotInfo selectBotToRemove(S session,
                                                              java.util.List<RoomBotRemoteClient.RoomBotInfo> bots) {
        if (bots == null || bots.isEmpty()) {
            return null;
        }
        Collection<String> knownNames = botNamesResolver.apply(session);
        if (knownNames != null && !knownNames.isEmpty()) {
            java.util.Set<String> lowerCase = knownNames.stream()
                    .filter(name -> name != null && !name.isBlank())
                    .map(name -> name.toLowerCase(Locale.ROOT))
                    .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
            for (RoomBotRemoteClient.RoomBotInfo bot : bots) {
                String botName = bot.name();
                if (botName != null && lowerCase.contains(botName.toLowerCase(Locale.ROOT))) {
                    return bot;
                }
            }
        }
        return bots.get(bots.size() - 1);
    }

    public static <S, P> Function<S, Collection<String>> botNamesResolver(Function<S, Collection<P>> playerExtractor,
                                                                          Function<P, Boolean> botPredicate,
                                                                          Function<P, String> usernameExtractor) {
        Objects.requireNonNull(playerExtractor, "playerExtractor");
        Objects.requireNonNull(botPredicate, "botPredicate");
        Objects.requireNonNull(usernameExtractor, "usernameExtractor");
        return session -> {
            Collection<P> players = playerExtractor.apply(session);
            if (players == null || players.isEmpty()) {
                return List.of();
            }
            Collection<String> names = new LinkedHashSet<>();
            for (P player : players) {
                if (player == null) {
                    continue;
                }
                Boolean isBot = botPredicate.apply(player);
                if (isBot == null || !isBot) {
                    continue;
                }
                String name = usernameExtractor.apply(player);
                if (name != null && !name.isBlank()) {
                    names.add(name);
                }
            }
            return names;
        };
    }
}
