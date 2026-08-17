using System;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Collections.Specialized;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Core.Constants;
using client_win.Modules.Network.Services;
using client_win.Modules.Notifications.Models;
using client_win.Modules.Notifications.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Services;

namespace client_win.Modules.Notifications.ViewModels;

public sealed class NotificationsViewModel : ObservableObject, IShellNavigationAware
{
    private readonly INotificationInbox _inbox;
    private readonly INotifyGatewayClient _notify;
    private readonly ISessionService _session;
    private readonly IDialogService _dialogs;
    private readonly Action _onClose;

    private NotificationItem? _selected;
    private string _status = "Chargement...";
    private bool _isReplyMode;
    private string _replyText = string.Empty;

    public event EventHandler? FocusFirstItemRequested;

    public NotificationsViewModel(
        INotificationInbox inbox,
        INotifyGatewayClient notify,
        ISessionService session,
        IDialogService dialogs,
        Action onClose)
    {
        _inbox = inbox ?? throw new ArgumentNullException(nameof(inbox));
        _notify = notify ?? throw new ArgumentNullException(nameof(notify));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _onClose = onClose ?? throw new ArgumentNullException(nameof(onClose));

        if (_inbox.Items is INotifyCollectionChanged notifyColl)
        {
            notifyColl.CollectionChanged += (_, __) =>
            {
                UpdateStatusAndSelection();
            };
        }

        RefreshCommand = new AsyncRelayCommand(RefreshAsync);
        ReplyCommand = new RelayCommand(OpenReply);
        SendReplyCommand = new AsyncRelayCommand(SendReplyAsync);
        CancelReplyCommand = new RelayCommand(CancelReply);
        ChangeStatusCommand = new AsyncRelayCommand(ChangeStatusAsync);
        ToggleHandledCommand = new AsyncRelayCommand(ToggleHandledAsync);
        DeleteCommand = new AsyncRelayCommand(DeleteSelectedAsync);
        CloseCommand = new RelayCommand(_onClose);
    }

    public ObservableCollection<NotificationItem> Items => _inbox.Items;

    public NotificationItem? SelectedItem
    {
        get => _selected;
        set
        {
            if (SetProperty(ref _selected, value))
            {
                OnPropertyChanged(nameof(SelectedDetailText));
                OnPropertyChanged(nameof(CanReply));
                OnPropertyChanged(nameof(CanToggleHandled));
                _ = MarkSelectedReadAsync();
            }
        }
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public bool IsReplyMode
    {
        get => _isReplyMode;
        private set => SetProperty(ref _isReplyMode, value);
    }

    public string ReplyText
    {
        get => _replyText;
        set => SetProperty(ref _replyText, value);
    }

    public bool CanReply => SelectedItem != null && string.Equals(SelectedItem.Kind, WsMessageTypes.Notify.AdminContactKind, StringComparison.OrdinalIgnoreCase);

    private bool IsStaff
    {
        get
        {
            var token = _session.CurrentUser?.Token;
            return IsStaffFromToken(token);
        }
    }

    private static bool IsStaffFromToken(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        try
        {
            var parts = token.Split('.');
            if (parts.Length < 2) return false;

            static string Pad(string s)
            {
                s = s.Replace('-', '+').Replace('_', '/');
                var mod = s.Length % 4;
                return mod == 0 ? s : s + new string('=', 4 - mod);
            }

            var payloadJson = Encoding.UTF8.GetString(Convert.FromBase64String(Pad(parts[1])));
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("roles", out var rolesEl))
            {
                return false;
            }

            bool IsStaffRole(string? role)
            {
                if (string.IsNullOrWhiteSpace(role)) return false;
                return string.Equals(role, "ROLE_ADMIN", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(role, "ROLE_MODERATOR", StringComparison.OrdinalIgnoreCase) ||
                       string.Equals(role, "moderator", StringComparison.OrdinalIgnoreCase);
            }

            if (rolesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var roleEl in rolesEl.EnumerateArray())
                {
                    if (roleEl.ValueKind == JsonValueKind.String && IsStaffRole(roleEl.GetString()))
                    {
                        return true;
                    }
                }
                return false;
            }

            return rolesEl.ValueKind == JsonValueKind.String && IsStaffRole(rolesEl.GetString());
        }
        catch
        {
            return false;
        }
    }

    public bool CanToggleHandled => IsStaff && SelectedItem != null && string.Equals(SelectedItem.Kind, WsMessageTypes.Notify.AdminContactKind, StringComparison.OrdinalIgnoreCase);

    public string SelectedDetailText => FormatDetail(SelectedItem);

    public ICommand RefreshCommand { get; }
    public ICommand ReplyCommand { get; }
    public ICommand SendReplyCommand { get; }
    public ICommand CancelReplyCommand { get; }
    public ICommand ChangeStatusCommand { get; }
    public ICommand ToggleHandledCommand { get; }
    public ICommand DeleteCommand { get; }
    public ICommand CloseCommand { get; }

    public async Task InitializeAsync()
    {
        await RefreshAsync().ConfigureAwait(true);
        UpdateStatusAndSelection();
    }

    public async Task OnNavigatedToAsync(ShellNavigationContext context, CancellationToken cancellationToken)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return;
        }

        await InitializeAsync().ConfigureAwait(true);
    }

    public Task OnNavigatedFromAsync(ShellNavigationContext context, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    public bool HandleEscape()
    {
        if (IsReplyMode)
        {
            CancelReply();
            return true;
        }

        _onClose();
        return false;
    }

    private async Task RefreshAsync()
    {
        await _notify.RequestInboxSnapshotAsync().ConfigureAwait(true);
        UpdateStatusAndSelection();
    }

    private void OpenReply()
    {
        if (!CanReply)
        {
            return;
        }
        IsReplyMode = true;
        ReplyText = string.Empty;
    }

    private void CancelReply()
    {
        IsReplyMode = false;
        ReplyText = string.Empty;
    }

    private async Task SendReplyAsync()
    {
        var it = SelectedItem;
        if (it == null || !CanReply)
        {
            return;
        }

        var message = (ReplyText ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(message))
        {
            Status = "Réponse vide.";
            return;
        }

        var meId = _session.CurrentUser?.UserId ?? 0;
        var toUserId = 0;
        if (it.FromUserId > 0 && it.FromUserId != meId)
        {
            toUserId = it.FromUserId;
        }
        else if (it.ToUserId.HasValue && it.ToUserId.Value > 0)
        {
            toUserId = it.ToUserId.Value;
        }

        await _notify.SendAsync(
                WsMessageTypes.Notify.AdminContactReply,
                new
                {
                    contactId = it.ContactId,
                    toUserId = toUserId > 0 ? (int?)toUserId : null,
                    message,
                })
            .ConfigureAwait(true);

        Status = "Réponse envoyée.";
        CancelReply();
    }

	    private async Task ChangeStatusAsync()
	    {
	        if (!CanToggleHandled)
	        {
	            return;
	        }

	        var it = SelectedItem;
	        if (it == null || string.IsNullOrWhiteSpace(it.ContactId))
	        {
	            return;
	        }

	        var picked = await _dialogs.Pick(
	                "Notifications",
	                "Choisir un statut :",
	                new[] { "Non traitee", "En cours", "Traitee" },
	                okText: "Valider",
	                cancelText: "Annuler")
	            .ConfigureAwait(true);

	        if (picked == null)
	        {
	            return;
	        }

	        var status = picked switch
	        {
	            "Non traitee" => "open",
	            "En cours" => "in_progress",
	            "Traitee" => "handled",
	            _ => string.Empty
	        };

	        if (string.IsNullOrWhiteSpace(status))
	        {
	            return;
	        }

	        await SetAdminContactStatusAsync(status, $"Statut mis a jour : {picked}.").ConfigureAwait(true);
	    }

	    public async Task ToggleHandledAsync()
	    {
	        var it = SelectedItem;
	        if (!CanToggleHandled || it == null || string.IsNullOrWhiteSpace(it.ContactId))
        {
            return;
        }

        try
        {
            await _notify.SendAsync(
                    WsMessageTypes.Notify.AdminContactSetStatus,
                    new { contactId = it.ContactId, status = it.IsHandled ? "open" : "handled" })
                .ConfigureAwait(true);

            Status = !it.IsHandled ? "Notification marquǸe comme traitǸe." : "Notification marquǸe comme non traitǸe.";
        }
        catch
        {
            Status = "Impossible de modifier l'Ǹtat (connexion notifications ?).";
        }
    }

    public Task SetInProgressAsync() => SetAdminContactStatusAsync("in_progress", "Notification marquǸe comme en cours de traitement.");

    public Task SetOpenAsync() => SetAdminContactStatusAsync("open", "Notification marquǸe comme non traitǸe.");

    private async Task SetAdminContactStatusAsync(string status, string okMessage)
    {
        var it = SelectedItem;
        if (!CanToggleHandled || it == null || string.IsNullOrWhiteSpace(it.ContactId))
        {
            return;
        }

        try
        {
            await _notify.SendAsync(
                    WsMessageTypes.Notify.AdminContactSetStatus,
                    new { contactId = it.ContactId, status })
                .ConfigureAwait(true);

            Status = okMessage;
        }
        catch
        {
            Status = "Impossible de modifier l'Ǹtat (connexion notifications ?).";
        }
    }

    public async Task DeleteSelectedAsync()
    {
        var it = SelectedItem;
        if (it == null || string.IsNullOrWhiteSpace(it.Id))
        {
            return;
        }

        var confirm = await _dialogs
            .Confirm(
                "Confirmer la suppression",
                "Supprimer cette notification ?",
                okText: "Supprimer",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (confirm != true)
        {
            Status = "Suppression annulée.";
            return;
        }

        try
        {
            if (IsStaff &&
                string.Equals(it.Kind, WsMessageTypes.Notify.AdminContactKind, StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(it.ContactId))
            {
                await _notify.SendAsync(WsMessageTypes.Notify.AdminContactDeleteThread, new { contactId = it.ContactId }).ConfigureAwait(true);
                Status = "Thread supprimǸ.";
                return;
            }

            await _notify.SendAsync(WsMessageTypes.Notify.InboxDelete, new { id = it.Id }).ConfigureAwait(true);
            _inbox.Remove(it.Id);
            await _notify.RequestInboxSnapshotAsync().ConfigureAwait(true);
            Status = "Notification supprimée.";
        }
        catch
        {
            Status = "Suppression impossible (connexion notifications ?).";
        }
    }

    public Task MarkSelectedReadAsync()
    {
        var it = SelectedItem;
        if (it == null || string.IsNullOrWhiteSpace(it.Id))
        {
            return Task.CompletedTask;
        }
        return _notify.SendAsync(WsMessageTypes.Notify.InboxMarkRead, new { id = it.Id });
    }

    private void UpdateStatusAndSelection()
    {
        Status = Items.Count == 0 ? "Aucune notification." : $"Notifications : {Items.Count}.";

        if (Items.Count == 0)
        {
            SelectedItem = null;
            return;
        }

        var selectedId = SelectedItem?.Id;
        if (!string.IsNullOrWhiteSpace(selectedId))
        {
            var existing = Items.FirstOrDefault(x => string.Equals(x.Id, selectedId, StringComparison.Ordinal));
            if (existing != null)
            {
                if (!ReferenceEquals(existing, SelectedItem))
                {
                    SelectedItem = existing;
                }
                return;
            }
        }

        SelectedItem = Items[0];
        FocusFirstItemRequested?.Invoke(this, EventArgs.Empty);
    }

    private static string FormatDetail(NotificationItem? item)
    {
        if (item == null)
        {
            return "Aucune notification sélectionnée.";
        }

        var ts = item.CreatedAt.ToLocalTime().ToString("g", CultureInfo.CurrentCulture);

        if (string.Equals(item.Kind, WsMessageTypes.Notify.AdminContactKind, StringComparison.OrdinalIgnoreCase))
        {
            var status = (item.AdminStatus ?? string.Empty).Trim().ToLowerInvariant();
            var label = status switch
            {
                "handled" => "Traitée",
                "in_progress" => "En cours de traitement",
                "open" => "Non traitée",
                _ => (item.IsHandled ? "Traitée" : "Non traitée"),
            };
            var handled = item.IsHandled
                ? $"Traitée{(string.IsNullOrWhiteSpace(item.HandledByUsername) ? "" : $" par {item.HandledByUsername}")}{(item.HandledAt.HasValue ? $" ({item.HandledAt.Value.ToLocalTime():g})" : "")}"
                : "Non traitée";
            return $"{ts}\nDe: {item.FromUsername}\nÉtat: {label}\n\n{item.Message}";
        }

        return $"{ts}\nType: {item.Kind}";
    }
}
