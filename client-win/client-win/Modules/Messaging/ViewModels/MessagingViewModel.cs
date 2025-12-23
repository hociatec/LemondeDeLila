using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Messaging.Models;
using client_win.Modules.Messaging.Services;

namespace client_win.Modules.Messaging.ViewModels;

public sealed class MessagingViewModel : ObservableObject
{
    private readonly IMessagingService _service;
    private readonly Action _onClose;
    private MessagingBox _selectedBox = MessagingBox.Inbox;
    private MessagingMessage? _selectedMessage;
    private MessagingUser? _conversationUser;
    private string _inputText = string.Empty;
    private string _searchQuery = string.Empty;
    private string _composeRecipient = string.Empty;
    private string _composeSubject = string.Empty;
    private string _composeBody = string.Empty;
    private string _status = "Chargement...";
    private bool _isBusy;
    private bool _isComposeMode;

    public MessagingViewModel(IMessagingService service, Action onClose)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _onClose = onClose ?? throw new ArgumentNullException(nameof(onClose));

        BoxMessages = new ObservableCollection<MessagingMessage>();
        ConversationMessages = new ObservableCollection<MessagingMessage>();

        OpenConversationCommand = new AsyncRelayCommand(OpenConversationAsync);
        SendCommand = new AsyncRelayCommand(SendAsync);
        SearchUserCommand = new AsyncRelayCommand(SearchUserAsync);
        SendComposeCommand = new AsyncRelayCommand(SendComposeAsync);
        DeleteCommand = new AsyncRelayCommand(DeleteAsync);
        RestoreCommand = new AsyncRelayCommand(RestoreAsync);
        CloseCommand = new RelayCommand(_onClose);
    }

    public ObservableCollection<MessagingMessage> BoxMessages { get; }
    public ObservableCollection<MessagingMessage> ConversationMessages { get; }

    public MessagingBox SelectedBox
    {
        get => _selectedBox;
        set
        {
            if (SetProperty(ref _selectedBox, value))
            {
                // CORRECTION: Utilise Task.Run pour éviter de bloquer le thread UI et gère les exceptions
                Task.Run(async () =>
                {
                    try
                    {
                        await LoadBoxAsync(value).ConfigureAwait(false);
                    }
                    catch (Exception ex)
                    {
                        Status = $"Erreur lors du chargement de la boîte : {ex.Message}";
                    }
                });
            }
        }
    }

    public MessagingMessage? SelectedMessage
    {
        get => _selectedMessage;
        set => SetProperty(ref _selectedMessage, value);
    }

    public MessagingUser? ConversationUser
    {
        get => _conversationUser;
        private set => SetProperty(ref _conversationUser, value);
    }

    public string InputText
    {
        get => _inputText;
        set => SetProperty(ref _inputText, value);
    }

    public string SearchQuery
    {
        get => _searchQuery;
        set => SetProperty(ref _searchQuery, value);
    }

    public string ComposeRecipient
    {
        get => _composeRecipient;
        set => SetProperty(ref _composeRecipient, value);
    }

    public string ComposeSubject
    {
        get => _composeSubject;
        set => SetProperty(ref _composeSubject, value);
    }

    public string ComposeBody
    {
        get => _composeBody;
        set => SetProperty(ref _composeBody, value);
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set => SetProperty(ref _isBusy, value);
    }

    public bool IsComposeMode
    {
        get => _isComposeMode;
        set => SetProperty(ref _isComposeMode, value);
    }

    public ICommand OpenConversationCommand { get; }
    public ICommand SendCommand { get; }
    public ICommand SearchUserCommand { get; }
    public ICommand SendComposeCommand { get; }
    public ICommand DeleteCommand { get; }
    public ICommand RestoreCommand { get; }
    public ICommand CloseCommand { get; }

    public async Task InitializeAsync()
    {
        await LoadBoxAsync(SelectedBox).ConfigureAwait(true);
    }

    private async Task LoadBoxAsync(MessagingBox box)
    {
        if (IsBusy)
        {
            return;
        }
        IsBusy = true;
        try
        {
            BoxMessages.Clear();
            var items = await _service.GetBoxAsync(box).ConfigureAwait(true);
            foreach (var item in items.OrderByDescending(m => m.CreatedAt))
            {
                BoxMessages.Add(item);
            }
            var boxName = box switch
            {
                MessagingBox.Inbox => "inbox",
                MessagingBox.Outbox => "outbox",
                MessagingBox.Deleted => "deleted",
                _ => "unknown"
            };
            Status = $"Boîte {boxName} : {BoxMessages.Count} messages.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors du chargement : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task OpenConversationAsync()
    {
        if (SelectedMessage == null)
        {
            return;
        }

        var otherUser = SelectedMessage.IsSent ? SelectedMessage.Recipient : SelectedMessage.Sender;
        ConversationUser = otherUser;
        await LoadConversationAsync(otherUser.Id).ConfigureAwait(true);
    }

    private async Task LoadConversationAsync(int userId)
    {
        if (userId <= 0 || IsBusy)
        {
            return;
        }
        IsBusy = true;
        try
        {
            ConversationMessages.Clear();
            var items = await _service.GetConversationAsync(userId).ConfigureAwait(true);
            foreach (var item in items.OrderBy(m => m.CreatedAt))
            {
                ConversationMessages.Add(item);
            }
            Status = $"Conversation avec {ConversationUser?.Username ?? "utilisateur"} : {ConversationMessages.Count} messages.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors du chargement de la conversation : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SendAsync()
    {
        if (ConversationUser == null || string.IsNullOrWhiteSpace(InputText) || IsBusy)
        {
            return;
        }

        IsBusy = true;
        try
        {
            var message = await _service.SendAsync(ConversationUser.Id, InputText.Trim()).ConfigureAwait(true);
            if (message != null)
            {
                ConversationMessages.Add(message);
                BoxMessages.Insert(0, message);
                SelectedMessage = message;
                InputText = string.Empty;
                Status = "Message envoyé.";
            }
            else
            {
                Status = "Échec de l'envoi du message.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de l'envoi : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SendComposeAsync()
    {
        if (IsBusy || string.IsNullOrWhiteSpace(ComposeRecipient) || string.IsNullOrWhiteSpace(ComposeBody))
        {
            return;
        }

        IsBusy = true;
        try
        {
            var recipient = await _service.SearchUserAsync(ComposeRecipient.Trim()).ConfigureAwait(true);
            if (recipient == null)
            {
                Status = "Utilisateur introuvable.";
                return;
            }

            var messageText = ComposeBody.Trim();
            var subject = string.IsNullOrWhiteSpace(ComposeSubject) ? null : ComposeSubject.Trim();

            var message = await _service.SendAsync(recipient.Id, messageText, subject).ConfigureAwait(true);
            if (message != null)
            {
                ConversationUser = recipient;
                ConversationMessages.Clear();
                ConversationMessages.Add(message);
                BoxMessages.Insert(0, message);
                SelectedMessage = message;
                ComposeRecipient = string.Empty;
                ComposeSubject = string.Empty;
                ComposeBody = string.Empty;
                IsComposeMode = false;
                Status = "Message envoyé.";
            }
            else
            {
                Status = "Échec de l'envoi du message.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de l'envoi : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task SearchUserAsync()
    {
        if (IsBusy || string.IsNullOrWhiteSpace(SearchQuery))
        {
            return;
        }

        IsBusy = true;
        try
        {
            var result = await _service.SearchUserAsync(SearchQuery.Trim()).ConfigureAwait(true);
            if (result != null)
            {
                ConversationUser = result;
                await LoadConversationAsync(result.Id).ConfigureAwait(true);
                Status = $"Conversation ouverte avec {result.Username}.";
            }
            else
            {
                Status = "Utilisateur introuvable.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la recherche : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeleteAsync()
    {
        var message = SelectedMessage;
        if (message == null || IsBusy)
        {
            return;
        }

        IsBusy = true;
        try
        {
            var deleted = await _service.DeleteAsync(message.Id).ConfigureAwait(true);
            if (deleted != null)
            {
                ReplaceMessage(deleted);
                Status = "Message supprimé.";
            }
            else
            {
                Status = "Échec de la suppression.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la suppression : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task RestoreAsync()
    {
        var message = SelectedMessage;
        if (message == null || IsBusy)
        {
            return;
        }

        IsBusy = true;
        try
        {
            var restored = await _service.RestoreAsync(message.Id).ConfigureAwait(true);
            if (restored != null)
            {
                ReplaceMessage(restored);
                Status = "Message restauré.";
            }
            else
            {
                Status = "Échec de la restauration.";
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur lors de la restauration : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ReplaceMessage(MessagingMessage updated)
    {
        ReplaceInCollection(BoxMessages, updated);
        ReplaceInCollection(ConversationMessages, updated);
        SelectedMessage = updated;
    }

    private static void ReplaceInCollection(ObservableCollection<MessagingMessage> collection, MessagingMessage updated)
    {
        for (int i = 0; i < collection.Count; i++)
        {
            if (string.Equals(collection[i].Id, updated.Id, StringComparison.OrdinalIgnoreCase))
            {
                collection[i] = updated;
                return;
            }
        }
    }
}
