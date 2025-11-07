package com.lemondelila.client.gamelogic.missionnemesis.model;

import com.lemondelila.client.model.game.GameEngine;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Transposition c�t� client des r�gles de Mission N�m�sis afin que l'interface puisse
 * simuler et valider les actions avant synchronisation serveur.
 */
public final class MissionNemesisEngine implements GameEngine<MissionNemesisState, MissionNemesisEngine.Action, MissionNemesisEngine.PlayerIdentity> {

    private static final int BOARD_SIZE = 10;

    private static final Map<String, Integer> SHIPS;

    static {
        Map<String, Integer> ships = new HashMap<>();
        ships.put("Station spatiale", 5);
        ships.put("Trou noir stabilise", 4);
        ships.put("Asteroide defensif", 3);
        ships.put("Satellite longue portee", 3);
        ships.put("Sonde de reconnaissance", 2);
        SHIPS = Collections.unmodifiableMap(ships);
    }

    @Override
    public String type() {
        return "mission-nemesis";
    }

    @Override
    public MissionNemesisState defaultState(Iterable<PlayerIdentity> players) {
        List<MissionNemesisState.Player> converted = new ArrayList<>();
        for (PlayerIdentity player : players) {
            converted.add(new MissionNemesisState.Player(
                    player.id(),
                    player.username(),
                    new ArrayList<>(),
                    new ArrayList<>(),
                    "placing"
            ));
        }
        return new MissionNemesisState(
                type(),
                converted,
                0,
                "placement",
                null,
                1,
                new ArrayList<>()
        );
    }

    @Override
    public MissionNemesisState apply(MissionNemesisState state, Action action, PlayerIdentity actor) {
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(actor, "actor");

        MutableState mutable = new MutableState(state);
        int playerIndex = mutable.findPlayerIndex(actor.id());
        if (playerIndex < 0) {
            return state;
        }

        mutable.ensurePlayerFields(playerIndex);

        switch (mutable.status) {
            case "placement" -> {
                if (action instanceof PlaceShips placeShips) {
                    mutable = handlePlacement(mutable, playerIndex, placeShips);
                }
            }
            case "playing" -> {
                if (action instanceof FireShot fireShot) {
                    mutable = handleFire(mutable, playerIndex, fireShot);
                }
            }
            default -> {
                // Etat final : aucune action autorisée
            }
        }

        return mutable.toImmutable();
    }

    @Override
    public int currentRound(MissionNemesisState state) {
        return Math.max(1, state.round());
    }

    @Override
    public Score score(MissionNemesisState state) {
        List<MissionNemesisState.Player> players = state.players();
        Integer winnerId = "ended".equals(state.status()) ? state.winnerId() : null;
        Integer turnPlayerId = null;
        if (!"ended".equals(state.status()) && state.turnIndex() >= 0 && state.turnIndex() < players.size()) {
            turnPlayerId = players.get(state.turnIndex()).id();
        }
        return new Score(winnerId, turnPlayerId, currentRound(state));
    }

    public boolean isAligned(List<Coordinate> coords) {
        if (coords.size() < 2) {
            return true;
        }
        boolean horizontal = true;
        boolean vertical = true;
        int firstX = coords.get(0).x();
        int firstY = coords.get(0).y();
        for (Coordinate coord : coords) {
            if (coord.y() != firstY) {
                horizontal = false;
            }
            if (coord.x() != firstX) {
                vertical = false;
            }
        }
        return horizontal || vertical;
    }

    private MutableState handlePlacement(MutableState state, int playerIndex, PlaceShips action) {
        List<ShipPlacement> ships = action.ships();
        if (!validateShips(ships)) {
            return state;
        }

        MutablePlayer player = state.players.get(playerIndex);
        player.ships = prepareShips(ships);
        player.status = "ready";

        if (state.allPlayersReady()) {
            for (MutablePlayer each : state.players) {
                if (each.shots == null) {
                    each.shots = new ArrayList<>();
                }
                each.status = "alive";
            }
            state.status = "playing";
            state.turnIndex = Optional.ofNullable(state.nextActivePlayerIndex(-1)).orElse(0);
            state.round = 1;
            state.log.add(new MissionNemesisState.LogEntry("phase", "combat", null, null, null, null, null));
        }

        return state;
    }

    private boolean validateShips(List<ShipPlacement> ships) {
        if (ships.size() != SHIPS.size()) {
            return false;
        }

        Map<String, Boolean> usedNames = new HashMap<>();
        Map<String, Boolean> usedCoords = new HashMap<>();

        for (ShipPlacement ship : ships) {
            Integer size = SHIPS.get(ship.name());
            if (size == null || usedNames.containsKey(ship.name())) {
                return false;
            }
            usedNames.put(ship.name(), Boolean.TRUE);

            List<Coordinate> normalized = normalizeCoordinates(ship.coordinates());
            if (normalized.size() != size) {
                return false;
            }
            if (!isAligned(normalized) || !isConsecutive(normalized)) {
                return false;
            }

            for (Coordinate coord : normalized) {
                if (!isWithinBoard(coord)) {
                    return false;
                }
                String key = coord.x() + "-" + coord.y();
                if (usedCoords.containsKey(key)) {
                    return false;
                }
                usedCoords.put(key, Boolean.TRUE);
            }
        }
        return true;
    }

    private List<MutableShip> prepareShips(List<ShipPlacement> ships) {
        List<MutableShip> prepared = new ArrayList<>();
        for (ShipPlacement ship : ships) {
            List<Coordinate> coords = normalizeCoordinates(ship.coordinates());
            boolean[] hits = new boolean[coords.size()];
            prepared.add(new MutableShip(ship.name(), coords, hits));
        }
        return prepared;
    }

    private List<Coordinate> normalizeCoordinates(List<Coordinate> coords) {
        List<Coordinate> normalized = new ArrayList<>();
        for (Coordinate coord : coords) {
            normalized.add(new Coordinate(coord.x(), coord.y()));
        }
        normalized.sort(Comparator.<Coordinate>comparingInt(Coordinate::x)
                .thenComparingInt(Coordinate::y));
        return normalized;
    }

    private boolean isConsecutive(List<Coordinate> coords) {
        if (coords.size() < 2) {
            return true;
        }
        boolean horizontal = isHorizontal(coords);
        boolean vertical = isVertical(coords);
        if (!horizontal && !vertical) {
            return false;
        }
        for (int i = 1; i < coords.size(); i++) {
            Coordinate previous = coords.get(i - 1);
            Coordinate current = coords.get(i);
            if (horizontal) {
                if (current.x() != previous.x() + 1 || current.y() != previous.y()) {
                    return false;
                }
            } else {
                if (current.y() != previous.y() + 1 || current.x() != previous.x()) {
                    return false;
                }
            }
        }
        return true;
    }

    private boolean isHorizontal(List<Coordinate> coords) {
        if (coords.size() < 2) {
            return false;
        }
        int y = coords.get(0).y();
        for (Coordinate coord : coords) {
            if (coord.y() != y) {
                return false;
            }
        }
        return true;
    }

    private boolean isVertical(List<Coordinate> coords) {
        if (coords.size() < 2) {
            return false;
        }
        int x = coords.get(0).x();
        for (Coordinate coord : coords) {
            if (coord.x() != x) {
                return false;
            }
        }
        return true;
    }

    private MutableState handleFire(MutableState state, int playerIndex, FireShot action) {
        Coordinate coordinate = action.coordinate();
        if (coordinate == null || !isWithinBoard(coordinate)) {
            return state;
        }

        if (playerIndex != state.turnIndex) {
            return state;
        }

        Integer targetIndex = state.nextAliveOpponent(playerIndex);
        if (targetIndex == null) {
            return state;
        }

        MutablePlayer shooter = state.players.get(playerIndex);
        MutablePlayer target = state.players.get(targetIndex);
        if (state.hasAlreadyShot(shooter, coordinate, target.id)) {
            return state;
        }

        String result = state.registerShot(target, coordinate);

        shooter.shots.add(new MissionNemesisState.Shot(
                coordinate.x(),
                coordinate.y(),
                target.id,
                result
        ));

        state.log.add(new MissionNemesisState.LogEntry(
                "shot",
                null,
                shooter.id,
                target.id,
                coordinate.x(),
                coordinate.y(),
                result
        ));

        if (!"miss".equals(result) && target.hasNoSegmentsRemaining()) {
            target.status = "eliminated";
            state.log.add(new MissionNemesisState.LogEntry(
                    "elimination",
                    null,
                    null,
                    target.id,
                    null,
                    null,
                    null
            ));
        }

        if (state.countAlivePlayers() <= 1) {
            state.status = "ended";
            state.winnerId = shooter.id;
            return state;
        }

        Integer next = state.nextActivePlayerIndex(playerIndex);
        if (next != null) {
            if (next <= playerIndex) {
                state.round += 1;
            }
            state.turnIndex = next;
        }

        return state;
    }

    private boolean isWithinBoard(Coordinate coord) {
        return coord.x() >= 0 && coord.x() < BOARD_SIZE
                && coord.y() >= 0 && coord.y() < BOARD_SIZE;
    }

    public sealed interface Action permits PlaceShips, FireShot {
        String type();
    }

    public record PlaceShips(List<ShipPlacement> ships) implements Action {
        public PlaceShips {
            ships = List.copyOf(ships);
        }

        @Override
        public String type() {
            return "place_ships";
        }
    }

    public record FireShot(Coordinate coordinate) implements Action {
        @Override
        public String type() {
            return "fire";
        }
    }

    public record ShipPlacement(String name, List<Coordinate> coordinates) {
        public ShipPlacement {
            Objects.requireNonNull(name, "name");
            coordinates = List.copyOf(coordinates);
        }
    }

    public record Coordinate(int x, int y) {
    }

    public record PlayerIdentity(int id, String username) {
    }

    private static final class MutableState {
        private final List<MutablePlayer> players;
        private final List<MissionNemesisState.LogEntry> log;
        private String status;
        private Integer winnerId;
        private int turnIndex;
        private int round;

        private MutableState(MissionNemesisState source) {
            this.players = new ArrayList<>();
            for (MissionNemesisState.Player player : source.players()) {
                players.add(new MutablePlayer(player));
            }
            this.log = new ArrayList<>(source.log());
            this.status = source.status();
            this.winnerId = source.winnerId();
            this.turnIndex = source.turnIndex();
            this.round = Math.max(1, source.round());
        }

        private MissionNemesisState toImmutable() {
            List<MissionNemesisState.Player> immutablePlayers = new ArrayList<>();
            for (MutablePlayer player : players) {
                immutablePlayers.add(player.toImmutable());
            }
            return new MissionNemesisState(
                    "mission-nemesis",
                    immutablePlayers,
                    turnIndex,
                    status,
                    winnerId,
                    round,
                    new ArrayList<>(log)
            );
        }

        private int findPlayerIndex(int id) {
            for (int i = 0; i < players.size(); i++) {
                if (players.get(i).id == id) {
                    return i;
                }
            }
            return -1;
        }

        private void ensurePlayerFields(int index) {
            MutablePlayer player = players.get(index);
            if (player.shots == null) {
                player.shots = new ArrayList<>();
            }
            if (player.status == null) {
                player.status = "playing".equals(status) ? "alive" : "placing";
            }
        }

        private boolean allPlayersReady() {
            for (MutablePlayer player : players) {
                if (player.ships == null || player.ships.isEmpty()) {
                    return false;
                }
            }
            return true;
        }

        private Integer nextAliveOpponent(int current) {
            int count = players.size();
            for (int offset = 1; offset < count; offset++) {
                int candidate = (current + offset) % count;
                if ("alive".equals(players.get(candidate).status)) {
                    return candidate;
                }
            }
            return null;
        }

        private Integer nextActivePlayerIndex(int current) {
            int count = players.size();
            for (int offset = 1; offset <= count; offset++) {
                int candidate = (current + offset) % count;
                if ("alive".equals(players.get(candidate).status)) {
                    return candidate;
                }
            }
            return null;
        }

        private boolean hasAlreadyShot(MutablePlayer shooter, Coordinate coord, int targetId) {
            for (MissionNemesisState.Shot shot : shooter.shots) {
                if (shot.targetId() == targetId && shot.x() == coord.x() && shot.y() == coord.y()) {
                    return true;
                }
            }
            return false;
        }

        private String registerShot(MutablePlayer target, Coordinate coord) {
            for (MutableShip ship : target.ships) {
                for (int i = 0; i < ship.coordinates.size(); i++) {
                    Coordinate shipCoord = ship.coordinates.get(i);
                    if (shipCoord.x() == coord.x() && shipCoord.y() == coord.y()) {
                        if (ship.hits[i]) {
                            return "hit";
                        }
                        ship.hits[i] = true;
                        return ship.isSunk() ? "sunk" : "hit";
                    }
                }
            }
            return "miss";
        }

        private int countAlivePlayers() {
            int alive = 0;
            for (MutablePlayer player : players) {
                if ("alive".equals(player.status)) {
                    alive++;
                }
            }
            return alive;
        }
    }

    private static final class MutablePlayer {
        private final int id;
        private final String username;
        private List<MutableShip> ships;
        private List<MissionNemesisState.Shot> shots;
        private String status;

        private MutablePlayer(MissionNemesisState.Player player) {
            this.id = player.id();
            this.username = player.username();
            this.status = player.status();
            this.ships = new ArrayList<>();
            for (MissionNemesisState.Ship ship : player.ships()) {
                this.ships.add(new MutableShip(ship));
            }
            this.shots = new ArrayList<>(player.shots());
        }

        private boolean hasNoSegmentsRemaining() {
            for (MutableShip ship : ships) {
                if (!ship.isSunk()) {
                    return false;
                }
            }
            return true;
        }

        private MissionNemesisState.Player toImmutable() {
            List<MissionNemesisState.Ship> immutableShips = new ArrayList<>();
            for (MutableShip ship : ships) {
                immutableShips.add(ship.toImmutable());
            }
            List<MissionNemesisState.Shot> immutableShots = new ArrayList<>(shots);
            return new MissionNemesisState.Player(id, username, immutableShips, immutableShots, status);
        }
    }

    private static final class MutableShip {
        private final String name;
        private final List<Coordinate> coordinates;
        private final boolean[] hits;

        private MutableShip(String name, List<Coordinate> coordinates, boolean[] hits) {
            this.name = name;
            this.coordinates = new ArrayList<>(coordinates);
            this.hits = hits.clone();
        }

        private MutableShip(MissionNemesisState.Ship ship) {
            this.name = ship.name();
            this.coordinates = new ArrayList<>();
            for (MissionNemesisState.Coordinate coordinate : ship.coordinates()) {
                this.coordinates.add(new Coordinate(coordinate.x(), coordinate.y()));
            }
            this.hits = ship.hits().clone();
        }

        private boolean isSunk() {
            for (boolean hit : hits) {
                if (!hit) {
                    return false;
                }
            }
            return true;
        }

        private MissionNemesisState.Ship toImmutable() {
            List<MissionNemesisState.Coordinate> immutableCoords = new ArrayList<>();
            for (Coordinate coordinate : coordinates) {
                immutableCoords.add(new MissionNemesisState.Coordinate(coordinate.x(), coordinate.y()));
            }
            return new MissionNemesisState.Ship(name, immutableCoords, hits.clone());
        }
    }
}

