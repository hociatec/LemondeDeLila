package com.lemondelila.client.presence.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.LilaFrame;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.room.browser.service.RoomDirectoryService;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.view.RoomTableScreen;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.event.PresenceErrorEvent;
import com.lemondelila.client.presence.event.PresenceEvent;
import com.lemondelila.client.presence.event.PresenceEventListener;
import com.lemondelila.client.presence.event.PresenceStateChangedEvent;
import com.lemondelila.client.presence.event.PresenceUpdateEvent;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.service.PresenceRealtimeService;
import com.lemondelila.client.presence.view.PresenceListView;
import com.lemondelila.client.presence.view.PresencePlayerActionMenu;
import com.lemondelila.client.presence.view.PresencePlayerRenderer;
import com.lemondelila.client.user.model.ClientSession;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.swing.AbstractAction;
import javax.swing.DefaultListModel;
import javax.swing.JList;
import javax.swing.KeyStroke;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import java.awt.Point;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Coordonne la logique métier / réseau de la fenêtre de présence.
 */
public final class PresenceListController {

    private static final Comparator<PresencePlayer> DISPLAY_ORDER = Comparator
            .comparingInt(PresenceListController::activityRank)
            .thenComparing(PresencePlayer::username, String.CASE_INSENSITIVE_ORDER);

    private final Window owner;
    private final DialogService dialogService;
    private final MessagingController messagingController;
    private final UserRelationshipService relationshipService;
    private final PresenceRealtimeService realtimeService;
    private final PresenceListView view;
    private final RoomDirectoryService roomDirectoryService;
    private final RoomDetailsState roomDetailsState;
    private final TableState tableState;
    private final ClientSession session;
    private final ObjectMapper mapper;
    private final Runnable closeDialog;
    private final PresencePlayerActionMenu actionMenu;
    private final PresenceEventListener eventListener = this::handleEvent;

    public PresenceListController(Window owner,
                                  DialogService dialogService,
                                  MessagingController messagingController,
                                  UserRelationshipService relationshipService,
                                  PresenceRealtimeService realtimeService,
                                  PresenceListView view,
                                  RoomDirectoryService roomDirectoryService,
                                  RoomDetailsState roomDetailsState,
                                  TableState tableState,
                                  ClientSession session,
                                  ObjectMapper mapper,
                                  Runnable closeDialog) {
        this.owner = owner;
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        this.view = Objects.requireNonNull(view, "view");
        this.roomDirectoryService = Objects.requireNonNull(roomDirectoryService, "roomDirectoryService");
        this.roomDetailsState = Objects.requireNonNull(roomDetailsState, "roomDetailsState");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.session = Objects.requireNonNull(session, "session");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.closeDialog = closeDialog;
        this.actionMenu = new PresencePlayerActionMenu(
                this::openConversation,
                this::joinPlayerRoom,
                this::invitePlayerToMyRoom,
                this::toggleFriend,
                this::toggleBlock,
                relationshipService,
                this::canInvite
        );
    }

    public void start() {
        view.setListEnabled(false);
        configureListInteractions();
        realtimeService.addListener(eventListener);
        realtimeService.start();
        List<PresencePlayer> latest = realtimeService.latestPresence();
        if (latest != null && !latest.isEmpty()) {
            updateList(latest);
        } else {
            updateStatus(Internationalization.text("presence.status.searching"));
        }
    }

    public void stop() {
        realtimeService.removeListener(eventListener);
        realtimeService.stop();
    }

    private void configureListInteractions() {
        JList<PresencePlayer> playerList = view.list();
        playerList.setCellRenderer(new PresencePlayerRenderer(relationshipService));
        playerList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "presence.actions");
        playerList.getActionMap().put("presence.actions", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                showAccessibleActions();
            }
        });
        playerList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isRightMouseButton(e)) {
                    int index = playerList.locationToIndex(e.getPoint());
                    if (index >= 0) {
                        playerList.setSelectedIndex(index);
                        PresencePlayer player = playerList.getSelectedValue();
                        if (player != null) {
                            List<String> options = actionMenu.showAt(player, playerList, e.getX(), e.getY());
                            updateStatusFromOptions(options);
                        }
                    }
                } else if (SwingUtilities.isLeftMouseButton(e) && e.getClickCount() == 2) {
                    int index = playerList.locationToIndex(e.getPoint());
                    if (index >= 0) {
                        playerList.setSelectedIndex(index);
                        showAccessibleActions();
                    }
                }
            }
        });
    }

    private void updateList(List<PresencePlayer> players) {
        DefaultListModel<PresencePlayer> model = view.model();
        model.clear();
        if (players == null || players.isEmpty()) {
            updateStatus(Internationalization.text("presence.status.none"));
            view.setListEnabled(false);
            return;
        }
        players.stream()
                .filter(Objects::nonNull)
                .sorted(DISPLAY_ORDER)
                .forEach(model::addElement);
        view.setListEnabled(true);
        updateStatus(formatPlayerCount(players.size()));
        view.list().setSelectedIndex(0);
        view.list().revalidate();
        view.list().repaint();
    }

    private String formatPlayerCount(int size) {
        return size == 1
                ? Internationalization.text("presence.status.playercount.single")
                : Internationalization.text("presence.status.playercount.multiple", size);
    }

    private void showAccessibleActions() {
        JList<PresencePlayer> playerList = view.list();
        int index = playerList.getSelectedIndex();
        if (index < 0) {
            updateStatus(Internationalization.text("presence.status.selection.prompt"));
            return;
        }
        PresencePlayer player = playerList.getSelectedValue();
        if (player == null) {
            updateStatus(Internationalization.text("presence.status.selection.empty"));
            return;
        }
        showActionsForSelection();
    }

    private void showActionsForSelection() {
        JList<PresencePlayer> playerList = view.list();
        int index = playerList.getSelectedIndex();
        if (index < 0) {
            return;
        }
        Point location = playerList.indexToLocation(index);
        if (location == null) {
            location = new Point(0, 0);
        }
        PresencePlayer selected = playerList.getSelectedValue();
        if (selected == null) {
            updateStatus(Internationalization.text("presence.status.selection.empty"));
            return;
        }
        List<String> options = actionMenu.showAt(selected, playerList,
                location.x + 16,
                location.y + playerList.getFixedCellHeight());
        updateStatusFromOptions(options);
    }

    private void toggleFriend(PresencePlayer player) {
        if (player == null) {
            return;
        }
        relationshipService.toggleFriend(player.id(), player.username());
        updateStatus(relationshipService.isFriend(player.id())
                ? Internationalization.text("presence.status.friend.added", player.username())
                : Internationalization.text("presence.status.friend.removed", player.username()));
        view.list().repaint();
    }

    private void toggleBlock(PresencePlayer player) {
        if (player == null) {
            return;
        }
        relationshipService.toggleBlock(player.id(), player.username());
        boolean blocked = relationshipService.isBlocked(player.id());
        updateStatus(blocked
                ? Internationalization.text("presence.status.blocked", player.username())
                : Internationalization.text("presence.status.unblocked", player.username()));
        view.list().repaint();
    }

    private void openConversation(PresencePlayer player) {
        if (player == null) {
            return;
        }
        messagingController.openConversation(owner, player);
    }

    private boolean canInvite(PresencePlayer player) {
        if (player == null) return false;
        Integer myUserId = currentUserId();
        if (myUserId != null && player.id() == myUserId) return false;
        Integer myRoomId = currentRoomId();
        if (myRoomId == null) return false;
        if (!tableState.isPrivate()) return false;
        Integer ownerId = tableState.ownerId();
        if (ownerId == null || myUserId == null) return false;
        return ownerId.equals(myUserId);
    }

    private Integer currentRoomId() {
        Integer id = tableState.roomId();
        if (id != null) return id;
        return roomDetailsState.roomId();
    }

    private Integer currentUserId() {
        String token = session.authenticated().map(ClientSession.AuthState::token).orElse(null);
        if (token == null || token.isBlank()) return null;
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]));
            JsonNode node = mapper.readTree(payload);
            if (node.has("id") && node.get("id").isInt()) {
                return node.get("id").asInt();
            }
            if (node.has("userId") && node.get("userId").isInt()) {
                return node.get("userId").asInt();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void joinPlayerRoom(PresencePlayer player) {
        if (player == null || player.currentRoom() == null) {
            updateStatus("Aucune table à rejoindre pour ce joueur.");
            return;
        }
        int roomId = player.currentRoom().id();
        try {
            var joined = roomDirectoryService.joinPublicRoom(roomId);
            roomDetailsState.setRoomId(joined.roomId());
            roomDetailsState.setGameType(joined.gameType());
            roomDetailsState.setRoomName(joined.roomName());
            String roomName = joined.roomName() == null || joined.roomName().isBlank()
                    ? "#" + joined.roomId()
                    : "\"" + joined.roomName().trim() + "\" (#" + joined.roomId() + ")";
            updateStatus("Table rejointe " + roomName + ".");
            navigateToRoomTable();
        } catch (Exception ex) {
            updateStatus("Impossible de rejoindre: " + ex.getMessage());
        }
    }

    private void invitePlayerToMyRoom(PresencePlayer player) {
        if (player == null) return;
        if (!canInvite(player)) {
            updateStatus("Invitation impossible (vous n'êtes pas propriétaire).");
            return;
        }
        Integer roomId = currentRoomId();
        if (roomId == null) return;
        try {
            roomDirectoryService.sendInvite(roomId, player.id());
            updateStatus("Invitation envoyée à " + player.username() + ".");
        } catch (Exception ex) {
            updateStatus("Invitation impossible: " + ex.getMessage());
        }
    }

    private void navigateToRoomTable() {
        if (closeDialog != null) {
            SwingUtilities.invokeLater(closeDialog);
        }
        if (owner instanceof LilaFrame frame) {
            ScreenManager manager = frame.screenManager();
            SwingUtilities.invokeLater(() -> manager.show(RoomTableScreen.ID));
        }
    }

    private void updateStatus(String message) {
        view.setStatus(message);
    }

    private void updateStatusFromOptions(List<String> options) {
        if (options.isEmpty()) {
            updateStatus(Internationalization.text("presence.status.action.none"));
        } else if (options.size() == 1) {
            updateStatus(Internationalization.text("presence.status.action.single", options.get(0)));
        } else {
            updateStatus(Internationalization.text("presence.status.action.multiple"));
        }
    }

    private static int activityRank(PresencePlayer player) {
        return switch (player.activity()) {
            case TABLE -> 0;
            case CHAT -> 1;
            case HOME -> 2;
            default -> 3;
        };
    }

    private void handleEvent(PresenceEvent event) {
        if (event instanceof PresenceUpdateEvent update) {
            SwingUtilities.invokeLater(() -> updateList(update.players()));
        } else if (event instanceof PresenceStateChangedEvent stateChanged) {
            handleStateChange(stateChanged);
        } else if (event instanceof PresenceErrorEvent errorEvent) {
            SwingUtilities.invokeLater(() ->
            dialogService.error(Internationalization.text("presence.dialog.title"), errorEvent.message()));
        }
    }

    private void handleStateChange(PresenceStateChangedEvent stateChanged) {
        ChatState state = stateChanged.state();
        if (state == ChatState.FAILED) {
            SwingUtilities.invokeLater(() ->
                    updateStatus(Internationalization.text("presence.status.state.failed")));
        } else if (state == ChatState.CONNECTED) {
            SwingUtilities.invokeLater(() ->
                    updateStatus(Internationalization.text("presence.status.state.connected")));
        } else if (state == ChatState.CONNECTING) {
            SwingUtilities.invokeLater(() ->
                    updateStatus(Internationalization.text("presence.status.state.connecting")));
        }
    }
}
