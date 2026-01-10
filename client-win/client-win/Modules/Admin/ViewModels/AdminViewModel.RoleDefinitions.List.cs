using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task LoadRoleDefinitionsAsync()
    {
        _page = AdminPage.RoleDefinitions;
        ConfigureItemsViewForPage();
        Title = "Gestion des rôles";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement des définitions...";
        IsBusy = true;
        try
        {
            var response = await _admin.ListRoleDefinitionsAsync().ConfigureAwait(true);
            _loadedRoleDefinitions = (response.Definitions ?? new()).ToArray();
            _dispatcher.Invoke(ShowRoleDefinitionsList);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowRoleDefinitionsList()
    {
        _page = AdminPage.RoleDefinitions;
        ConfigureItemsViewForPage();
        Title = "Gestion des rôles";
        Details = $"Définitions disponibles : {_loadedRoleDefinitions.Length}.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        _selectedRoleDefinition = null;
        Items.Clear();
        Items.Add(new AdminMenuItem("Créer un rôle", tag: "roleDefinition.create"));
        foreach (var definition in _loadedRoleDefinitions.OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase))
        {
            var label = $"{definition.Name} — {definition.Description}";
            Items.Add(new AdminMenuItem(label, tag: definition));
        }
        if (!_loadedRoleDefinitions.Any())
        {
            Items.Add(new AdminMenuItem("Aucune définition disponible."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : actions sur le rôle. Échap : retour.";
        RestoreFocusIfAny();
    }

    private void BuildRoleDefinitionActions(AdminRoleDefinitionDto definition)
    {
        _page = AdminPage.RoleDefinitionActions;
        ConfigureItemsViewForPage();
        _selectedRoleDefinition = definition;
        Title = $"Rôle : {definition.Name}";
        Details = definition.Description;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Modifier", tag: "roleDefinition.edit"));
        Items.Add(new AdminMenuItem("Supprimer", tag: "roleDefinition.delete"));
        SelectedItem = Items.FirstOrDefault();
        RestoreFocusIfAny();
        Status = "Entrée : action. Échap : retour.";
    }
}
