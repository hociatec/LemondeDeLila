#include <stdexcept>

#include "modules/update/infrastructure/launcher/UpdateLauncher.Internal.h"

namespace lila::modules::update::launcher
{
fs::path PrepareRelease(
    const fs::path& root,
    const Manifest& manifest,
    UpdateProgressDialog* progress)
{
    const fs::path finalPath = ReleasePath(root, manifest.releaseId);
    if (fs::is_regular_file(finalPath / AppExecutable) &&
        fs::is_regular_file(finalPath / LauncherExecutable)) {
        if (progress) progress->SetStage(L"Mise à jour déjà préparée…", 99);
        return finalPath;
    }
    const fs::path stagingRoot = root / L"staging";
    fs::create_directories(stagingRoot);
    const fs::path archive = stagingRoot /
        Widen(BuildStagedUpdateArchiveFileName(manifest.releaseId));
    bool archiveReady;
    try {
        archiveReady = fs::is_regular_file(archive) &&
            fs::file_size(archive) == manifest.size &&
            Sha256(archive) == manifest.sha256;
    } catch (...) {
        archiveReady = false;
    }
    if (!archiveReady) {
        fs::remove(archive);
        EnsureFreeSpace(root, manifest.size);
        DownloadFile(manifest.url, archive, manifest.size, progress);
    }
    if (progress) progress->SetStage(L"Vérification du téléchargement…", 82);
    if (fs::file_size(archive) != manifest.size || Sha256(archive) != manifest.sha256) {
        fs::remove(archive);
        throw std::runtime_error("Downloaded update failed integrity verification.");
    }
    if (progress) progress->SetStage(L"Analyse de l'archive…", 85);
    const auto extractedBytes = InspectArchive(archive, manifest.size);
    EnsureFreeSpace(root, extractedBytes);
    const fs::path extracted = stagingRoot / (Widen(manifest.releaseId) + L".extracting");
    ExtractArchive(archive, extracted, extractedBytes, progress);
    if (progress) progress->SetStage(L"Finalisation de la mise à jour…", 99);
    fs::create_directories(finalPath.parent_path());
    if (fs::exists(finalPath)) fs::remove_all(finalPath);
    RenameWithRetry(extracted, finalPath);
    fs::remove(archive);
    if (progress) progress->SetStage(L"Mise à jour installée.", 100);
    return finalPath;
}
}
