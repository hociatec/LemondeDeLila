package com.lemondelila.client.presence.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class PresencePlayerDto {

    private int id;
    private String username;
    private List<PresenceRoomDto> rooms;

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

    public List<PresenceRoomDto> rooms() {
        return rooms;
    }

    public void setRooms(List<PresenceRoomDto> rooms) {
        this.rooms = rooms;
    }
}
