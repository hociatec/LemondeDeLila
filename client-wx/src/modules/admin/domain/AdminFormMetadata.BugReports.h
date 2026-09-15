#pragma once

#include <string_view>

namespace lila::modules::admin::domain
{
struct AdminFieldMetadata;

void ApplyBugReportFieldMetadata(
    std::string_view commandId,
    std::string_view fieldName,
    AdminFieldMetadata& metadata);
}
