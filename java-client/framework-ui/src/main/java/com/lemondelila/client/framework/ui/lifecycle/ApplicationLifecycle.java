package com.lemondelila.client.framework.ui.lifecycle;

import java.util.concurrent.CompletableFuture;

public interface ApplicationLifecycle {

    CompletableFuture<Void> requestExit();

    CompletableFuture<Void> requestExitWithConfirmation(String title, String message);
}
