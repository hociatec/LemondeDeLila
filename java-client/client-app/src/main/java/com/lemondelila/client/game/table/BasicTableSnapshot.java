package com.lemondelila.client.game.table;

import java.util.Objects;

/**
 * Implémentation minimale de {@link TableSnapshot} utilisable par tous les jeux
 * qui n'ont pas besoin d'attributs supplémentaires.
 */
public record BasicTableSnapshot(int id,
                                 int maxSeats,
                                 int humanPlayers,
                                 int botPlayers,
                                 String status) implements TableSnapshot {

    public BasicTableSnapshot {
        Objects.requireNonNull(status, "status");
    }
}
