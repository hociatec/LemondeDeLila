package com.lemondelila.client.framework.core.context;

import com.lemondelila.client.framework.core.di.InjectionSupport;

import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.StringJoiner;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Container léger pour stocker et fournir des services singletons.
 */
public final class ApplicationContext {

    public static final String DEFAULT_QUALIFIER = "default";

    private final Map<ServiceKey, Function<ApplicationContext, ?>> factories;
    private final Map<ServiceKey, Object> instances = new ConcurrentHashMap<>();
    private final ThreadLocal<Deque<ServiceKey>> resolutionStack = ThreadLocal.withInitial(ArrayDeque::new);

    private ApplicationContext(Map<ServiceKey, Function<ApplicationContext, ?>> factories) {
        this.factories = Map.copyOf(factories);
    }

    public static Builder builder() {
        return new Builder();
    }

    public <T> T get(Class<T> type) {
        return get(type, DEFAULT_QUALIFIER);
    }

    public <T> T get(Class<T> type, String qualifier) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(qualifier, "qualifier");
        ServiceKey key = new ServiceKey(type, qualifier);
        Function<ApplicationContext, ?> factory = factories.get(key);
        if (factory == null) {
            throw new IllegalStateException("Aucun fournisseur pour " + key);
        }
        return castInstance(type, resolve(key, factory));
    }

    public <T> Optional<T> find(Class<T> type) {
        return find(type, DEFAULT_QUALIFIER);
    }

    public <T> Optional<T> find(Class<T> type, String qualifier) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(qualifier, "qualifier");
        ServiceKey key = new ServiceKey(type, qualifier);
        Function<ApplicationContext, ?> factory = factories.get(key);
        if (factory == null) {
            return Optional.empty();
        }
        return Optional.of(castInstance(type, resolve(key, factory)));
    }

    public Map<Class<?>, Object> snapshot() {
        Map<Class<?>, Object> snapshot = new LinkedHashMap<>();
        factories.keySet().forEach(key -> resolve(key, factories.get(key)));
        instances.forEach((k, v) -> snapshot.put(k.type(), v));
        return Collections.unmodifiableMap(snapshot);
    }

    private Object resolve(ServiceKey key, Function<ApplicationContext, ?> factory) {
        Object instance = instances.get(key);
        if (instance != null) {
            return instance;
        }
        Deque<ServiceKey> stack = resolutionStack.get();
        if (stack.contains(key)) {
            throw new IllegalStateException(buildCircularDependencyMessage(stack, key));
        }
        stack.push(key);
        try {
            Object created = factory.apply(this);
            Object existing = instances.putIfAbsent(key, created);
            return existing != null ? existing : created;
        } finally {
            stack.pop();
            if (stack.isEmpty()) {
                resolutionStack.remove();
            }
        }
    }

    private static String buildCircularDependencyMessage(Deque<ServiceKey> stack, ServiceKey repeatedKey) {
        StringJoiner joiner = new StringJoiner(" -> ");
        stack.descendingIterator().forEachRemaining(key -> joiner.add(key.toString()));
        joiner.add(repeatedKey.toString());
        return "Dépendance circulaire détectée: " + joiner;
    }

    private static <T> T castInstance(Class<T> type, Object instance) {
        try {
            return type.cast(instance);
        } catch (ClassCastException e) {
            throw new IllegalStateException("Impossible de caster " + instance.getClass() + " en " + type, e);
        }
    }

    public static final class Builder {
        private final Map<ServiceKey, Function<ApplicationContext, ?>> providers = new LinkedHashMap<>();

        public <T> Builder bindInstance(Class<T> type, T instance) {
            return bind(type, DEFAULT_QUALIFIER, () -> instance);
        }

        public <T> Builder bindInstance(Class<T> type, String qualifier, T instance) {
            return bind(type, qualifier, () -> instance);
        }

        public <T> Builder bind(Class<T> type, Supplier<? extends T> supplier) {
            return bind(type, DEFAULT_QUALIFIER, supplier);
        }

        public <T> Builder bind(Class<T> type, String qualifier, Supplier<? extends T> supplier) {
            Objects.requireNonNull(type, "type");
            Objects.requireNonNull(qualifier, "qualifier");
            Objects.requireNonNull(supplier, "supplier");
            ServiceKey key = new ServiceKey(type, qualifier);
            providers.put(key, ctx -> supplier.get());
            return this;
        }

        public <T> Builder bindFactory(Class<T> type, Function<ApplicationContext, ? extends T> factory) {
            return bindFactory(type, DEFAULT_QUALIFIER, factory);
        }

        public <T> Builder bindFactory(Class<T> type, String qualifier, Function<ApplicationContext, ? extends T> factory) {
            Objects.requireNonNull(type, "type");
            Objects.requireNonNull(qualifier, "qualifier");
            Objects.requireNonNull(factory, "factory");
            ServiceKey key = new ServiceKey(type, qualifier);
            providers.put(key, ctx -> factory.apply(ctx));
            return this;
        }

        public <T> Builder bind(Class<T> type, Class<? extends T> implementation) {
            return bind(type, DEFAULT_QUALIFIER, implementation);
        }

        public <T> Builder bind(Class<T> type, String qualifier, Class<? extends T> implementation) {
            Objects.requireNonNull(type, "type");
            Objects.requireNonNull(qualifier, "qualifier");
            Objects.requireNonNull(implementation, "implementation");
            ServiceKey key = new ServiceKey(type, qualifier);
            providers.put(key, ctx -> InjectionSupport.instantiate(implementation, ctx));
            return this;
        }

        public <T> Builder bindAuto(Class<T> implementation) {
            Objects.requireNonNull(implementation, "implementation");
            return bind(implementation, implementation);
        }

        public ApplicationContext build() {
            return new ApplicationContext(providers);
        }
    }

    private record ServiceKey(Class<?> type, String qualifier) {
        static final String DEFAULT_QUALIFIER = ApplicationContext.DEFAULT_QUALIFIER;

        ServiceKey {
            Objects.requireNonNull(type, "type");
            Objects.requireNonNull(qualifier, "qualifier");
        }

        @Override
        public String toString() {
            return type.getName() + "[" + qualifier + "]";
        }
    }
}
