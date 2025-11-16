package com.lemondelila.client.framework.ui.lifecycle;

import com.lemondelila.client.framework.ui.dialog.DialogService;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class DialogBackedApplicationLifecycle implements ApplicationLifecycle {

    private final DialogService dialogService;
    private final ShutdownManager shutdownManager;

    public DialogBackedApplicationLifecycle(DialogService dialogService,
                                            ShutdownManager shutdownManager) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.shutdownManager = Objects.requireNonNull(shutdownManager, "shutdownManager");
    }

    @Override
    public CompletableFuture<Void> requestExit() {
        shutdownManager.requestExit();
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public CompletableFuture<Void> requestExitWithConfirmation(String title, String message) {
        return dialogService.confirm(title, message)
                .thenAccept(confirmed -> {
                    if (Boolean.TRUE.equals(confirmed)) {
                        shutdownManager.requestExit();
                    }
                });
    }
}
