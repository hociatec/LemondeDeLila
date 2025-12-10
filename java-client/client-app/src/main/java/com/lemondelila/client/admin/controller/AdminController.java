package com.lemondelila.client.admin.controller;

import com.lemondelila.client.admin.view.AdminUserDialog;
import com.lemondelila.client.admin.view.AdminUserDialogFactory;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.ControllerResult;

import java.awt.Window;
import java.util.Objects;

public final class AdminController {

    private final AdminUserDialogFactory dialogFactory;

    @Inject
    public AdminController(AdminUserDialogFactory dialogFactory) {
        this.dialogFactory = Objects.requireNonNull(dialogFactory, "dialogFactory");
    }

    public ControllerResult open(Window owner) {
        AdminUserDialog dialog = dialogFactory.create(owner);
        dialog.setVisible(true);
        return ControllerResult.status("Module admin ouvert.");
    }
}
