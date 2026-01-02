using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Social.Models;
using client_win.Modules.Social.Services;

namespace client_win.Modules.Social.ViewModels;

public enum SocialSection
{
    Friends,
    IncomingRequests,
    OutgoingRequests,
    Blocked,
    Search,
    Profile
}

public sealed class SocialViewModel : ObservableObject
{
    private readonly ISocialService _service;
    private readonly Action? _onClose;
    private SocialSection _selectedSection;
    private string _status = "Chargement...";
    private bool _isBusy;
    private string _searchQuery = string.Empty;
    private string _profileBio = string.Empty;
    private string _profileVisibility = "public";
    private SocialProfile? _profile;

    private SocialUser? _selectedFriend;
    private SocialFriendRequest? _selectedIncomingRequest;
    private SocialFriendRequest? _selectedOutgoingRequest;
    private SocialUser? _selectedBlockedUser;
    private SocialUser? _selectedSearchUser;
    private SocialSection? _pendingSection;

    public SocialViewModel(ISocialService service, Action? onClose = null)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _onClose = onClose;

        Friends = new ObservableCollection<SocialUser>();
        IncomingRequests = new ObservableCollection<SocialFriendRequest>();
        OutgoingRequests = new ObservableCollection<SocialFriendRequest>();
        BlockedUsers = new ObservableCollection<SocialUser>();
        SearchResults = new ObservableCollection<SocialUser>();

        AcceptRequestCommand = new AsyncRelayCommand(AcceptRequestAsync, () => SelectedIncomingRequest != null && !IsBusy);
        RejectRequestCommand = new AsyncRelayCommand(RejectRequestAsync, () => SelectedIncomingRequest != null && !IsBusy);
        CancelRequestCommand = new AsyncRelayCommand(CancelRequestAsync, () => SelectedOutgoingRequest != null && !IsBusy);
        RemoveFriendCommand = new AsyncRelayCommand(RemoveFriendAsync, () => SelectedFriend != null && !IsBusy);
        BlockUserCommand = new AsyncRelayCommand(BlockUserAsync, () => GetSelectedUserId() > 0 && !IsBusy);
        UnblockUserCommand = new AsyncRelayCommand(UnblockUserAsync, () => SelectedBlockedUser != null && !IsBusy);
        SendRequestCommand = new AsyncRelayCommand(SendRequestAsync, () => SelectedSearchUser != null && !IsBusy);
        SearchCommand = new AsyncRelayCommand(SearchAsync, () => !IsBusy);
        UpdateProfileCommand = new AsyncRelayCommand(UpdateProfileAsync, () => !IsBusy);
        RefreshCommand = new AsyncRelayCommand(RefreshAsync, () => !IsBusy);
        CloseCommand = new RelayCommand(HandleClose);

        _selectedSection = SocialSection.Friends;
    }

    public ObservableCollection<SocialUser> Friends { get; }
    public ObservableCollection<SocialFriendRequest> IncomingRequests { get; }
    public ObservableCollection<SocialFriendRequest> OutgoingRequests { get; }
    public ObservableCollection<SocialUser> BlockedUsers { get; }
    public ObservableCollection<SocialUser> SearchResults { get; }

    public ICommand AcceptRequestCommand { get; }
    public ICommand RejectRequestCommand { get; }
    public ICommand CancelRequestCommand { get; }
    public ICommand RemoveFriendCommand { get; }
    public ICommand BlockUserCommand { get; }
    public ICommand UnblockUserCommand { get; }
    public ICommand SendRequestCommand { get; }
    public ICommand SearchCommand { get; }
    public ICommand UpdateProfileCommand { get; }
    public ICommand RefreshCommand { get; }
    public ICommand CloseCommand { get; }

    public SocialSection SelectedSection
    {
        get => _selectedSection;
        set
        {
            if (SetProperty(ref _selectedSection, value))
            {
                _ = LoadSectionAsync(value);
            }
        }
    }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                RaiseCommandStates();
            }
        }
    }

    public string SearchQuery
    {
        get => _searchQuery;
        set => SetProperty(ref _searchQuery, value);
    }

    public string ProfileBio
    {
        get => _profileBio;
        set => SetProperty(ref _profileBio, value);
    }

    public string ProfileVisibility
    {
        get => _profileVisibility;
        set => SetProperty(ref _profileVisibility, value);
    }

    public SocialProfile? Profile
    {
        get => _profile;
        private set => SetProperty(ref _profile, value);
    }

    public sealed record VisibilityOption(string Value, string Label);

    public VisibilityOption[] VisibilityOptions { get; } =
    {
        new("public", "Public"),
        new("friends", "Amis"),
        new("private", "Privé"),
    };

    public SocialUser? SelectedFriend
    {
        get => _selectedFriend;
        set
        {
            if (SetProperty(ref _selectedFriend, value))
            {
                RaiseCommandStates();
            }
        }
    }

    public SocialFriendRequest? SelectedIncomingRequest
    {
        get => _selectedIncomingRequest;
        set
        {
            if (SetProperty(ref _selectedIncomingRequest, value))
            {
                RaiseCommandStates();
            }
        }
    }

    public SocialFriendRequest? SelectedOutgoingRequest
    {
        get => _selectedOutgoingRequest;
        set
        {
            if (SetProperty(ref _selectedOutgoingRequest, value))
            {
                RaiseCommandStates();
            }
        }
    }

    public SocialUser? SelectedBlockedUser
    {
        get => _selectedBlockedUser;
        set
        {
            if (SetProperty(ref _selectedBlockedUser, value))
            {
                RaiseCommandStates();
            }
        }
    }

    public SocialUser? SelectedSearchUser
    {
        get => _selectedSearchUser;
        set
        {
            if (SetProperty(ref _selectedSearchUser, value))
            {
                RaiseCommandStates();
            }
        }
    }

    public async Task InitializeAsync()
    {
        await LoadSectionAsync(SelectedSection).ConfigureAwait(true);
    }

    private async Task LoadSectionAsync(SocialSection section)
    {
        if (IsBusy)
        {
            _pendingSection = section;
            return;
        }

        IsBusy = true;
        try
        {
            switch (section)
            {
                case SocialSection.Friends:
                    await LoadFriendsAsync().ConfigureAwait(true);
                    break;
                case SocialSection.IncomingRequests:
                    await LoadIncomingRequestsAsync().ConfigureAwait(true);
                    break;
                case SocialSection.OutgoingRequests:
                    await LoadOutgoingRequestsAsync().ConfigureAwait(true);
                    break;
                case SocialSection.Blocked:
                    await LoadBlockedAsync().ConfigureAwait(true);
                    break;
                case SocialSection.Search:
                    await SearchAsync().ConfigureAwait(true);
                    break;
                case SocialSection.Profile:
                    await LoadProfileAsync().ConfigureAwait(true);
                    break;
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur social: {ex.Message}";
        }
        finally
        {
            IsBusy = false;

            var pending = _pendingSection;
            _pendingSection = null;
            if (pending.HasValue && pending.Value != section)
            {
                await LoadSectionAsync(pending.Value).ConfigureAwait(true);
            }
        }
    }

    private async Task LoadFriendsAsync()
    {
        var friends = await _service.GetFriendsAsync().ConfigureAwait(true);
        Friends.Clear();
        foreach (var friend in friends)
        {
            Friends.Add(friend);
        }
        Status = $"Amis: {Friends.Count}.";
    }

    private async Task LoadIncomingRequestsAsync()
    {
        var requests = await _service.GetRequestsAsync("incoming").ConfigureAwait(true);
        IncomingRequests.Clear();
        foreach (var request in requests)
        {
            IncomingRequests.Add(request);
        }
        Status = $"Demandes reçues: {IncomingRequests.Count}.";
    }

    private async Task LoadOutgoingRequestsAsync()
    {
        var requests = await _service.GetRequestsAsync("outgoing").ConfigureAwait(true);
        OutgoingRequests.Clear();
        foreach (var request in requests)
        {
            OutgoingRequests.Add(request);
        }
        Status = $"Demandes envoyées: {OutgoingRequests.Count}.";
    }

    private async Task LoadBlockedAsync()
    {
        var blocked = await _service.GetBlockedAsync().ConfigureAwait(true);
        BlockedUsers.Clear();
        foreach (var user in blocked)
        {
            BlockedUsers.Add(user);
        }
        Status = $"Bloques: {BlockedUsers.Count}.";
    }

    private async Task LoadProfileAsync()
    {
        Profile = await _service.GetProfileAsync().ConfigureAwait(true);
        if (Profile != null)
        {
            ProfileBio = Profile.Bio;
            ProfileVisibility = Profile.Visibility;
            Status = "Profil chargé.";
        }
        else
        {
            Status = "Profil indisponible.";
        }
    }

    private async Task AcceptRequestAsync()
    {
        if (SelectedIncomingRequest == null)
        {
            return;
        }

        if (await _service.AcceptFriendAsync(SelectedIncomingRequest.Requester.Id).ConfigureAwait(true))
        {
            await RefreshAllAsync().ConfigureAwait(true);
            Status = "Demande acceptée.";
        }
    }

    private async Task RejectRequestAsync()
    {
        if (SelectedIncomingRequest == null)
        {
            return;
        }

        if (await _service.RejectFriendAsync(SelectedIncomingRequest.Requester.Id).ConfigureAwait(true))
        {
            await RefreshAllAsync().ConfigureAwait(true);
            Status = "Demande refusée.";
        }
    }

    private async Task CancelRequestAsync()
    {
        if (SelectedOutgoingRequest == null)
        {
            return;
        }

        if (await _service.CancelRequestAsync(SelectedOutgoingRequest.Addressee.Id).ConfigureAwait(true))
        {
            await RefreshAllAsync().ConfigureAwait(true);
            Status = "Demande annulée.";
        }
    }

    private async Task RemoveFriendAsync()
    {
        if (SelectedFriend == null)
        {
            return;
        }

        if (await _service.RemoveFriendAsync(SelectedFriend.Id).ConfigureAwait(true))
        {
            await RefreshAllAsync().ConfigureAwait(true);
            Status = "Ami retiré.";
        }
    }

    private async Task BlockUserAsync()
    {
        int targetId = GetSelectedUserId();
        if (targetId <= 0)
        {
            return;
        }

        if (await _service.BlockUserAsync(targetId).ConfigureAwait(true))
        {
            await RefreshAllAsync().ConfigureAwait(true);
            Status = "Utilisateur bloqué.";
        }
    }

    private async Task UnblockUserAsync()
    {
        if (SelectedBlockedUser == null)
        {
            return;
        }

        if (await _service.UnblockUserAsync(SelectedBlockedUser.Id).ConfigureAwait(true))
        {
            await RefreshAllAsync().ConfigureAwait(true);
            Status = "Utilisateur débloqué.";
        }
    }

    private async Task SendRequestAsync()
    {
        if (SelectedSearchUser == null)
        {
            return;
        }

        if (await _service.RequestFriendAsync(SelectedSearchUser.Id).ConfigureAwait(true))
        {
            await RefreshAllAsync().ConfigureAwait(true);
            Status = "Demande envoyée.";
        }
    }

    private async Task SearchAsync()
    {
        SearchResults.Clear();
        if (string.IsNullOrWhiteSpace(SearchQuery))
        {
            Status = "Saisissez un pseudo pour rechercher.";
            return;
        }

        foreach (var user in await _service.SearchUsersAsync(SearchQuery).ConfigureAwait(true))
        {
            SearchResults.Add(user);
        }
        Status = $"Résultats: {SearchResults.Count}.";
    }

    private async Task UpdateProfileAsync()
    {
        var updated = await _service.UpdateProfileAsync(ProfileBio, ProfileVisibility).ConfigureAwait(true);
        if (updated != null)
        {
            Profile = updated;
            Status = "Profil mis à jour.";
            MessageBox.Show(
                "Votre profil a été mis à jour.",
                "Profil enregistré",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
        }
    }

    private async Task RefreshAsync()
    {
        await RefreshAllAsync().ConfigureAwait(true);
    }

    private async Task RefreshAllAsync()
    {
        await LoadFriendsAsync().ConfigureAwait(true);
        await LoadIncomingRequestsAsync().ConfigureAwait(true);
        await LoadOutgoingRequestsAsync().ConfigureAwait(true);
        await LoadBlockedAsync().ConfigureAwait(true);
        if (SelectedSection == SocialSection.Search)
        {
            await SearchAsync().ConfigureAwait(true);
        }
        if (SelectedSection == SocialSection.Profile)
        {
            await LoadProfileAsync().ConfigureAwait(true);
        }
    }

    private int GetSelectedUserId()
    {
        return SelectedSection switch
        {
            SocialSection.Friends => SelectedFriend?.Id ?? 0,
            SocialSection.IncomingRequests => SelectedIncomingRequest?.Requester.Id ?? 0,
            SocialSection.OutgoingRequests => SelectedOutgoingRequest?.Addressee.Id ?? 0,
            SocialSection.Blocked => SelectedBlockedUser?.Id ?? 0,
            SocialSection.Search => SelectedSearchUser?.Id ?? 0,
            _ => 0
        };
    }

    private void RaiseCommandStates()
    {
        (AcceptRequestCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (RejectRequestCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (CancelRequestCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (RemoveFriendCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (BlockUserCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (UnblockUserCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (SendRequestCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (SearchCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (UpdateProfileCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (RefreshCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
    }

    private void HandleClose()
    {
        _onClose?.Invoke();
    }
}
