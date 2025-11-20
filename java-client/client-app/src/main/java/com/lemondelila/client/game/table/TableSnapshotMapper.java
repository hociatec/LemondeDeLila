package com.lemondelila.client.game.table;

/**
 * Convertit un DTO réseau ou moteur en {@link TableSnapshot}.
 */
@FunctionalInterface
public interface TableSnapshotMapper<D> {

    TableSnapshot fromDto(int roomId, D dto);
}
