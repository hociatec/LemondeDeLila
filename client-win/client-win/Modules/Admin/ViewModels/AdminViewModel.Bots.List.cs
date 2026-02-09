using System;
using System.Linq;
using System.Threading.Tasks;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task LoadBotsAsync()
    {
        if (IsBusy) return;
        _page = AdminPage.Bots;
        Title = "Gérer les bots";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";
        IsBusy = true;
        try
        {
            var names = await _admin.ListBotNamesAsync().ConfigureAwait(true);
            var settings = await _admin.GetBotSettingsAsync().ConfigureAwait(true);
            _loadedBotNames = (names.Names ?? new()).ToArray();
            _botTurnDelayMs = settings.BotTurnDelayMs;
            _botStartDelayMs = settings.BotStartDelayMs;
            _botDrawDelayMs = settings.BotDrawDelayMs;
            _dispatcher.Invoke(ShowBots);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowBots()
    {
        _page = AdminPage.Bots;
        Title = "Gérer les bots";
        Details = "Gérer la liste de noms de bots et les délais d'action.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsThirdInputVisible = false;
        IsFourthInputVisible = false;
        IsFifthInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem($"Délai tour bot : {_botTurnDelayMs} ms", tag: "bots.settings"));
        Items.Add(new AdminMenuItem($"Délai démarrage bot : {_botStartDelayMs} ms", tag: "bots.settings"));
        Items.Add(new AdminMenuItem($"Délai pioche bot : {_botDrawDelayMs} ms", tag: "bots.settings"));
        Items.Add(new AdminMenuItem("Créer un bot", tag: "bots.create"));
        foreach (var bot in _loadedBotNames.OrderBy(b => b.Name, StringComparer.OrdinalIgnoreCase))
        {
            var status = bot.Enabled ? string.Empty : " (désactivé)";
            Items.Add(new AdminMenuItem($"{bot.Name}{status}", tag: bot));
        }
        if (_loadedBotNames.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun bot configuré."));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }
}
