using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private async Task LoadChatAccessAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            _page = AdminPage.ChatAccess;
            Title = "Tchat (accès)";
            Details = string.Empty;
            IsTextInputVisible = false;
            IsSecondaryInputVisible = false;
            Items.Clear();
            SelectedItem = null;
            Status = "Chargement...";

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            var res = await _admin.ListUsersAsync(page: 1, limit: 50, cancellationToken: cts.Token).ConfigureAwait(true);
            _loadedUsers = (res.Items ?? new()).ToArray();

            Items.Add(new AdminMenuItem("Rafraîchir", tag: "chatAccess.refresh"));
            foreach (var u in _loadedUsers.OrderBy(u => u.Username))
            {
                var status = BuildChatBanStatus(u);
                Items.Add(new AdminMenuItem($"{u.Username} (id {u.Id}) - {status}", tag: u));
            }
            SelectedItem = Items.FirstOrDefault();
            Status = "Entrée : actions. Échap : retour.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildChatAccessUserActions(AdminUserDto user)
    {
        _page = AdminPage.ChatAccessUserActions;
        _selectedUser = user;
        Title = $"Tchat : {user.Username}";

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        Details = BuildChatBanStatus(user);

        Items.Clear();
        Items.Add(new AdminMenuItem("Bannir du tchat", tag: "chatAccess.user.ban"));
        Items.Add(new AdminMenuItem("Débannir du tchat", tag: "chatAccess.user.unban"));
        Items.Add(new AdminMenuItem("Retour", tag: "chatAccess.back"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : action. Échap : retour.";
    }

    private void BuildChatAccessBanForm(AdminUserDto user)
    {
        _page = AdminPage.ChatAccessBanForm;
        _selectedUser = user;
        Title = $"Ban tchat : {user.Username}";

        IsTextInputVisible = true;
        TextInputLabel = "Raison (optionnel)";
        TextInput = _chatBanReason;

        IsSecondaryInputVisible = true;
        SecondaryInputLabel = "Durée (jours, défaut 30)";
        SecondaryInput = string.IsNullOrWhiteSpace(_chatBanDays) ? "30" : _chatBanDays;

        Details = "Entrée : bannir. Échap : retour.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider (bannir)", tag: "chatAccess.ban.submit"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : valider. Échap : retour.";
    }

    private async Task SubmitChatAccessBanAsync(AdminUserDto user)
    {
        _chatBanReason = TextInput ?? string.Empty;
        _chatBanDays = SecondaryInput ?? string.Empty;

        int days = 30;
        if (!string.IsNullOrWhiteSpace(_chatBanDays) &&
            int.TryParse(_chatBanDays, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) &&
            parsed > 0)
        {
            days = parsed;
        }

        IsBusy = true;
        try
        {
            await _admin.BanUserFromChatAsync(user.Id, reason: _chatBanReason, durationDays: days).ConfigureAwait(true);
            await _dialogs.ShowInfo("Tchat", $"Utilisateur banni du tchat ({days} jours).").ConfigureAwait(true);
            await LoadChatAccessAsync().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private static string BuildChatBanStatus(AdminUserDto user)
    {
        if (user.ChatBannedUntil.HasValue && user.ChatBannedUntil.Value.ToUniversalTime() > DateTime.UtcNow)
        {
            return $"Banni (jusqu'au {user.ChatBannedUntil:dd/MM/yyyy})";
        }
        return "Autorisé";
    }

    private async Task LoadChatAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            _page = AdminPage.Chat;
            Title = "Tchat (modération)";
            Details = string.Empty;
            IsTextInputVisible = false;
            IsSecondaryInputVisible = false;

            Status = "Chargement des messages...";
            Items.Clear();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            _loadedChatMessages = await _admin.GetChatMessagesAsync(limit: 200, includeDeleted: false, cts.Token).ConfigureAwait(true);

            Items.Add(new AdminMenuItem("Rafraîchir", tag: "chat.refresh"));
            Items.Add(new AdminMenuItem("Réinitialiser le tchat (supprimer tous les messages)", tag: "chat.clear"));

            Details = $"Messages chargés : {_loadedChatMessages.Length}";

            var groups = _loadedChatMessages
                .Select(m =>
                {
                    var local = m.CreatedAt.ToLocalTime();
                    return (m, local, day: local.Date);
                })
                .OrderByDescending(x => x.day)
                .ThenByDescending(x => x.local)
                .GroupBy(x => x.day)
                .ToArray();

            if (groups.Length == 0)
            {
                Items.Add(new AdminMenuItem("Aucun message."));
            }

            foreach (var g in groups)
            {
                Items.Add(new AdminMenuItem($"--- {g.Key:dd/MM/yyyy} ---"));
                foreach (var entry in g)
                {
                    var msg = entry.m;
                    var user = msg.User?.Username ?? "inconnu";
                    var text = (msg.Text ?? string.Empty).Replace("\r", " ").Replace("\n", " ");
                    if (text.Length > 120) text = text[..120] + "…";
                    var stamp = entry.local.ToString("HH:mm", CultureInfo.GetCultureInfo("fr-FR"));
                    Items.Add(new AdminMenuItem($"[{stamp}] {user}: {text}", tag: msg));
                }
            }

            SelectedItem = Items.FirstOrDefault();
            Status = "Entrée : sélectionner. Échap : retour.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildChatMessageActions(AdminChatMessageDto message)
    {
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
            await LoadChatAsync().ConfigureAwait(true);
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
            await LoadChatAsync().ConfigureAwait(true);
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
            await LoadChatAsync().ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
