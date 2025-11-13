package com.lemondelila.client.game.model;

import com.lemondelila.client.game.events.GameSessionEnded;
import com.lemondelila.client.game.events.GameSessionStarted;
import com.lemondelila.client.game.events.TableJoined;
import com.lemondelila.client.game.events.TableLeft;
import com.lemondelila.client.framework.core.event.DomainEventBus;

final class GameSessionEvents {

    private GameSessionEvents() {
    }

    static <S extends GameSession<?>> void publishTransition(DomainEventBus eventBus,
                                                             S previous,
                                                             S current) {
        if (previous != null && current != null && previous.roomId() == current.roomId()) {
            if (!previous.finished() && current.finished()) {
                eventBus.publish(new GameSessionEnded(current.roomId(), typeOf(current)));
            } else if (previous.finished() && !current.finished()) {
                publishStarted(eventBus, current);
            }
            return;
        }

        if (previous != null) {
            if (!previous.finished()) {
                eventBus.publish(new GameSessionEnded(previous.roomId(), typeOf(previous)));
            }
            eventBus.publish(new TableLeft(previous.roomId(), typeOf(previous)));
        }

        if (current != null) {
            eventBus.publish(new TableJoined(current.roomId(), typeOf(current)));
            publishStarted(eventBus, current);
        }
    }

    private static <S extends GameSession<?>> void publishStarted(DomainEventBus eventBus, S session) {
        if (!session.finished()) {
            eventBus.publish(new GameSessionStarted(session.roomId(), typeOf(session)));
        }
    }

    private static String typeOf(GameSession<?> session) {
        String type = session.gameType();
        return (type == null || type.isBlank()) ? "unknown" : type;
    }
}
