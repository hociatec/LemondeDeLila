using System;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Error;
using client_win.Modules.User.Models;
using client_win.Modules.User.Services;

namespace client_win.Modules.Home.ViewModels;

public enum HomePage
{
    Landing,
    Login,
    Register
}

public sealed class HomeViewModel : ObservableObject, IDisposable
{
    private readonly IAuthenticationService _authenticationService;
    private readonly ICredentialStore _credentialStore;
    private readonly Modules.Shell.Services.IDialogService? _dialogs;
    private readonly Action<AuthenticatedUser>? _navigateToMainMenu;
    private readonly Action? _requestExit;
    private readonly IDisposable? _errorSubscription;
    private readonly ErrorBus? _errorBus;

    private string _statusMessage = string.Empty;
    private HomePage _currentPage = HomePage.Landing;
    private bool _isBusy;

    public HomeViewModel(string applicationName,
        IAuthenticationService authenticationService,
        ICredentialStore credentialStore,
        Modules.Shell.Services.IDialogService? dialogs,
        Action<AuthenticatedUser>? navigateToMainMenu,
        Action? requestExit,
        ErrorBus? errorBus = null)
    {
        ApplicationName = applicationName;
        _authenticationService = authenticationService ?? throw new ArgumentNullException(nameof(authenticationService));
        _credentialStore = credentialStore ?? throw new ArgumentNullException(nameof(credentialStore));
        _dialogs = dialogs;
        _navigateToMainMenu = navigateToMainMenu;
        _requestExit = requestExit;
        _errorBus = errorBus;
        if (errorBus != null)
        {
            _errorSubscription = errorBus.Subscribe(err => StatusMessage = err.Message);
        }

        LoginForm = new LoginFormViewModel(HandleLoginAsync, ShowLanding);
        RegisterForm = new RegisterFormViewModel(HandleRegistrationAsync, ShowLanding);

        ShowLandingCommand = new RelayCommand(ShowLanding);
        ShowLoginCommand = new RelayCommand(ShowLogin, () => !IsBusy);
        ShowRegisterCommand = new RelayCommand(ShowRegister, () => !IsBusy);
        QuitCommand = new RelayCommand(() => _requestExit?.Invoke());
    }

    public string ApplicationName { get; }

    public LoginFormViewModel LoginForm { get; }

    public RegisterFormViewModel RegisterForm { get; }

    public ICommand ShowLandingCommand { get; }

    public ICommand ShowLoginCommand { get; }

    public ICommand ShowRegisterCommand { get; }

    public ICommand QuitCommand { get; }

    public string StatusMessage
    {
        get => _statusMessage;
        set => SetProperty(ref _statusMessage, value);
    }

    public HomePage CurrentPage
    {
        get => _currentPage;
        set
        {
            if (SetProperty(ref _currentPage, value))
            {
                OnPropertyChanged(nameof(IsLandingVisible));
                OnPropertyChanged(nameof(IsLoginVisible));
                OnPropertyChanged(nameof(IsRegisterVisible));
            }
        }
    }

    public bool IsLandingVisible => CurrentPage == HomePage.Landing;

    public bool IsLoginVisible => CurrentPage == HomePage.Login;

    public bool IsRegisterVisible => CurrentPage == HomePage.Register;

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                (ShowLoginCommand as RelayCommand)?.RaiseCanExecuteChanged();
                (ShowRegisterCommand as RelayCommand)?.RaiseCanExecuteChanged();
            }
        }
    }

    public async Task InitializeAsync()
    {
        var stored = await _credentialStore.LoadAsync();
        if (stored != null && stored.RememberMe)
        {
            LoginForm.Username = stored.Username;

            // SECURITY: Reconstruit le SecureString depuis les bytes déchiffrés
            // Le mot de passe n'a jamais été stocké en string, seulement en bytes chiffrés
            LoginForm.Password = SecureStringExtensions.FromBytes(stored.PasswordBytes);

            LoginForm.RememberMe = true;
            StatusMessage = "Identifiants chargés. Vous pouvez vous connecter.";
        }
        else
        {
            StatusMessage = string.Empty;
        }
    }

    private void ShowLanding()
    {
        CurrentPage = HomePage.Landing;
        StatusMessage = string.Empty;
    }

    private void ShowLogin()
    {
        CurrentPage = HomePage.Login;
        StatusMessage = string.Empty;
    }

    private void ShowRegister()
    {
        CurrentPage = HomePage.Register;
        StatusMessage = string.Empty;
    }

    private async Task HandleLoginAsync(LoginFormViewModel form)
    {
        // Validation centralisée pour éviter la duplication
        var (usernameValid, usernameError) = Services.AuthenticationValidator.ValidateUsername(form.Username);
        if (!usernameValid)
        {
            StatusMessage = usernameError!;
            return;
        }

        var (passwordValid, passwordError) = Services.AuthenticationValidator.ValidatePassword(form.Password);
        if (!passwordValid)
        {
            StatusMessage = passwordError!;
            return;
        }

        string username = form.Username!.Trim();
        var password = form.Password!;

        try
        {
            IsBusy = true;
            StatusMessage = "Connexion en cours...";
            LoginResult result = await _authenticationService.LoginAsync(username, password, form.RememberMe);
            if (result.Success && result.Username != null && result.Token != null)
            {
                if (form.RememberMe)
                {
                    // SECURITY: Convertit SecureString en bytes pour chiffrement DPAPI immédiat
                    // Minimise le temps d'exposition du mot de passe en texte clair en mémoire
                    byte[] passwordBytes = password.ToEncryptableBytes();
                    try
                    {
                        await _credentialStore.SaveAsync(new StoredCredentials(
                            form.Username ?? string.Empty,
                            passwordBytes,
                            true));
                    }
                    finally
                    {
                        // Efface les bytes sensibles de la mémoire après usage
                        Array.Clear(passwordBytes, 0, passwordBytes.Length);
                    }
                }
                else
                {
                    await _credentialStore.ClearAsync();
                }

                StatusMessage = $"Connexion réussie. Bienvenue {result.Username}.";
                var user = new AuthenticatedUser(result.Username, result.Token, result.UserId ?? 0);
                _navigateToMainMenu?.Invoke(user);
                ShowLanding();
            }
            else
            {
                StatusMessage = result.ErrorMessage ?? "La connexion a échoué.";
            }
        }
        catch (Exception ex)
        {
            StatusMessage = "Erreur de connexion.";
            _errorBus?.Publish(new AppError("Connexion échouée", ErrorSeverity.Error, context: "home.login", detail: ex.Message));
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task HandleRegistrationAsync(RegisterFormViewModel form)
    {
        // Validation centralisée pour éviter la duplication
        var (usernameValid, usernameError) = Services.AuthenticationValidator.ValidateUsername(form.Username);
        if (!usernameValid)
        {
            StatusMessage = usernameError!;
            return;
        }

        var (emailValid, emailError) = Services.AuthenticationValidator.ValidateEmail(form.Email);
        if (!emailValid)
        {
            StatusMessage = emailError!;
            return;
        }

        var (passwordValid, passwordError) = Services.AuthenticationValidator.ValidatePassword(form.Password);
        if (!passwordValid)
        {
            StatusMessage = passwordError!;
            return;
        }

        string username = form.Username!.Trim();
        string email = form.Email!.Trim();
        var password = form.Password!;

        try
        {
            IsBusy = true;
            StatusMessage = "Création du compte...";
            RegistrationResult result = await _authenticationService.RegisterAsync(username, email, password);
            if (result.Success)
            {
                StatusMessage = "Compte créé, vous pouvez vous connecter.";
                if (_dialogs != null)
                {
                    await _dialogs.ShowInfo("Inscription", $"Compte créé pour {username}. Vous pouvez vous connecter.").ConfigureAwait(true);
                }
                LoginForm.Username = username;
                LoginForm.Password = new System.Security.SecureString();
                ShowLogin();
            }
            else
            {
                StatusMessage = result.ErrorMessage ?? "L'inscription a échoué.";
                if (_dialogs != null)
                {
                    await _dialogs.ShowError("Inscription", StatusMessage).ConfigureAwait(true);
                }
            }
        }
        catch (Exception ex)
        {
            StatusMessage = "Erreur lors de l'inscription.";
            if (_dialogs != null)
            {
                await _dialogs.ShowError("Inscription", ex.Message).ConfigureAwait(true);
            }
            _errorBus?.Publish(new AppError("Inscription échouée", ErrorSeverity.Error, context: "home.register", detail: ex.Message));
        }
        finally
        {
            IsBusy = false;
        }
    }

    public void Dispose()
    {
        _errorSubscription?.Dispose();
    }
}
