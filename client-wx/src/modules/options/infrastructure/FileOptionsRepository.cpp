#include "modules/options/infrastructure/FileOptionsRepository.h"
#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/persistence/JsonFileStorage.h"

#include <nlohmann/json.hpp>

#include <stdexcept>
#include <string>

namespace lila::modules::options::infrastructure
{

domain::OptionsState FileOptionsRepository::Load() const
{
    const auto path = lila::shared::persistence::JsonFileStorage::ResolvePath("options.json");
    nlohmann::json document;
    try
    {
        if (!lila::shared::persistence::JsonFileStorage::ReadIfExists(path, document))
        {
            return {};
        }
    }
    catch (const std::exception& error)
    {
        throw std::runtime_error(lila::shared::errors::WithDetails(lila::shared::errors::InvalidOptionsFile, error.what()));
    }

    return json::Parse(document);
}

void FileOptionsRepository::Save(const domain::OptionsState& state) const
{
    const auto path = lila::shared::persistence::JsonFileStorage::ResolvePath("options.json");
    nlohmann::json document = json::Serialize(state);

    lila::shared::persistence::JsonFileStorage::Write(
        path,
        document,
        lila::shared::errors::OptionsSaveFailed);
}
}
