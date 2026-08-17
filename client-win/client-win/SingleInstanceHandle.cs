using System;
using System.IO;

namespace client_win
{
    internal sealed class SingleInstanceHandle : IDisposable
    {
        private readonly FileStream _lockFile;

        private SingleInstanceHandle(FileStream lockFile)
        {
            _lockFile = lockFile;
        }

        public static SingleInstanceHandle Acquire(string lockPath)
        {
            var lockFile = new FileStream(
                lockPath,
                FileMode.OpenOrCreate,
                FileAccess.ReadWrite,
                FileShare.None);
            return new SingleInstanceHandle(lockFile);
        }

        public void Dispose()
        {
            _lockFile.Dispose();
        }
    }
}
