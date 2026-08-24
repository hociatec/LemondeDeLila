#pragma once

#include <functional>

namespace lila::bootstrap
{
using StepLogger = std::function<void(const char* step)>;
}
