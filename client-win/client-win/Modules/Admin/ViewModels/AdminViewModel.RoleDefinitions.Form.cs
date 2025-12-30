using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildRoleDefinitionForm(string mode, AdminRoleDefinitionDto? definition = null)
    {
        _page = AdminPage.RoleDefinitionForm;
        _roleDefinitionFormMode = mode;
        _selectedRoleDefinition = definition;
        _roleDefinitionOriginalName = definition?.Name ?? string.Empty;
        Title = mode == "create" ? "Créer un rôle" : $"Modifier le rôle {definition?.Name}";
        Details = mode == "create"
            ? "Donnez un nom, une description et la liste des permissions."
            : definition?.Description ?? string.Empty;
        TextInputLabel = "Nom";
        TextInput = definition?.Name ?? string.Empty;
        SecondaryInputLabel = "Description";
        SecondaryInput = definition?.Description ?? string.Empty;
        AdditionalPermissionsLabel = "Permissions supplémentaires (une par ligne)";
        InitializePermissionModules(definition?.Permissions);
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = true;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "roleDefinition.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitRoleDefinitionFormAsync()
    {
        var name = (TextInput ?? string.Empty).Trim();
        var description = (SecondaryInput ?? string.Empty).Trim();
        var permissions = PermissionModules
            .SelectMany(module => module.SelectedPermissions)
            .Concat(ParsePermissions(AdditionalPermissions))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (string.IsNullOrWhiteSpace(name))
        {
            await _dialogs.ShowError("Rôle", "Un nom est requis.").ConfigureAwait(true);
            return;
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            await _dialogs.ShowError("Rôle", "Une description est requise.").ConfigureAwait(true);
            return;
        }

        IsBusy = true;
        try
        {
            if (string.Equals(_roleDefinitionFormMode, "create", StringComparison.OrdinalIgnoreCase))
            {
                await _admin.CreateRoleDefinitionAsync(name, description, permissions).ConfigureAwait(true);
                await _dialogs.ShowInfo("Rôle", $"Rôle {name} créé.").ConfigureAwait(true);
            }
            else
            {
                var targetName = _roleDefinitionOriginalName;
                var newName = string.Equals(name, targetName, StringComparison.Ordinal) ? null : name;
                await _admin.UpdateRoleDefinitionAsync(targetName, newName, description, permissions).ConfigureAwait(true);
                await _dialogs.ShowInfo("Rôle", $"Rôle {targetName} mis à jour.").ConfigureAwait(true);
            }

            await LoadRoleDefinitionsAsync().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeleteRoleDefinitionAsync(AdminRoleDefinitionDto definition)
    {
        var confirmation = await _dialogs.Confirm("Suppression", $"Supprimer {definition.Name} ?").ConfigureAwait(true);
        if (confirmation != true)
        {
            return;
        }

        IsBusy = true;
        try
        {
            await _admin.DeleteRoleDefinitionAsync(definition.Name).ConfigureAwait(true);
            await LoadRoleDefinitionsAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Rôle", $"Rôle {definition.Name} supprimé.").ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
