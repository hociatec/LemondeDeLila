using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task LoadGamesAsync()
    {
        _page = AdminPage.Games;
        Title = "Gestion des jeux";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
        IsBusy = true;
        try
        {
            var list = await _admin.ListGamesAsync().ConfigureAwait(true);
            _loadedGames = (list.Games ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                Items.Clear();
                foreach (var game in _loadedGames.OrderBy(g => g.Name))
                {
                    var label = $"{(game.Enabled ? "Actif" : "Désactivé")} : {game.Name}";
                    Items.Add(new AdminMenuItem(label, tag: game));
                }
                if (Items.Count == 0)
                {
                    Items.Add(new AdminMenuItem("Aucun jeu."));
                }
                SelectedItem = Items.FirstOrDefault();
                Status = "Entrée : options du jeu. Échap : retour.";
                RestoreFocusIfAny();
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowGames()
    {
        _page = AdminPage.Games;
        Title = "Gestion des jeux";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        foreach (var game in _loadedGames.OrderBy(g => g.Name))
        {
            var label = $"{(game.Enabled ? "Actif" : "Désactivé")} : {game.Name}";
            Items.Add(new AdminMenuItem(label, tag: game));
        }
        if (Items.Count == 0)
        {
            Items.Add(new AdminMenuItem("Aucun jeu."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : options du jeu. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildGameActions(AdminGameDto game)
    {
        _currentEditMode = string.Empty;
        _page = AdminPage.GameActions;
        _selectedGame = game;
        Title = $"Jeu : {game.Name}";
        Details = $"Type: {game.Id}. Joueurs: {game.MinPlayers ?? 0}-{game.MaxPlayers ?? 0}. Statut: {(game.Enabled ? "actif" : "désactivé")}.";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem(game.Enabled ? "Désactiver" : "Activer", tag: "game.toggle"));
        Items.Add(new AdminMenuItem("Modifier le nom", tag: "game.edit.name"));
        Items.Add(new AdminMenuItem("Modifier la description", tag: "game.edit.description"));
        Items.Add(new AdminMenuItem("Attribuer une catégorie", tag: "game.category.assign"));
        Items.Add(new AdminMenuItem("Modifier min/max joueurs", tag: "game.edit.players"));
        Items.Add(new AdminMenuItem("Réinitialiser les paramètres", tag: "game.reset"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
    }

    private async Task ExecuteGameActionAsync(AdminGameDto game, string action)
    {
        if (action == "game.toggle")
        {
            IsBusy = true;
            try
            {
                await _admin.SetGameEnabledAsync(game.Id, !game.Enabled).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                var updated = _loadedGames.FirstOrDefault(g => string.Equals(g.Id, game.Id, StringComparison.OrdinalIgnoreCase));
                if (updated != null)
                {
                    BuildGameActions(updated);
                }
                await _dialogs.ShowInfo("Jeu", $"{game.Name} est {(game.Enabled ? "désactivé" : "activé")}.");
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }

        if (action == "game.edit.name")
        {
            BuildEditText(game, title: $"Nom : {game.Name}", label: "Nouveau nom", initialValue: game.Name, mode: "name");
            return;
        }
        if (action == "game.edit.description")
        {
            BuildEditText(game, title: $"Description : {game.Name}", label: "Nouvelle description", initialValue: game.Description ?? string.Empty, mode: "description");
            return;
        }
        if (action == "game.edit.players")
        {
            BuildEditPlayers(game);
            return;
        }
        if (action == "game.reset")
        {
            var confirm = await _dialogs.Confirm("Réinitialiser", $"Réinitialiser les paramètres admin pour {game.Name} ?").ConfigureAwait(true);
            if (confirm != true) return;
            IsBusy = true;
            try
            {
                await _admin.ResetGameOverrideAsync(game.Id).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                var updated = _loadedGames.FirstOrDefault(g => string.Equals(g.Id, game.Id, StringComparison.OrdinalIgnoreCase));
                if (updated != null)
                {
                    BuildGameActions(updated);
                }
                await _dialogs.ShowInfo("Jeu", $"Paramètres réinitialisés pour {game.Name}.");
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}
