using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void BuildBotNameActions(AdminBotNameDto bot)
    {
        _page = AdminPage.BotNameActions;
        _selectedBotName = bot;
        Title = $"Bot : {bot.Name}";
        Details = $"ID : {bot.Id}. Statut : {(bot.Enabled ? "actif" : "désactivé")}.";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem(bot.Enabled ? "Désactiver" : "Activer", tag: "bots.name.toggle"));
        Items.Add(new AdminMenuItem("Renommer", tag: "bots.name.rename"));
        Items.Add(new AdminMenuItem("Supprimer", tag: "bots.name.delete"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
    }

    private async Task ExecuteBotNameActionAsync(AdminBotNameDto bot, string action)
    {
        if (IsBusy) return;

        if (action == "bots.name.rename")
        {
            BuildBotNameForm("edit", bot);
            return;
        }

        IsBusy = true;
        try
        {
            AdminBotNamesListResponseDto response;
            if (action == "bots.name.toggle")
            {
                response = await _admin.UpdateBotNameAsync(bot.Id, enabled: !bot.Enabled).ConfigureAwait(true);
            }
            else if (action == "bots.name.delete")
            {
                response = await _admin.DeleteBotNameAsync(bot.Id).ConfigureAwait(true);
            }
            else
            {
                return;
            }

            _loadedBotNames = (response.Names ?? new()).ToArray();
            _selectedBotName = null;
            _dispatcher.Invoke(() =>
            {
                ShowBots();
                Status = "Bots mis à jour.";
            });
        }
        finally
        {
            IsBusy = false;
        }
    }
}
