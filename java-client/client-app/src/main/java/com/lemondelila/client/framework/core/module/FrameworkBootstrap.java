package com.lemondelila.client.framework.core.module;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.ServiceLoader;

/**
 * Point d'entrée pour démarrer l'infrastructure modulaire.
 */
public final class FrameworkBootstrap {

    private static final Logger LOGGER = LoggerFactory.getLogger(FrameworkBootstrap.class);

    private final List<LilaModule> modules;

    private FrameworkBootstrap(List<LilaModule> modules) {
        this.modules = modules;
    }

    public static FrameworkBootstrap load() {
        ServiceLoader<LilaModule> loader = ServiceLoader.load(LilaModule.class);
        List<LilaModule> modules = new ArrayList<>();
        loader.forEach(modules::add);
        modules.sort(Comparator.comparingInt(LilaModule::order));
        return new FrameworkBootstrap(List.copyOf(modules));
    }

    public ApplicationContext launch() {
        ApplicationContext.Builder builder = ApplicationContext.builder();
        modules.forEach(module -> {
            LOGGER.info("Configuration du module {}", module.getClass().getSimpleName());
            module.configure(builder);
        });
        ApplicationContext context = builder.build();
        modules.forEach(module -> {
            try {
                LOGGER.info("Démarrage du module {}", module.getClass().getSimpleName());
                module.start(context);
            } catch (Exception ex) {
                throw new IllegalStateException("Erreur lors du démarrage du module " + module.getClass().getName(), ex);
            }
        });
        return context;
    }

    public void shutdown(ApplicationContext context) {
        modules.stream()
                .sorted((a, b) -> Integer.compare(b.order(), a.order()))
                .forEach(module -> {
                    try {
                        LOGGER.info("Arrêt du module {}", module.getClass().getSimpleName());
                        module.stop(context);
                    } catch (Exception ex) {
                        LOGGER.warn("Erreur lors de l'arrêt du module {}", module.getClass().getName(), ex);
                    }
                });
    }

    public List<LilaModule> modules() {
        return modules;
    }
}

