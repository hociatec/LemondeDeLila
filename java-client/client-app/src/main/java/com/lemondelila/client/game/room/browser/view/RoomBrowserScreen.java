package com.lemondelila.client.game.room.browser.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.room.browser.model.PublicRoomSummary;
import com.lemondelila.client.game.room.browser.event.JoinRoomFailed;
import com.lemondelila.client.game.room.browser.event.JoinRoomRequested;
import com.lemondelila.client.game.room.browser.event.JoinRoomSucceeded;
import com.lemondelila.client.game.room.browser.event.PublicRoomsFailed;
import com.lemondelila.client.game.room.browser.event.PublicRoomsLoaded;
import com.lemondelila.client.game.room.browser.event.PublicRoomsRequested;
import com.lemondelila.client.game.room.view.RoomTableScreen;
import com.lemondelila.client.menu.view.MainMenuScreen;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class RoomBrowserScreen extends JPanel implements Screen, AutoCloseable {

    public static final ScreenId ID = ScreenId.of("room-browser");

    private final RoomBrowserView view;
    private final DomainEventBus eventBus;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private ScreenManager screenManager;

    @Inject
    public RoomBrowserScreen(RoomBrowserView view, DomainEventBus eventBus) {
        this.view = view;
        this.eventBus = eventBus;
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);

        view.onJoin(roomId -> eventBus.publish(new JoinRoomRequested(roomId)));

        // Échap = retour menu principal.
        getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("ESCAPE"), "go-back");
        getActionMap().put("go-back", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (screenManager != null) {
                    screenManager.show(MainMenuScreen.ID);
                }
            }
        });

        subscriptions.subscribe(eventBus, PublicRoomsLoaded.class, ev -> SwingUtilities.invokeLater(() -> {
            view.setRooms(groupByGame(ev.rooms()));
            if (ev.rooms().isEmpty()) {
                view.setStatus("Aucune table publique en cours.");
            } else {
                view.setStatus("Tables publiques chargées.");
            }
            view.focusList();
        }));
        subscriptions.subscribe(eventBus, PublicRoomsFailed.class, ev -> SwingUtilities.invokeLater(() -> view.setStatus("Erreur: " + ev.message())));
        subscriptions.subscribe(eventBus, JoinRoomSucceeded.class, ev -> {
            if (screenManager != null) {
                screenManager.show(RoomTableScreen.ID);
            }
        });
        subscriptions.subscribe(eventBus, JoinRoomFailed.class, ev -> SwingUtilities.invokeLater(() -> view.setStatus("Join impossible: " + ev.message())));
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        view.setStatus("Chargement...");
        eventBus.publish(new PublicRoomsRequested(null));
        view.focusList();
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
    }

    @Override
    public void close() {
        subscriptions.close();
    }

    private List<Object> groupByGame(List<PublicRoomSummary> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        Map<String, List<Object>> byGame = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        for (PublicRoomSummary room : rooms) {
            String gameType = room == null ? "" : room.gameType();
            byGame.computeIfAbsent(gameType == null ? "" : gameType, k -> new ArrayList<>()).add(room);
        }
        List<Object> merged = new ArrayList<>();
        for (var entry : byGame.entrySet()) {
            String key = entry.getKey() == null || entry.getKey().isBlank() ? "Autres" : entry.getKey();
            merged.add("=== " + key + " ===");
            merged.addAll(entry.getValue());
        }
        return merged;
    }

}
