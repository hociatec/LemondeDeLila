package com.lemondelila.client.game.presentation;

import com.lemondelila.client.game.model.GameSession;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Implémentation de base d'un présentateur de jeu.
 * Elle gère l'abonnement aux mises à jour de session et le cycle de vie écran.
 */
public abstract class AbstractGamePresenter<S extends GameSession<?>>
        implements GameScreenContract.Presenter<S> {

    private final Consumer<Consumer<S>> listenerRegistrar;
    private final Consumer<Consumer<S>> listenerRemover;
    private final Supplier<Optional<S>> snapshotSupplier;

    private GameScreenContract.View<S> view;
    private Consumer<S> sessionListener;

    protected AbstractGamePresenter(Consumer<Consumer<S>> listenerRegistrar,
                                    Consumer<Consumer<S>> listenerRemover,
                                    Supplier<Optional<S>> snapshotSupplier) {
        this.listenerRegistrar = Objects.requireNonNull(listenerRegistrar, "listenerRegistrar");
        this.listenerRemover = Objects.requireNonNull(listenerRemover, "listenerRemover");
        this.snapshotSupplier = Objects.requireNonNull(snapshotSupplier, "snapshotSupplier");
    }

    @Override
    public final void bind(GameScreenContract.View<S> view) {
        this.view = Objects.requireNonNull(view, "view");
    }

    protected final GameScreenContract.View<S> view() {
        if (view == null) {
            throw new IllegalStateException("Game view not bound.");
        }
        return view;
    }

    protected final boolean isViewBound() {
        return view != null;
    }

    @Override
    public void onShow() {
        if (view == null) {
            return;
        }
        if (sessionListener == null) {
            sessionListener = this::handleSessionUpdate;
        }
        listenerRegistrar.accept(sessionListener);
        snapshotSupplier.get().ifPresent(this::handleSessionUpdate);
    }

    @Override
    public void onHide() {
        if (sessionListener != null) {
            listenerRemover.accept(sessionListener);
        }
    }

    /**
     * Laisse la sous-classe appliquer la session à sa vue concrète.
     */
    protected abstract void handleSessionUpdate(S session);
}
