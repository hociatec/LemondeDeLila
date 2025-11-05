package com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model;

import java.util.List;

public class MissionNemesisState {
    private List<PlayerState> players;
    private int turnIndex;
    private String status;
    private Integer winner;

    public List<PlayerState> getPlayers() {
        return players;
    }

    public void setPlayers(List<PlayerState> players) {
        this.players = players;
    }

    public int getTurnIndex() {
        return turnIndex;
    }

    public void setTurnIndex(int turnIndex) {
        this.turnIndex = turnIndex;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getWinner() {
        return winner;
    }

    public void setWinner(Integer winner) {
        this.winner = winner;
    }

    public static class PlayerState {
        private int id;
        private String username;
        private List<ShipState> ships;
        private List<ShotState> shots;

        public int getId() {
            return id;
        }

        public void setId(int id) {
            this.id = id;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public List<ShipState> getShips() {
            return ships;
        }

        public void setShips(List<ShipState> ships) {
            this.ships = ships;
        }

        public List<ShotState> getShots() {
            return shots;
        }

        public void setShots(List<ShotState> shots) {
            this.shots = shots;
        }
    }

    public static class ShipState {
        private String name;
        private List<CoordState> coords;
        private List<Boolean> hits;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public List<CoordState> getCoords() {
            return coords;
        }

        public void setCoords(List<CoordState> coords) {
            this.coords = coords;
        }

        public List<Boolean> getHits() {
            return hits;
        }

        public void setHits(List<Boolean> hits) {
            this.hits = hits;
        }
    }

    public static class ShotState {
        private int x;
        private int y;
        private boolean hit;

        public int getX() {
            return x;
        }

        public void setX(int x) {
            this.x = x;
        }

        public int getY() {
            return y;
        }

        public void setY(int y) {
            this.y = y;
        }

        public boolean isHit() {
            return hit;
        }

        public void setHit(boolean hit) {
            this.hit = hit;
        }
    }

    public static class CoordState {
        private int x;
        private int y;

        public int getX() {
            return x;
        }

        public void setX(int x) {
            this.x = x;
        }

        public int getY() {
            return y;
        }

        public void setY(int y) {
            this.y = y;
        }
    }
}
