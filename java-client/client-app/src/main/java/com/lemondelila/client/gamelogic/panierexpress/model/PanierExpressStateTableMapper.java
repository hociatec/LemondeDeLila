package com.lemondelila.client.gamelogic.panierexpress.model;

import com.lemondelila.client.game.table.BasicTableSnapshot;
import com.lemondelila.client.game.table.TableSnapshot;
import com.lemondelila.client.game.table.TableSnapshotMapper;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.service.dto.PanierExpressStateDto;

/**
 * Convertit un état Panier Express en {@link TableSnapshot} générique.
 */
public final class PanierExpressStateTableMapper implements TableSnapshotMapper<PanierExpressStateDto> {

    @Override
    public TableSnapshot fromDto(int roomId, PanierExpressStateDto dto) {
        if (dto == null) {
            return null;
        }
        int totalPlayers = dto.players() == null ? 0 : dto.players().size();
        int botCount = dto.players() == null
                ? 0
                : (int) dto.players().stream()
                .filter(player -> player != null && player.isBot())
                .count();
        int humans = Math.max(0, totalPlayers - botCount);
        int seats = PanierExpressGameOptions.MAX_ROBOT_COUNT + 1;
        String status = dto.status() == null || dto.status().isBlank()
                ? "lobby"
                : dto.status();
        return new BasicTableSnapshot(roomId, seats, humans, botCount, status);
    }
}
