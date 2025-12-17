package com.lemondelila.client.game.room.model;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Stocke les invitations de table reçues pour pouvoir les accepter
 * depuis différentes interfaces (ex : liste de présence ou raccourcis globaux).
 */
public final class PendingRoomInvites {

    private final Map<String, RoomInvite> byId = new LinkedHashMap<>();
    private final Map<Integer, String> bySender = new LinkedHashMap<>();
    private final Map<Integer, String> byRoom = new LinkedHashMap<>();
    private String lastInvitationId;

    public synchronized void put(RoomInvite invite) {
        if (invite == null || invite.invitationId() == null || invite.invitationId().isBlank()) {
            return;
        }
        remove(invite.invitationId());

        String existingFromSender = bySender.remove(invite.fromUserId());
        if (existingFromSender != null && !existingFromSender.equals(invite.invitationId())) {
            byId.remove(existingFromSender);
        }
        String existingForRoom = byRoom.remove(invite.roomId());
        if (existingForRoom != null && !existingForRoom.equals(invite.invitationId())) {
            byId.remove(existingForRoom);
        }

        byId.put(invite.invitationId(), invite);
        bySender.put(invite.fromUserId(), invite.invitationId());
        byRoom.put(invite.roomId(), invite.invitationId());
        lastInvitationId = invite.invitationId();
    }

    public synchronized RoomInvite latest() {
        if (lastInvitationId != null) {
            RoomInvite invite = byId.get(lastInvitationId);
            if (invite != null) {
                return invite;
            }
        }
        return byId.values().stream().reduce((first, second) -> second).orElse(null);
    }

    public synchronized RoomInvite findBySender(Integer senderId) {
        if (senderId == null) return null;
        String id = bySender.get(senderId);
        return id == null ? null : byId.get(id);
    }

    public synchronized RoomInvite findByRoom(Integer roomId) {
        if (roomId == null) return null;
        String id = byRoom.get(roomId);
        return id == null ? null : byId.get(id);
    }

    public synchronized RoomInvite remove(String invitationId) {
        if (invitationId == null) return null;
        RoomInvite removed = byId.remove(invitationId);
        if (removed != null) {
            bySender.values().removeIf(id -> Objects.equals(id, invitationId));
            byRoom.values().removeIf(id -> Objects.equals(id, invitationId));
            if (Objects.equals(lastInvitationId, invitationId)) {
                lastInvitationId = byId.isEmpty() ? null : byId.keySet().stream().reduce((first, second) -> second).orElse(null);
            }
        }
        return removed;
    }

    public synchronized void clear() {
        byId.clear();
        bySender.clear();
        byRoom.clear();
        lastInvitationId = null;
    }
}
