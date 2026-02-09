using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private const string BotSettingsModeTurn = "turn";
    private const string BotSettingsModeStart = "start";
    private const string BotSettingsModeDraw = "draw";

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

    private void BuildBotSettingsForm(string mode)
    {
        _botSettingsFormMode = mode;
        _page = AdminPage.BotSettingsForm;
        Title = "Paramètres bots";
        if (string.Equals(mode, BotSettingsModeStart, StringComparison.Ordinal))
        {
            Details = "Temps d'attente avant la toute première action du bot après le démarrage de la partie.";
            TextInputLabel = "Délai démarrage de partie (ms)";
            TextInput = _botStartDelayMs.ToString();
        }
        else if (string.Equals(mode, BotSettingsModeDraw, StringComparison.Ordinal))
        {
            Details = "Temps d'attente appliqué quand le bot enchaîne une action après une pioche.";
            TextInputLabel = "Délai après pioche (ms)";
            TextInput = _botDrawDelayMs.ToString();
        }
        else
        {
            _botSettingsFormMode = BotSettingsModeTurn;
            Details = "Temps d'attente standard avant qu'un bot joue pendant son tour.";
            TextInputLabel = "Délai tour normal (ms)";
            TextInput = _botTurnDelayMs.ToString();
        }
        SecondaryInput = string.Empty;
        ThirdInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = false;
        IsThirdInputVisible = false;
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
        var rawValue = (TextInput ?? string.Empty).Trim();
        if (!int.TryParse(rawValue, out var parsedDelayMs) || parsedDelayMs < 0)
        {
            var message = string.Equals(_botSettingsFormMode, BotSettingsModeStart, StringComparison.Ordinal)
                ? "Délai démarrage invalide (ms)."
                : string.Equals(_botSettingsFormMode, BotSettingsModeDraw, StringComparison.Ordinal)
                    ? "Délai après pioche invalide (ms)."
                    : "Délai tour normal invalide (ms).";
            await _dialogs.ShowError("Bots", message).ConfigureAwait(true);
            return;
        }

        var turnDelayMs = _botTurnDelayMs;
        var startDelayMs = _botStartDelayMs;
        var drawDelayMs = _botDrawDelayMs;
        if (string.Equals(_botSettingsFormMode, BotSettingsModeStart, StringComparison.Ordinal))
        {
            startDelayMs = parsedDelayMs;
        }
        else if (string.Equals(_botSettingsFormMode, BotSettingsModeDraw, StringComparison.Ordinal))
        {
            drawDelayMs = parsedDelayMs;
        }
        else
        {
            turnDelayMs = parsedDelayMs;
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
