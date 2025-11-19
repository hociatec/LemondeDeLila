package com.lemondelila.client.user;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.security.EncryptedSessionVault;
import com.lemondelila.client.security.SessionVault;
import com.lemondelila.client.user.controller.LoginController;
import com.lemondelila.client.user.controller.RegistrationController;
import com.lemondelila.client.user.controller.UserOperationGuard;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.user.service.SessionPersistenceService;

@AutoService(LilaModule.class)
public final class UserModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(ClientSession.class);
        builder.bindAuto(UserOperationGuard.class);
        builder.bindAuto(LoginController.class);
        builder.bindAuto(RegistrationController.class);
        builder.bindAuto(SessionPersistenceService.class);
        builder.bind(SessionVault.class, EncryptedSessionVault::defaultVault);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(LoginController.class);
        context.get(RegistrationController.class);
        context.get(SessionPersistenceService.class);
    }

    @Override
    public void stop(ApplicationContext context) {
        context.find(LoginController.class).ifPresent(UserModule::closeQuietly);
        context.find(RegistrationController.class).ifPresent(UserModule::closeQuietly);
        context.find(SessionPersistenceService.class).ifPresent(UserModule::closeQuietly);
    }

    @Override
    public int order() {
        return 20;
    }

    private static void closeQuietly(AutoCloseable closable) {
        try {
            closable.close();
        } catch (Exception ignored) {
        }
    }
}
