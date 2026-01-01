using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private sealed record ChatDayTag(DateTime DayLocalDate);

    private async Task LoadChatAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            Status = "Chargement des messages...";

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            _loadedChatMessages = await _admin.GetChatMessagesAsync(limit: 200, includeDeleted: false, cts.Token).ConfigureAwait(true);
            BuildChatDaysMenu();
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildChatDaysMenu()
    {
        _page = AdminPage.Chat;
        _chatReturnPage = AdminPage.Chat;
        _selectedChatDay = null;
        Title = "Tchat (modération)";
        Details = $"Messages chargés : {_loadedChatMessages.Length}";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;

        Items.Clear();
        Items.Add(new AdminMenuItem("Réinitialiser le tchat (supprimer tous les messages)", tag: "chat.clear"));

        var days = _loadedChatMessages
            .Select(m => m.CreatedAt.ToLocalTime().Date)
            .Distinct()
            .OrderByDescending(d => d)
            .ToArray();

        if (days.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun message."));
            SelectedItem = Items.FirstOrDefault();
            Status = "Échap : retour.";
            RestoreFocusIfAny();
            return;
        }

        foreach (var day in days)
        {
            var count = _loadedChatMessages.Count(m => m.CreatedAt.ToLocalTime().Date == day);
            Items.Add(new AdminMenuItem($"{day:dd/MM/yyyy} ({count})", tag: new ChatDayTag(day)));
        }

        SelectedItem = Items.FirstOrDefault(i => i.Tag is ChatDayTag) ?? Items.FirstOrDefault();
        Status = "Entrée : ouvrir le jour. Échap : retour.";
        RestoreFocusIfAny();
    }

    private void BuildChatDayMessages(DateTime dayLocalDate)
    {
        _page = AdminPage.ChatDay;
        _chatReturnPage = AdminPage.ChatDay;
        _selectedChatDay = dayLocalDate;
        Title = $"Tchat : {dayLocalDate:dd/MM/yyyy}";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;

        Items.Clear();

        var messages = _loadedChatMessages
            .Select(m =>
            {
                var local = m.CreatedAt.ToLocalTime();
                return (m, local, day: local.Date);
            })
            .Where(x => x.day == dayLocalDate)
            .OrderByDescending(x => x.local)
            .ToArray();

        if (messages.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun message pour ce jour."));
            SelectedItem = Items.FirstOrDefault();
            Status = "Échap : retour.";
            RestoreFocusIfAny();
            return;
        }

        foreach (var entry in messages)
        {
            var msg = entry.m;
            var user = msg.User?.Username ?? "inconnu";
            var text = (msg.Text ?? string.Empty).Replace("\r", " ").Replace("\n", " ");
            if (text.Length > 120) text = text[..120] + "…";
            var stamp = entry.local.ToString("HH:mm", CultureInfo.GetCultureInfo("fr-FR"));
            Items.Add(new AdminMenuItem($"[{stamp}] {user}: {text}", tag: msg));
        }

        SelectedItem = Items.FirstOrDefault(i => i.Tag is AdminChatMessageDto) ?? Items.FirstOrDefault();
        Status = "Entrée : actions. Échap : retour.";
        RestoreFocusIfAny();
    }

    private void BuildChatMessageActions(AdminChatMessageDto message)
    {
        _chatReturnPage = _page;
        _page = AdminPage.ChatMessageActions;
        _selectedChatMessage = message;
        var user = message.User?.Username ?? "inconnu";
        Title = $"Tchat : {user}";

        IsTextInputVisible = true;
        TextInputLabel = "Message sélectionné (tu peux copier/modifier)";
        TextInput = message.Text ?? string.Empty;

        IsSecondaryInputVisible = false;
        Details = $"ID message: {message.Id}\nUtilisateur: {user} (id {message.User?.Id ?? 0})";

        Items.Clear();
        Items.Add(new AdminMenuItem("Supprimer ce message", tag: "chat.message.delete"));
        Items.Add(new AdminMenuItem("Bannir cet utilisateur du tchat", tag: "chat.user.ban"));
        Items.Add(new AdminMenuItem("Débannir cet utilisateur du tchat", tag: "chat.user.unban"));
        Items.Add(new AdminMenuItem("Retour à la liste", tag: "chat.back"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : action. Échap : retour.";
    }

    private void BuildChatBanForm(AdminChatMessageDto message)
    {
        _page = AdminPage.ChatBanForm;
        _selectedChatMessage = message;
        var user = message.User?.Username ?? "inconnu";
        Title = $"Ban tchat : {user}";

        IsTextInputVisible = true;
        TextInputLabel = "Raison (optionnel)";
        TextInput = _chatBanReason;

        IsSecondaryInputVisible = true;
        SecondaryInputLabel = "Durée (jours, défaut 30)";
        SecondaryInput = string.IsNullOrWhiteSpace(_chatBanDays) ? "30" : _chatBanDays;

        Details = "Entrée : bannir. Échap : retour.";

        Items.Clear();
        Items.Add(new AdminMenuItem("Valider (bannir)", tag: "chat.ban.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitChatBanAsync(AdminChatMessageDto message)
    {
        var userId = message.User?.Id ?? 0;
        if (userId <= 0)
        {
            await _dialogs.ShowError("Tchat", "Utilisateur invalide.").ConfigureAwait(true);
            return;
        }

        _chatBanReason = TextInput ?? string.Empty;
        _chatBanDays = SecondaryInput ?? string.Empty;

        int days = 30;
        if (!string.IsNullOrWhiteSpace(_chatBanDays) && int.TryParse(_chatBanDays, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) && parsed > 0)
        {
            days = parsed;
        }

        IsBusy = true;
        try
        {
            await _admin.BanUserFromChatAsync(userId, reason: _chatBanReason, durationDays: days).ConfigureAwait(true);
            await _dialogs.ShowInfo("Tchat", $"Utilisateur banni du tchat ({days} jours).").ConfigureAwait(true);
            await ReloadChatModerationAsync().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeleteSelectedChatMessageAsync(AdminChatMessageDto message)
    {
        var confirm = await _dialogs.Confirm(
                "Tchat",
                "Supprimer ce message ?")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        IsBusy = true;
        try
        {
            await _admin.DeleteChatMessageAsync(message.Id).ConfigureAwait(true);
            await ReloadChatModerationAsync().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ClearChatAsync()
    {
        var confirm = await _dialogs.Confirm(
                "Tchat",
                "Réinitialiser le tchat : supprimer tous les messages ?\n\nCette action est irréversible.")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        IsBusy = true;
        try
        {
            var deleted = await _admin.ClearChatAsync().ConfigureAwait(true);
            await _dialogs.ShowInfo("Tchat", $"Messages supprimés: {deleted}").ConfigureAwait(true);
            await ReloadChatModerationAsync().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ReloadChatModerationAsync()
    {
        var day = _chatReturnPage == AdminPage.ChatDay ? _selectedChatDay : null;
        await LoadChatAsync().ConfigureAwait(true);
        if (day.HasValue)
        {
            BuildChatDayMessages(day.Value);
        }
    }
}
