using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Input;
using client_win.Core.Accessibility;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;
using Microsoft.Extensions.DependencyInjection;
using client_win.Modules.Shell.ViewModels;

namespace client_win
{
    public partial class MainWindow : Window
    {
        private readonly ShellViewModel _shell;

        public MainWindow()
        {
            InitializeComponent();

            var host = AppBootstrapper.Build(RootHost);
            SpaceKeyAnnouncer.Initialize(host.Services.GetRequiredService<IScreenReaderAnnouncer>());
            _shell = new ShellViewModel(host, requestClose: Close);
            DataContext = _shell;

            Loaded += OnLoaded;
            PreviewKeyDown += OnPreviewKeyDown;
            PreviewMouseDown += OnPreviewMouseDown;
            Closing += OnClosing;
            Activated += OnActivated;
        }

        private void OnClosing(object? sender, CancelEventArgs e) =>
            _shell.OnClosing(e);

        private void OnPreviewKeyDown(object sender, KeyEventArgs e) =>
            _shell.OnPreviewKeyDown(this, e);

        private void OnPreviewMouseDown(object sender, MouseButtonEventArgs e) =>
            _shell.OnPreviewMouseDown(e);

        private void OnActivated(object? sender, EventArgs e) =>
            _shell.OnActivated();

        private async void OnLoaded(object sender, RoutedEventArgs e) =>
            await _shell.OnLoadedAsync().ConfigureAwait(true);

        protected override async void OnClosed(EventArgs e)
        {
            await _shell.OnClosedAsync();
            base.OnClosed(e);
        }
    }
}
