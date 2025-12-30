using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildBotNameForm(string mode, AdminBotNameDto? bot = null)
    {
        _page = AdminPage.BotNameForm;
        _botNameFormMode = mode;
        _botNameFormId = bot?.Id ?? 0;
        Title = mode == "create" ? "Créer un bot" : $"Renommer {bot?.Name}";
        Details = mode == "create" ? "Nom affiché dans les tables." : $"ID : {bot?.Id}";
        TextInputLabel = "Nom";
        TextInput = bot?.Name ?? string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "bots.name.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private void BuildBotSettingsForm()
    {
        _page = AdminPage.BotSettingsForm;
        Title = "Paramètres bots";
        Details = "Ajuster le délai avant qu'un bot joue son tour.";
        TextInputLabel = "Délai (ms)";
        TextInput = _botTurnDelayMs.ToString();
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "bots.settings.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitBotSettingsFormAsync()
    {
        var raw = (TextInput ?? string.Empty).Trim();
        if (!int.TryParse(raw, out var delayMs) || delayMs < 0)
        {
            await _dialogs.ShowError("Bots", "Délai invalide (ms).").ConfigureAwait(true);
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var updated = await _admin.UpdateBotSettingsAsync(delayMs).ConfigureAwait(true);
            _botTurnDelayMs = updated.BotTurnDelayMs;
            _dispatcher.Invoke(() =>
            {
                ShowBots();
                Status = "Paramètres bots enregistrés.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SubmitBotNameFormAsync()
    {
        var name = (TextInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            await _dialogs.ShowError("Bots", "Un nom est requis.").ConfigureAwait(true);
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            AdminBotNamesListResponseDto response;
            if (string.Equals(_botNameFormMode, "edit", StringComparison.OrdinalIgnoreCase) && _botNameFormId > 0)
            {
                response = await _admin.UpdateBotNameAsync(_botNameFormId, name: name).ConfigureAwait(true);
            }
            else
            {
                response = await _admin.CreateBotNameAsync(name, enabled: true).ConfigureAwait(true);
            }

            _loadedBotNames = (response.Names ?? new()).ToArray();
            _dispatcher.Invoke(() =>
            {
                ShowBots();
                Status = "Bot enregistré.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }
}
