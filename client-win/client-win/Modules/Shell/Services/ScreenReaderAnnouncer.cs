using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;
using Serilog;

namespace client_win.Modules.Shell.Services;

public sealed class ScreenReaderAnnouncer : IScreenReaderAnnouncer, IDisposable
{
    private readonly NvdaBridge? _nvda;

    public ScreenReaderAnnouncer()
    {
        try
        {
            _nvda = NvdaBridge.TryCreate();
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "ScreenReaderAnnouncer: NVDA init failed");
            _nvda = null;
        }
    }

    public void AnnouncePolite(string message) => Announce(message, interrupt: false);

    public void AnnounceAssertive(string message) => Announce(message, interrupt: true);

    public bool IsRunning => _nvda?.IsRunning == true;

    public void CancelSpeech()
    {
        try
        {
            if (_nvda?.IsRunning == true)
            {
                _nvda.CancelSpeech();
            }
        }
        catch
        {
            // ignore
        }
    }

    private void Announce(string message, bool interrupt)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        if (!IsAppActive())
        {
            return;
        }

        // Best-effort : NVDA si disponible, sinon on ne fait rien (les live regions WPF restent en place).
        try
        {
            if (_nvda?.IsRunning == true)
            {
                if (interrupt)
                {
                    _nvda.CancelSpeech();
                }
                _nvda.Speak(message);
            }
        }
        catch
        {
            // ignore
        }
    }

    private static bool IsAppActive()
    {
        try
        {
            var app = Application.Current;
            if (app == null)
            {
                return true;
            }

            foreach (var window in app.Windows)
            {
                if (window is Window w && w.IsActive)
                {
                    return true;
                }
            }

            // Fallback: si aucune fenêtre connue, ne pas bloquer.
            return app.MainWindow == null;
        }
        catch
        {
            return true;
        }
    }

    public void Dispose()
    {
        _nvda?.Dispose();
    }

    private sealed class NvdaBridge : IDisposable
    {
        private readonly nint _handle;
        private readonly Func<int> _testIfRunning;
        private readonly Func<string, int> _speakText;
        private readonly Func<int>? _cancelSpeech;

        private NvdaBridge(nint handle, Func<int> testIfRunning, Func<string, int> speakText, Func<int>? cancelSpeech)
        {
            _handle = handle;
            _testIfRunning = testIfRunning;
            _speakText = speakText;
            _cancelSpeech = cancelSpeech;
        }

        public bool IsRunning
        {
            get
            {
                try
                {
                    return _testIfRunning() == 0;
                }
                catch
                {
                    return false;
                }
            }
        }

        public void Speak(string text)
        {
            _speakText(text);
        }

        public void CancelSpeech()
        {
            _cancelSpeech?.Invoke();
        }

        public void Dispose()
        {
            try
            {
                if (_handle != nint.Zero)
                {
                    NativeLibrary.Free(_handle);
                }
            }
            catch
            {
                // ignore
            }
        }

        public static NvdaBridge? TryCreate()
        {
            var baseDir = AppContext.BaseDirectory;
            var archFolder = Environment.Is64BitProcess ? "x64" : "x86";
            var libsDir = Path.Combine(baseDir, "libs", archFolder);

            // Les DLL sont embarquées dans le repo sous client-win/client-win/libs.
            // À l'exécution elles sont copiées dans le répertoire de sortie (config csproj).
            var candidates = Environment.Is64BitProcess
                ? new[]
                {
                    Path.Combine(libsDir, "nvdaControllerClient64.dll"),
                    Path.Combine(libsDir, "nvdaControllerClient.dll"),
                }
                : new[]
                {
                    Path.Combine(libsDir, "nvdaControllerClient32.dll"),
                    Path.Combine(libsDir, "nvdaControllerClient.dll"),
                };

            foreach (var path in candidates)
            {
                if (!File.Exists(path))
                {
                    continue;
                }

                if (!NativeLibrary.TryLoad(path, out var handle))
                {
                    continue;
                }

                try
                {
                    // Deux variantes existent selon les builds (java log: "controller API" vs "controller client API").
                    var test = TryGetExport(handle, new[] { "nvdaControllerClient_testIfRunning", "nvdaController_testIfRunning" });
                    var speak = TryGetExport(handle, new[] { "nvdaControllerClient_speakText", "nvdaController_speakText" });
                    var cancel = TryGetExport(handle, new[] { "nvdaControllerClient_cancelSpeech", "nvdaController_cancelSpeech" });
                    if (test == nint.Zero || speak == nint.Zero)
                    {
                        NativeLibrary.Free(handle);
                        continue;
                    }

                    var testDel = Marshal.GetDelegateForFunctionPointer<NvdaTestIfRunningDelegate>(test);
                    var speakDel = Marshal.GetDelegateForFunctionPointer<NvdaSpeakTextDelegate>(speak);
                    Func<int>? cancelFn = null;
                    if (cancel != nint.Zero)
                    {
                        var cancelDel = Marshal.GetDelegateForFunctionPointer<NvdaCancelSpeechDelegate>(cancel);
                        cancelFn = () => cancelDel();
                    }

                    Func<int> testFn = () => testDel();
                    Func<string, int> speakFn = (text) => speakDel(text);

                    Log.Information("NVDA controller chargé: {Path}", path);
                    return new NvdaBridge(handle, testFn, speakFn, cancelFn);
                }
                catch
                {
                    try { NativeLibrary.Free(handle); } catch { }
                }
            }

            return null;
        }

        private static nint TryGetExport(nint handle, string[] names)
        {
            foreach (var name in names)
            {
                if (NativeLibrary.TryGetExport(handle, name, out var ptr))
                {
                    return ptr;
                }
            }
            return nint.Zero;
        }

        [UnmanagedFunctionPointer(CallingConvention.Cdecl, CharSet = CharSet.Unicode)]
        private delegate int NvdaSpeakTextDelegate([MarshalAs(UnmanagedType.LPWStr)] string text);

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate int NvdaTestIfRunningDelegate();

        [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
        private delegate int NvdaCancelSpeechDelegate();
    }
}
