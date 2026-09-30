#include "modules/update/infrastructure/launcher/UpdateStagingCleanup.h"

#include <optional>
#include <string_view>

#include "modules/update/domain/UpdateProtocol.h"

namespace lila::modules::update::launcher
{
void CleanupUpdateStagingDirectory(const std::filesystem::path& staging)
{
    namespace fs = std::filesystem;
    if (!fs::is_directory(staging)) return;
    std::optional<fs::directory_entry> newestArchive;
    for (const auto& entry : fs::directory_iterator(staging))
    {
        const std::string name = entry.path().filename().string();
        static constexpr std::string_view suffix = ".download.zip";
        const bool resumableArchive = entry.is_regular_file() && name.ends_with(suffix) &&
            lila::modules::update::IsSafeReleaseId(
                name.substr(0, name.size() - suffix.size()));
        if (!resumableArchive)
        {
            fs::remove_all(entry.path());
            continue;
        }
        if (!newestArchive || entry.last_write_time() > newestArchive->last_write_time())
        {
            if (newestArchive) fs::remove(newestArchive->path());
            newestArchive = entry;
        }
        else
        {
            fs::remove(entry.path());
        }
    }
}
}
