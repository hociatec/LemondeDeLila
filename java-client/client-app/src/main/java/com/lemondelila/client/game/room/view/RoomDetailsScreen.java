package com.lemondelila.client.game.room.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.service.RoomApiService;

import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import java.awt.BorderLayout;

public final class RoomDetailsScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("room-details");

    private final RoomApiService roomApi;
    private final RoomDetailsState state;
    private final TaskScheduler scheduler;
    private final JTextArea area = new JTextArea();

    @Inject
    public RoomDetailsScreen(RoomApiService roomApi,
                             RoomDetailsState state,
                             TaskScheduler scheduler) {
        super(new BorderLayout());
        this.roomApi = roomApi;
        this.state = state;
        this.scheduler = scheduler;
        area.setEditable(false);
        add(new JScrollPane(area), BorderLayout.CENTER);
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
        Integer roomId = state.roomId();
        if (roomId == null) {
            area.setText("Aucune table sélectionnée.");
            return;
        }
        area.setText("Chargement de la table " + roomId + "...");
        scheduler.runAsync(() -> {
            try {
                RoomState room = roomApi.fetchRoom(roomId);
                String txt = room != null
                        ? String.format("Table #%d\nNom: %s\nJeu: %s\nStatut: %s\nJoueurs: %d",
                        room.id(), room.name(), room.gameType(), room.status(), room.counts().players())
                        : "Table introuvable";
                area.setText(txt);
            } catch (Exception e) {
                area.setText("Erreur de chargement : " + e.getMessage());
            }
        });
    }
}
