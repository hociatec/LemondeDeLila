package com.lemondelila.client.admin;

import com.google.auto.service.AutoService;
import com.lemondelila.client.admin.controller.AdminController;
import com.lemondelila.client.admin.service.AdminUserService;
import com.lemondelila.client.admin.view.AdminUserDialogFactory;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.ui.dialog.DialogService;

@AutoService(LilaModule.class)
public final class AdminModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(AdminUserService.class);
        builder.bindFactory(AdminUserDialogFactory.class, ctx -> new AdminUserDialogFactory(
                ctx.get(AdminUserService.class),
                ctx.get(DialogService.class)
        ));
        builder.bindAuto(AdminController.class);
    }

    @Override
    public int order() {
        return 80; // après les modules utilisateurs et menu
    }
}
