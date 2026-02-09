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
        _botNameFormOriginalName = bot?.Name ?? string.Empty;
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
        Details = "Ajuster les délais des actions bots (en millisecondes).";
        TextInputLabel = "Délai tour (ms)";
        TextInput = _botTurnDelayMs.ToString();
        SecondaryInputLabel = "Délai démarrage (ms)";
        SecondaryInput = _botStartDelayMs.ToString();
        ThirdInputLabel = "Délai pioche (ms)";
        ThirdInput = _botDrawDelayMs.ToString();
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsThirdInputVisible = true;
        IsFourthInputVisible = false;
        IsFifthInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider", tag: "bots.settings.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitBotSettingsFormAsync()
    {
        var turnRaw = (TextInput ?? string.Empty).Trim();
        var startRaw = (SecondaryInput ?? string.Empty).Trim();
        var drawRaw = (ThirdInput ?? string.Empty).Trim();

        if (!int.TryParse(turnRaw, out var turnDelayMs) || turnDelayMs < 0)
        {
            await _dialogs.ShowError("Bots", "Délai tour invalide (ms).").ConfigureAwait(true);
            return;
        }

        if (!int.TryParse(startRaw, out var startDelayMs) || startDelayMs < 0)
        {
            await _dialogs.ShowError("Bots", "Délai démarrage invalide (ms).").ConfigureAwait(true);
            return;
        }

        if (!int.TryParse(drawRaw, out var drawDelayMs) || drawDelayMs < 0)
        {
            await _dialogs.ShowError("Bots", "Délai pioche invalide (ms).").ConfigureAwait(true);
            return;
        }

        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var updated = await _admin.UpdateBotSettingsAsync(turnDelayMs, startDelayMs, drawDelayMs).ConfigureAwait(true);
            _botTurnDelayMs = updated.BotTurnDelayMs;
            _botStartDelayMs = updated.BotStartDelayMs;
            _botDrawDelayMs = updated.BotDrawDelayMs;
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
                if (!string.Equals(_botNameFormOriginalName, name, StringComparison.Ordinal))
                {
                    await _dialogs.ShowInfo("Bots", $"Bot renommé : {_botNameFormOriginalName} → {name}.").ConfigureAwait(true);
                }
                else
                {
                    await _dialogs.ShowInfo("Bots", $"Bot {_botNameFormOriginalName} mis à jour.").ConfigureAwait(true);
                }
            }
            else
            {
                response = await _admin.CreateBotNameAsync(name, enabled: true).ConfigureAwait(true);
                await _dialogs.ShowInfo("Bots", $"Bot créé : {name}.").ConfigureAwait(true);
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
