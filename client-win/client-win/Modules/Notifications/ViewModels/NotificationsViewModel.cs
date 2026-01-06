using System;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Collections.Specialized;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Network.Services;
using client_win.Modules.Notifications.Models;
using client_win.Modules.Notifications.Services;
using client_win.Modules.Shell.Services;
using client_win.Modules.User.Services;

namespace client_win.Modules.Notifications.ViewModels;

public sealed class NotificationsViewModel : ObservableObject
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

    public bool CanReply => SelectedItem != null && string.Equals(SelectedItem.Kind, "admin_contact", StringComparison.OrdinalIgnoreCase);

    public string SelectedDetailText => FormatDetail(SelectedItem);

    public ICommand RefreshCommand { get; }
    public ICommand ReplyCommand { get; }
    public ICommand SendReplyCommand { get; }
    public ICommand CancelReplyCommand { get; }
    public ICommand DeleteCommand { get; }
    public ICommand CloseCommand { get; }

    public async Task InitializeAsync()
    {
        await RefreshAsync().ConfigureAwait(true);
        UpdateStatusAndSelection();
    }

    public bool HandleEscape()
    {
        if (IsReplyMode)
        {
            CancelReply();
            return true;
        }
        _onClose();
        return true;
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
                "notify.admin_contact.reply",
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
            await _notify.SendAsync("notify.inbox.delete", new { id = it.Id }).ConfigureAwait(true);
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
        return _notify.SendAsync("notify.inbox.markRead", new { id = it.Id });
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

        if (string.Equals(item.Kind, "admin_contact", StringComparison.OrdinalIgnoreCase))
        {
            return $"{ts}\nDe: {item.FromUsername}\n\n{item.Message}";
        }

        return $"{ts}\nType: {item.Kind}";
    }
}
