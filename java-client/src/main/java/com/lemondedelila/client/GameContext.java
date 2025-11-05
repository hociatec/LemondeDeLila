package com.lemondedelila.client;

import com.lemondedelila.client.api.ApiClient;
import com.lemondedelila.client.games.GameCatalog;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class GameContext {
    private final ApiClient apiClient;
    private final GameCatalog catalog;
    private final ExecutorService bgExecutor = Executors.newCachedThreadPool();

    public GameContext(ApiClient apiClient, GameCatalog catalog) {
        this.apiClient = apiClient; this.catalog = catalog;
    }

    public ApiClient getApiClient() { return apiClient; }
    public GameCatalog getCatalog() { return catalog; }
    public ExecutorService getBackgroundExecutor() { return bgExecutor; }
}
