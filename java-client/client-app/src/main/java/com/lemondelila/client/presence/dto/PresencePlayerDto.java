package com.lemondelila.client.presence.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class PresencePlayerDto {

    private int id;
    private String username;
    private PresenceRoomDto currentRoom;

    public int id() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String username() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public PresenceRoomDto currentRoom() {
        return currentRoom;
    }

    public void setCurrentRoom(PresenceRoomDto currentRoom) {
        this.currentRoom = currentRoom;
    }
}
