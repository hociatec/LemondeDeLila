package com.lemondelila.client.network;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.rest.UnauthorizedHandler;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;

import javax.inject.Inject;
import javax.swing.SwingUtilities;
import java.net.http.HttpResponse;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

public final class ClientUnauthorizedHandler implements UnauthorizedHandler {

    private final ClientSession session;
    private final DialogService dialogService;
    private final DomainEventBus eventBus;
    private final AtomicBoolean notified = new AtomicBoolean(false);

    @Inject
    public ClientUnauthorizedHandler(ClientSession session,
                                     DialogService dialogService,
                                     DomainEventBus eventBus) {
        this.session = session;
        this.dialogService = dialogService;
        this.eventBus = eventBus;
    }

    @Override
    public void onUnauthorized(HttpResponse<String> response) {
        if (!notified.compareAndSet(false, true)) {
            return;
        }
        String username = session.authenticated().map(ClientSession.AuthState::username).orElse("inconnu");
        session.clear();
        eventBus.publish(new UserLoggedOut(username));
        String title = "Session expirée";
        String message = response.statusCode() == 403
                ? "Accès refusé : vos droits ont peut-être changé."
                : "Votre session a expiré. Veuillez vous reconnecter.";
        SwingUtilities.invokeLater(() -> dialogService.error(title, message));
    }
}
