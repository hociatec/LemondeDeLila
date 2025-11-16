package com.lemondelila.client.gamelogic.missionnemesis.presenter;

import com.lemondelila.client.framework.access.game.GameHistorySidebar;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisFooterPanel;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisGridPanel;

import javax.swing.JTextArea;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.stream.Collectors;

public final class NemesisSessionPresenter {

    private final NemesisGridPanel ownGrid;
    private final NemesisGridPanel enemyGrid;
    private final GameHistorySidebar historySidebar;
    private final NemesisFooterPanel footerPanel;
    private final Consumer<String> statusConsumer;
    private final GameHistoryTracker historyTracker = new GameHistoryTracker();

    public NemesisSessionPresenter(NemesisGridPanel ownGrid,
                                   NemesisGridPanel enemyGrid,
                                   GameHistorySidebar historySidebar,
                                   NemesisFooterPanel footerPanel,
                                   Consumer<String> statusConsumer) {
        this.ownGrid = ownGrid;
        this.enemyGrid = enemyGrid;
        this.historySidebar = historySidebar;
        this.footerPanel = footerPanel;
        this.statusConsumer = statusConsumer;
        historyTracker.setMaxEntries(400);
    }

    public boolean displaySession(NemesisSession session,
                                  boolean manualPlacementActive,
                                  Runnable showCombatHelp) {
        ownGrid.renderOwn(session, this::formatPlayerName);
        enemyGrid.renderEnemy(session, this::formatPlayerName);
        enemyGrid.setFiringEnabled(session.isAwaitingCombatTurn(), session);
        if (session.isAwaitingCombatTurn()) {
            enemyGrid.setFireSelectionListener(coordinate ->
                    statusConsumer.accept(selectionStatus(session, coordinate)));
        } else {
            enemyGrid.setFireSelectionListener(null);
        }
        updateHistory(session);
        updateParticipantSummary(session);
        updateMetadata(session, manualPlacementActive, showCombatHelp);
        return manualPlacementActive && !session.isPlacementRequired();
    }

    public String selectionStatus(NemesisSession session, GridCoordinate coordinate) {
        String base = "Cible : " + describeCoordinate(coordinate) + ". Entrée pour tirer.";
        if (session == null) {
            return base;
        }
        String opponents = describeOpponents(session);
        return opponents.isBlank() ? base : base + " Adversaire(s) : " + opponents + ".";
    }

    public String describeCoordinate(GridCoordinate coordinate) {
        if (coordinate == null) {
            return "(?, ?)";
        }
        return "(" + (coordinate.x() + 1) + "," + (coordinate.y() + 1) + ")";
    }

    public String describeParticipants(NemesisSession session) {
        if (session == null || session.state() == null) {
            return "Aucune partie active.";
        }
        List<NemesisState.Player> players = session.state().players();
        if (players == null || players.isEmpty()) {
            return "Aucun joueur autour de la table.";
        }
        StringBuilder builder = new StringBuilder();
        builder.append("Table de ").append(players.size())
                .append(players.size() > 1 ? " joueurs : " : " joueur : ");
        int selfId = session.self().map(NemesisState.Player::id).orElse(-1);
        for (int i = 0; i < players.size(); i++) {
            NemesisState.Player player = players.get(i);
            String display = formatDisplayName(player, i);
            if (player != null && player.id() == selfId) {
                display = display + " (vous)";
            }
            if (player != null && player.isBot()) {
                display = display + " (bot)";
            }
            builder.append(display);
            if (i < players.size() - 1) {
                builder.append(", ");
            }
        }
        return builder.toString();
    }

    public String describeCurrentTurn(NemesisState state) {
        if (state == null) {
            return "Aucune information de partie disponible.";
        }
        if (state.winnerId() != null) {
            return "La partie est terminée.";
        }
        List<NemesisState.Player> players = state.players();
        if (players == null || players.isEmpty()) {
            return "Aucun joueur autour de la table.";
        }
        int index = state.turnIndex();
        if (index < 0 || index >= players.size()) {
            return "Tour en cours inconnu.";
        }
        NemesisState.Player current = players.get(index);
        if (current == null) {
            return "Tour en cours inconnu.";
        }
        StringBuilder message = new StringBuilder("Tour de ").append(formatPlayerName(current));
        if (current.isBot()) {
            message.append(" (bot)");
        }
        if (current.isSelf()) {
            message.append(" (vous)");
        }
        if (state.round() > 0) {
            message.append(" - Manche ").append(state.round());
        }
        return message.toString();
    }

    public void reset() {
        historyTracker.clear();
    }

    private void updateMetadata(NemesisSession session,
                                boolean manualPlacementActive,
                                Runnable showCombatHelp) {
        NemesisState state = session.state();
        footerPanel.showRound(state.round());
        String phase = session.isPlacementRequired()
                ? "Placement"
                : session.finished() ? "Terminée" : "Combat";
        footerPanel.showPhase(phase);

        if (session.finished()) {
            session.score().ifPresentOrElse(score -> {
                if (score.winnerId() != null) {
                    String winner = findPlayerById(state, score.winnerId())
                            .map(this::formatPlayerName)
                            .orElse("Joueur " + score.winnerId());
                    statusConsumer.accept("Partie terminée. Vainqueur : " + winner + ".");
                } else {
                    statusConsumer.accept("Partie terminée. Égalité.");
                }
            }, () -> statusConsumer.accept("Partie terminée."));
            return;
        }

        if (session.isPlacementRequired() && !manualPlacementActive) {
            String pending = describePendingPlacement(session);
            statusConsumer.accept(pending.isBlank()
                    ? "Attente du placement adverse..."
                    : pending);
            return;
        }

        if (session.isAwaitingCombatTurn()) {
            String opponents = describeOpponents(session);
            if (opponents.isBlank()) {
                statusConsumer.accept("Choisissez une case à l’aide des flèches puis validez avec Entrée.");
            } else {
                statusConsumer.accept("À vous de jouer contre " + opponents + ". Choisissez une case à l’aide des flèches puis validez avec Entrée.");
            }
            showCombatHelp.run();
        } else {
            String waiting = describeCurrentTurnHolder(session);
            statusConsumer.accept(waiting.isBlank() ? "Attente du tour adverse..." : waiting);
        }
    }

    private void updateParticipantSummary(NemesisSession session) {
        List<NemesisState.Player> bots = session.state().players().stream()
                .filter(NemesisState.Player::isBot)
                .collect(Collectors.toList());
        if (bots.isEmpty()) {
            footerPanel.showParticipants("Bots détectés : aucun.");
            return;
        }
        if (bots.size() == 1) {
            footerPanel.showParticipants("Bot détecté : " + formatPlayerName(bots.get(0)));
            return;
        }
        footerPanel.showParticipants("Bots détectés : " + joinDecoratedNames(bots));
    }

    private void updateHistory(NemesisSession session) {
        Map<Integer, String> playerNames = new HashMap<>();
        session.state().players().forEach(player -> playerNames.put(player.id(), formatPlayerName(player)));
        List<String> lines = new ArrayList<>();
        session.state().log().forEach(entry -> {
            String line = formatLogEntry(entry, playerNames);
            if (!line.isBlank()) {
                lines.add(line);
            }
        });
        historyTracker.setEntries(lines);
        historySidebar.render(historyTracker, "Aucun évènement pour le moment.");
        JTextArea area = historySidebar.historyComponent();
        area.setCaretPosition(area.getDocument().getLength());
    }

    private String formatLogEntry(NemesisState.LogEntry entry, Map<Integer, String> playerNames) {
        String type = entry.type() != null ? entry.type() : "";
        return switch (type) {
            case "phase" -> "Phase : " + (entry.message() != null ? entry.message() : "");
            case "shot" -> {
                String shooter = resolvePlayerName(playerNames, entry.fromPlayerId());
                String target = resolvePlayerName(playerNames, entry.targetPlayerId());
                String result = entry.result() != null ? entry.result() : "inconnu";
                yield shooter + " tire sur " + target + " (" + entry.x() + "," + entry.y() + ") : " + result;
            }
            case "elimination" -> {
                String shooter = resolvePlayerName(playerNames, entry.fromPlayerId());
                String target = resolvePlayerName(playerNames, entry.targetPlayerId());
                yield shooter + " élimine " + target + ".";
            }
            default -> entry.message() != null ? entry.message() : "";
        };
    }

    private String resolvePlayerName(Map<Integer, String> playerNames, Integer id) {
        if (id == null) {
            return "Joueur inconnu";
        }
        return playerNames.getOrDefault(id, "Joueur " + id);
    }

    private String describePendingPlacement(NemesisSession session) {
        List<NemesisState.Player> pending = session.opponents().stream()
                .filter(player -> "placing".equalsIgnoreCase(player.status()))
                .collect(Collectors.toList());
        if (pending.isEmpty()) {
            return "";
        }
        if (pending.size() == 1) {
            return "En attente du placement de " + formatPlayerName(pending.get(0)) + ".";
        }
        return "En attente du placement de : " + joinDecoratedNames(pending) + ".";
    }

    private String describeOpponents(NemesisSession session) {
        List<NemesisState.Player> opponents = session.opponents().stream()
                .filter(player -> !"eliminated".equalsIgnoreCase(player.status()))
                .filter(player -> !"dead".equalsIgnoreCase(player.status()))
                .collect(Collectors.toList());
        if (opponents.isEmpty()) {
            return "";
        }
        return joinDecoratedNames(opponents);
    }

    private String describeCurrentTurnHolder(NemesisSession session) {
        NemesisState state = session.state();
        int turnIndex = state.turnIndex();
        if (turnIndex < 0 || turnIndex >= state.players().size()) {
            return "";
        }
        NemesisState.Player current = state.players().get(turnIndex);
        if (current == null) {
            return "";
        }
        boolean isSelf = session.self().map(player -> player.id() == current.id()).orElse(false);
        if (isSelf) {
            return "";
        }
        return "Attente du tour de " + formatPlayerName(current) + ".";
    }

    private Optional<NemesisState.Player> findPlayerById(NemesisState state, Integer id) {
        if (id == null) {
            return Optional.empty();
        }
        return state.players().stream()
                .filter(player -> player.id() == id)
                .findFirst();
    }

    private String joinDecoratedNames(List<NemesisState.Player> players) {
        return players.stream()
                .map(this::formatPlayerName)
                .collect(Collectors.joining(", "));
    }

    private String formatDisplayName(NemesisState.Player player, int index) {
        if (player == null) {
            return "Joueur " + (index + 1);
        }
        String name = player.username();
        if (name == null || name.isBlank()) {
            name = "Joueur " + (index + 1);
        }
        return player.isBot() ? name + " (bot)" : name;
    }

    private String formatPlayerName(NemesisState.Player player) {
        if (player == null) {
            return "Joueur inconnu";
        }
        String name = player.username();
        if (name == null || name.isBlank()) {
            name = "Joueur " + player.id();
        }
        return player.isBot() ? name + " (bot)" : name;
    }
}
