using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private Task LoadCategoriesAsync() => LoadCategoriesAsync(AdminPage.Games);

    private async Task LoadCategoriesAsync(AdminPage returnPage)
    {
        if (IsBusy) return;
        _categoriesReturnPage = returnPage;
        _page = AdminPage.GameCategories;
        ConfigureItemsViewForPage();
        Title = "Gérer les catégories";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement des catégories...";
        IsBusy = true;
        try
        {
            await RefreshCategoriesCacheAsync().ConfigureAwait(true);
            _dispatcher.Invoke(ShowCategories);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task RefreshCategoriesCacheAsync()
    {
        var payload = await _admin.ListGameCategoriesAsync().ConfigureAwait(true);
        _loadedCategories = (payload.Categories ?? new()).ToArray();
        _categoryAssignments = payload.Assignments ?? new Dictionary<string, string?>();
    }

    private void ShowCategories()
    {
        _page = AdminPage.GameCategories;
        ConfigureItemsViewForPage();
        Title = "Gérer les catégories";
        Details = "Créer ou modifier les catégories disponibles.";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Créer une catégorie", tag: "games.categories.create"));
        foreach (var category in _loadedCategories.OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
        {
            var parentName = ResolveCategoryName(category.ParentId);
            var parentLabel = string.IsNullOrWhiteSpace(category.ParentId)
                ? string.Empty
                : $" (parent : {parentName ?? category.ParentId})";
            Items.Add(new AdminMenuItem($"{category.Name}{parentLabel}", tag: category));
        }
        if (_loadedCategories.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucune catégorie disponible."));
        }
        SelectedItem = Items.FirstOrDefault();
        RestoreFocusIfAny();
        Status = "Entrée : créer / modifier. Échap : retour.";
    }

    private void BuildCategoryForm(string mode, AdminGameCategoryDto? category = null)
    {
        _page = AdminPage.GameCategoryForm;
        ConfigureItemsViewForPage();
        _categoryFormMode = mode;
        _categoryFormId = category?.Id ?? string.Empty;
        Title = mode == "create" ? "Créer une catégorie" : $"Modifier la catégorie {category?.Name}";
        Details = mode == "create"
            ? "Donnez un nom et un parent (optionnel)."
            : $"ID : {category?.Id}";
        TextInputLabel = "Nom";
        TextInput = category?.Name ?? string.Empty;
        SecondaryInputLabel = "Parent (id, facultatif)";
        SecondaryInput = category?.ParentId ?? string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "game.category.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitCategoryFormAsync()
    {
        var name = (TextInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            await _dialogs.ShowError("Catégorie", "Un nom est requis.").ConfigureAwait(true);
            return;
        }

        var parentInput = (SecondaryInput ?? string.Empty).Trim();
        var parentId = string.IsNullOrEmpty(parentInput) ? null : parentInput;
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            AdminGameCategoriesResponseDto response;
            if (string.Equals(_categoryFormMode, "edit", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(_categoryFormId))
            {
                response = await _admin.UpdateGameCategoryAsync(_categoryFormId, name, parentId).ConfigureAwait(true);
            }
            else
            {
                response = await _admin.CreateGameCategoryAsync(name, parentId).ConfigureAwait(true);
            }
            _loadedCategories = (response.Categories ?? new()).ToArray();
            _categoryAssignments = response.Assignments ?? new Dictionary<string, string?>();
            _dispatcher.Invoke(() =>
            {
                ShowCategories();
                Status = "Catégorie enregistrée.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadCategoryAssignmentMenuAsync()
    {
        if (_selectedGame == null)
        {
            await _dialogs.ShowError("Catégorie", "Aucun jeu sélectionné.").ConfigureAwait(true);
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            await RefreshCategoriesCacheAsync().ConfigureAwait(true);
            _dispatcher.Invoke(ShowCategoryAssignmentList);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowCategoryAssignmentList()
    {
        if (_selectedGame == null)
        {
            ShowGames();
            return;
        }

        _page = AdminPage.GameCategoryAssign;
        ConfigureItemsViewForPage();
        Title = $"Catégorie : {_selectedGame.Name}";
        var assignedId = _categoryAssignments.TryGetValue(_selectedGame.Id, out var id) ? id : null;
        var currentName = ResolveCategoryName(assignedId);
        Details = $"Catégorie actuelle : {currentName ?? "pas de catégorie"}";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Aucune catégorie", tag: "game.category.assign.none", isCheckable: true, isChecked: assignedId == null));
        foreach (var category in _loadedCategories.OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
        {
            var isChecked = string.Equals(assignedId, category.Id, StringComparison.OrdinalIgnoreCase);
            Items.Add(new AdminMenuItem($"{category.Name}", tag: category, isCheckable: true, isChecked: isChecked));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : assigner. Échap : retour.";
    }

    private async Task AssignCategoryToGameAsync(string? categoryId)
    {
        if (_selectedGame == null)
        {
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var payload = await _admin.AssignGameCategoryAsync(_selectedGame.Id, categoryId).ConfigureAwait(true);
            _loadedCategories = (payload.Categories ?? new()).ToArray();
            _categoryAssignments = payload.Assignments ?? new Dictionary<string, string?>();
            var categoryName = ResolveCategoryName(categoryId);
            _selectedGame.CategoryId = categoryId;
            _selectedGame.Category = categoryName ?? string.Empty;
            var synced = _loadedGames.FirstOrDefault(g => string.Equals(g.Id, _selectedGame.Id, StringComparison.OrdinalIgnoreCase));
            if (synced != null)
            {
                synced.CategoryId = categoryId;
                synced.Category = _selectedGame.Category;
            }
            BuildGameActions(_selectedGame);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private string? ResolveCategoryName(string? categoryId)
    {
        if (string.IsNullOrWhiteSpace(categoryId))
        {
            return null;
        }
        return _loadedCategories.FirstOrDefault(c => string.Equals(c.Id, categoryId, StringComparison.OrdinalIgnoreCase))?.Name;
    }
}
