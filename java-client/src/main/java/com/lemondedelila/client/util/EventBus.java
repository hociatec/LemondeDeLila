package com.lemondedelila.client.util;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

public class EventBus {
    private final Map<String, Consumer<Object>> handlers = new ConcurrentHashMap<>();

    public void register(String topic, Consumer<Object> handler) { handlers.put(topic, handler); }
    public void unregister(String topic) { handlers.remove(topic); }
    public void publish(String topic, Object payload) {
        var h = handlers.get(topic);
        if (h != null) h.accept(payload);
    }
}
