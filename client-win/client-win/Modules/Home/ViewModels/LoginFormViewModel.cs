using System;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;

namespace client_win.Modules.Home.ViewModels;

public sealed class LoginFormViewModel : ObservableObject, IDisposable
{
    private string _username = string.Empty;
    private System.Security.SecureString _password = new System.Security.SecureString();
    private string _passwordText = string.Empty;
    private bool _rememberMe;
    private bool _showPassword;

    public LoginFormViewModel(Func<LoginFormViewModel, Task> onSubmit, Action onBack)
    {
        SubmitCommand = new AsyncRelayCommand(() => onSubmit(this));
        BackCommand = new RelayCommand(onBack);
    }

    public string Username
    {
        get => _username;
        set => SetProperty(ref _username, value);
    }

    public System.Security.SecureString Password
    {
        get => _password;
        set
        {
            if (SetProperty(ref _password, value))
            {
                // Synchronize with PasswordText when ShowPassword is true
                if (_showPassword && value != null)
                {
                    _passwordText = value.ToUnsecureString();
                    OnPropertyChanged(nameof(PasswordText));
                }
            }
        }
    }

    public string PasswordText
    {
        get => _passwordText;
        set
        {
            if (SetProperty(ref _passwordText, value))
            {
                // Synchronize with Password SecureString
                if (_showPassword)
                {
                    _password?.Dispose();
                    _password = new System.Security.SecureString();
                    foreach (char c in value ?? string.Empty)
                    {
                        _password.AppendChar(c);
                    }
                    OnPropertyChanged(nameof(Password));
                }
            }
        }
    }

    public bool RememberMe
    {
        get => _rememberMe;
        set => SetProperty(ref _rememberMe, value);
    }

    public bool ShowPassword
    {
        get => _showPassword;
        set
        {
            if (SetProperty(ref _showPassword, value))
            {
                // Sync password representations when toggling visibility
                if (value && _password != null)
                {
                    _passwordText = _password.ToUnsecureString();
                    OnPropertyChanged(nameof(PasswordText));
                }
                else if (!value && !string.IsNullOrEmpty(_passwordText))
                {
                    _password?.Dispose();
                    _password = new System.Security.SecureString();
                    foreach (char c in _passwordText)
                    {
                        _password.AppendChar(c);
                    }
                    OnPropertyChanged(nameof(Password));
                }
            }
        }
    }

    public ICommand SubmitCommand { get; }

    public ICommand BackCommand { get; }

    public void Dispose()
    {
        _password?.Dispose();
    }
}
