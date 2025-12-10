package com.lemondelila.client.admin.view;

import com.lemondelila.client.admin.service.AdminUserService;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import java.awt.Window;
import java.util.Objects;

public final class AdminUserDialogFactory {

    private final AdminUserService service;
    private final DialogService dialogService;

    public AdminUserDialogFactory(AdminUserService service, DialogService dialogService) {
        this.service = Objects.requireNonNull(service, "service");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
    }

    public AdminUserDialog create(Window owner) {
        return new AdminUserDialog(owner, service, dialogService);
    }
}
