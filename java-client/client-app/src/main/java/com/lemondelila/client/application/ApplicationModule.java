package com.lemondelila.client.application;

import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.ServiceLoader;

public final class ApplicationModule implements LilaModule {

    private final List<LilaModule> startOrder;
    private final List<LilaModule> stopOrder;
    private static final Comparator<LilaModule> ORDER = Comparator.comparingInt(LilaModule::order);

    public ApplicationModule() {
        this.startOrder = discoverModules();
        List<LilaModule> descending = new ArrayList<>(startOrder);
        descending.sort(ORDER.reversed());
        this.stopOrder = List.copyOf(descending);
    }

    @Override
    public void configure(ApplicationContext.Builder builder) {
        startOrder.forEach(module -> module.configure(builder));
        builder.bindAuto(AppBranding.class);
    }

    @Override
    public void start(ApplicationContext context) throws Exception {
        for (LilaModule module : startOrder) {
            module.start(context);
        }
    }

    @Override
    public void stop(ApplicationContext context) throws Exception {
        Exception firstError = null;
        for (LilaModule module : stopOrder) {
            try {
                module.stop(context);
            } catch (Exception ex) {
                if (firstError == null) {
                    firstError = ex;
                }
            }
        }
        if (firstError != null) {
            throw firstError;
        }
    }

    @Override
    public int order() {
        return 100;
    }

    private static List<LilaModule> discoverModules() {
        return ServiceLoader.load(LilaModule.class, ApplicationModule.class.getClassLoader())
                .stream()
                .map(ServiceLoader.Provider::get)
                .filter(module -> !(module instanceof ApplicationModule))
                .sorted(ORDER)
                .toList();
    }
}

