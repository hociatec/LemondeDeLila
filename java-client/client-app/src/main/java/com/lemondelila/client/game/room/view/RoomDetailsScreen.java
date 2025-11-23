package com.lemondelila.client.game.room.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.model.TableState;

import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;

public final class RoomDetailsScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("room-details");

    private final RoomDetailsState state;
    private final TableState tableState;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final JTextArea area = new JTextArea();

    @Inject
    public RoomDetailsScreen(DomainEventBus eventBus,
                             RoomDetailsState state,
                             TableState tableState) {
        super(new BorderLayout());
        this.state = state;
        this.tableState = tableState;
        subscriptions.subscribe(eventBus, RoomUpdated.class, e -> {
            if (e.room() == null || e.room().id() == null) return;
            if (!e.room().id().equals(state.roomId())) return;
            SwingUtilities.invokeLater(() -> renderRoom(e.room()));
        });
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
        renderCurrent();
    }

    private void renderCurrent() {
        Integer roomId = state.roomId();
        if (roomId == null) {
            area.setText("Aucune table sélectionnée.");
            return;
        }
        int participants = tableState.players().size() + tableState.bots().size();
        String gameType = tableState.gameType() == null ? "?" : tableState.gameType();
        String name = "Table #" + roomId;
        String privacy = tableState.isPrivate() ? "Privée" : "Publique";
        String txt = String.format("Table #%d%nNom: %s%nJeu: %s%nStatut: %s%nConfidentialité: %s%nParticipants: %d",
                roomId,
                name,
                gameType,
                tableState.status() == null ? "?" : tableState.status(),
                privacy,
                participants);
        area.setText(txt);
    }

    private void renderRoom(RoomState room) {
        String txt = String.format("Table #%d%nNom: %s%nJeu: %s%nStatut: %s%nConfidentialité: %s%nJoueurs: %d",
                room.id(),
                room.name() == null ? "?" : room.name(),
                room.gameType() == null ? "?" : room.gameType(),
                room.status() == null ? "?" : room.status(),
                room.isPrivate() ? "Privée" : "Publique",
                room.counts() != null ? room.counts().players() : tableState.players().size() + tableState.bots().size());
        area.setText(txt);
    }

    @Override
    public void removeNotify() {
        super.removeNotify();
        subscriptions.close();
    }
}
