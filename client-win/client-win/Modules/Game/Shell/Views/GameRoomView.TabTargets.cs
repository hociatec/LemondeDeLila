using System.Windows;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView
{
    private sealed class TabTarget
    {
        public TabTargetKind Kind { get; }
        public FrameworkElement? Element { get; }
        public FrameworkElement? FocusRoot { get; }

        private TabTarget(
            TabTargetKind kind,
            FrameworkElement? element,
            FrameworkElement? focusRoot)
        {
            Kind = kind;
            Element = element;
            FocusRoot = focusRoot;
        }

        public static TabTarget Name(FrameworkElement element) =>
            new(TabTargetKind.Name, element, element);

        public static TabTarget Chat(FrameworkElement element) =>
            new(TabTargetKind.Chat, element, element);

        public static TabTarget History(FrameworkElement element) =>
            new(TabTargetKind.History, element, element);

        public static TabTarget GameZone(FrameworkElement root) =>
            new(TabTargetKind.GameZone, null, root);
    }

    private enum TabTargetKind
    {
        Name,
        GameZone,
        Chat,
        History,
    }
}
