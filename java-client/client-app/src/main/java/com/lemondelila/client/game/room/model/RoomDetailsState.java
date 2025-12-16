package com.lemondelila.client.game.room.model;

public final class RoomDetailsState {
    private Integer roomId;
    private String gameType;
    private String roomName;

    public Integer roomId() {
        return roomId;
    }

    public void setRoomId(Integer roomId) {
        this.roomId = roomId;
    }

    public String gameType() {
        return gameType;
    }

    public void setGameType(String gameType) {
        this.gameType = gameType;
    }

    public String roomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }
}
