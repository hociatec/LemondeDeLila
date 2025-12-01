package com.lemondelila.client.game.room.view;

import com.lemondelila.client.menu.view.MainMenuScreen;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.core.view.GameDialog;
import com.lemondelila.client.game.core.view.GameTableScreen;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.event.LeaveRoomRequested;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.shortcut.controller.TableShortcutManager;

import javax.swing.JComponent;
import javax.swing.JPanel;
import java.util.Objects;

/**
 * Socle commun pour les écrans de table : raccourcis (Tab/Shift+Tab, q, bots),
 * historique + narration via GameAnnouncer.
 */
public abstract class BaseTableScreen extends JPanel implements Screen, GameTableScreen {

    private final RoomDetailsState detailsState;
    private final TableShortcutManager shortcuts;
    private final GameAnnouncer announcer;
    private final GameHistorySidebar historySidebar;
    private final DomainEventBus eventBus;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private ScreenManager screenManager;

    protected BaseTableScreen(RoomDetailsState detailsState,
                              TableShortcutManager shortcuts,
                              GameAnnouncer announcer,
                              GameHistorySidebar historySidebar,
                              DomainEventBus eventBus) {
        this.detailsState = Objects.requireNonNull(detailsState, "detailsState");
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
        this.announcer = Objects.requireNonNull(announcer, "announcer");
        this.historySidebar = Objects.requireNonNull(historySidebar, "historySidebar");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
    }

    protected abstract JPanel interactionPanel();

    protected GameAnnouncer announcer() {
        return announcer;
    }

    protected GameHistorySidebar historySidebar() {
        return historySidebar;
    }

    protected DomainEventBus eventBus() {
        return eventBus;
    }

    protected RoomDetailsState detailsState() {
        return detailsState;
    }

    protected EventSubscriptions subscriptions() {
        return subscriptions;
    }

    protected void installShortcuts(JComponent interaction, JComponent history) {
        interaction.setFocusable(true);
        history.setFocusable(true);
        // Désactive la navigation Tab par défaut pour que nos bindings captent les touches.
        interaction.setFocusTraversalKeysEnabled(false);
        history.setFocusTraversalKeysEnabled(false);
        this.setFocusTraversalKeysEnabled(false);
        KeyboardBindings.disableTabTraversal(interaction);
        KeyboardBindings.disableTabTraversal(history);
        shortcuts.installNavigation(this, interaction, history);
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        // Rien par défaut
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        subscriptions.close();
    }

    protected void handleQuit() {
        Integer roomId = detailsState.roomId();
        boolean confirmed = GameDialog.confirm(this, "Quitter la table", "Etes-vous sur de quitter la table ?");
        if (!confirmed) {
            return;
        }
        announcer.announce(historySidebar, "Demande de sortie de la table.");
        if (roomId != null) {
            eventBus.publish(new LeaveRoomRequested(roomId));
        }
        if (screenManager != null) {
            screenManager.show(MainMenuScreen.ID);
        }
    }

    protected void handleAddBot() {
        // Laisser les sous-classes choisir comment publier les events (RoomDetailsState etc.).
    }

    protected void handleRemoveBot() {
        // Laisser les sous-classes choisir comment publier les events.
    }
}
