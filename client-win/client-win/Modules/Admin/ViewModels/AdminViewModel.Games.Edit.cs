using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildEditText(AdminGameDto game, string title, string label, string initialValue, string mode)
    {
        _page = AdminPage.EditText;
        _selectedGame = game;
        Title = title;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "game.edit.submit"));
        SelectedItem = Items.FirstOrDefault();
        PrimaryInputAcceptsReturn = true;
        TextInputLabel = label;
        TextInput = initialValue;
        SecondaryInputLabel = string.Empty;
        SecondaryInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        Details = $"Type: {game.Id}";
        Status = "Saisissez puis Entrée pour valider. Échap : retour.";
        _currentEditMode = mode;
    }

    private void BuildEditRules(AdminGameDto game)
    {
        _page = AdminPage.EditText;
        _selectedGame = game;
        Title = $"Règles : {game.Name}";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "game.edit.submit"));
        SelectedItem = Items.FirstOrDefault();
        PrimaryInputAcceptsReturn = false;
        SecondaryInputAcceptsReturn = true;
        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        SecondaryInputLabel = "Règles du jeu";
        SecondaryInput = game.Rules ?? string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = true;
        Details = $"Type: {game.Id}";
        Status = "Ctrl+Entrée : valider. Échap : retour.";
        _currentEditMode = "rules";
    }

    private async Task SubmitGameTextEditAsync(AdminGameDto game)
    {
        var mode = _currentEditMode;
        var value = (TextInput ?? string.Empty).Trim();
        if (mode == "name")
        {
            IsBusy = true;
            try
            {
                await _admin.UpdateGameAsync(game.Id, name: value).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                await _dialogs.ShowInfo("Jeu", $"Nom mis à jour pour {game.Name}.");
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }
        if (mode == "description")
        {
            IsBusy = true;
            try
            {
                await _admin.UpdateGameAsync(game.Id, description: value).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                await _dialogs.ShowInfo("Jeu", $"Description mise à jour pour {game.Name}.");
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }
        if (mode == "rules")
        {
            var rules = (SecondaryInput ?? string.Empty).Trim();
            IsBusy = true;
            try
            {
                await _admin.UpdateGameAsync(game.Id, rules: rules).ConfigureAwait(true);
                await LoadGamesAsync().ConfigureAwait(true);
                await _dialogs.ShowInfo("Jeu", $"Règles mises à jour pour {game.Name}.");
            }
            finally
            {
                IsBusy = false;
            }
            return;
        }
    }

    private void BuildEditPlayers(AdminGameDto game)
    {
        _page = AdminPage.EditPlayers;
        _selectedGame = game;
        Title = $"Joueurs : {game.Name}";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "game.players.submit"));
        SelectedItem = Items.FirstOrDefault();
        TextInputLabel = "Min joueurs";
        TextInput = (game.MinPlayers ?? 1).ToString();
        SecondaryInputLabel = "Max joueurs";
        SecondaryInput = (game.MaxPlayers ?? 2).ToString();
        SecondaryInputAcceptsReturn = false;
        PrimaryInputAcceptsReturn = true;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        Details = $"Type: {game.Id}";
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitGamePlayersAsync(AdminGameDto game)
    {
        if (!int.TryParse((TextInput ?? string.Empty).Trim(), out var min) || min <= 0 ||
            !int.TryParse((SecondaryInput ?? string.Empty).Trim(), out var max) || max <= 0)
        {
            await _dialogs.ShowError("Joueurs", "Min/Max invalides.").ConfigureAwait(true);
            return;
        }
        if (min > max)
        {
            await _dialogs.ShowError("Joueurs", "Min ne peut pas être supérieur à Max.").ConfigureAwait(true);
            return;
        }

        IsBusy = true;
        try
        {
            await _admin.UpdateGameAsync(game.Id, minPlayers: min, maxPlayers: max).ConfigureAwait(true);
            await LoadGamesAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Jeu", $"Plage de joueurs mise à jour pour {game.Name}: {min}-{max}.");
        }
        finally
        {
            IsBusy = false;
        }
    }
}
