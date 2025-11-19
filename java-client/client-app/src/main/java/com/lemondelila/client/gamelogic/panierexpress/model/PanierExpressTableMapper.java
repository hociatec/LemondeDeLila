package com.lemondelila.client.gamelogic.panierexpress.model;

import com.lemondelila.client.gamelogic.panierexpress.service.dto.PanierExpressTableDto;

/**
 * Convertit les DTO réseau des tables vers un modèle léger utilisable par l'UI.
 */
public final class PanierExpressTableMapper {

    private PanierExpressTableMapper() {
    }

    public static PanierExpressTableInfo fromDto(PanierExpressTableDto dto) {
        if (dto == null) {
            return null;
        }
        int playerCount = dto.players() == null ? 0 : dto.players().size();
        int botCount = dto.bots() == null ? 0 : dto.bots().size();
        if (dto.counts() != null && dto.counts().players() > 0) {
            playerCount = dto.counts().players() - botCount;
        }
        return new PanierExpressTableInfo(
                dto.id(),
                dto.maxPlayers(),
                Math.max(0, playerCount),
                Math.max(0, botCount),
                dto.status() == null ? "open" : dto.status()
        );
    }
}

