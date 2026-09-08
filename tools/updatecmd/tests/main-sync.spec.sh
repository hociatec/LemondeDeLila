#!/usr/bin/env bash
set -euo pipefail

TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT
BUILD_USER="$(id -un)"
export BUILD_USER

# shellcheck source=../lib/common.sh
# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/lib/common.sh"

git_init() {
  local remote="$TEST_ROOT/origin.git"
  local seed="$TEST_ROOT/seed"
  local deploy="$TEST_ROOT/deploy"
  git init --quiet --bare "$remote"
  git init --quiet --initial-branch=main "$seed"
  git -C "$seed" config user.name updatecmd-test
  git -C "$seed" config user.email updatecmd@example.invalid
  printf 'initial\n' >"$seed/version.txt"
  git -C "$seed" add version.txt
  git -C "$seed" commit --quiet -m initial
  git -C "$seed" remote add origin "$remote"
  git -C "$seed" push --quiet -u origin main
  git --git-dir="$remote" symbolic-ref HEAD refs/heads/main
  git clone --quiet "$remote" "$deploy"
  git -C "$deploy" config user.name updatecmd-test
  git -C "$deploy" config user.email updatecmd@example.invalid
}

git_init
assert_immutable_git_source "$TEST_ROOT/deploy"

printf 'remote\n' >>"$TEST_ROOT/seed/version.txt"
git -C "$TEST_ROOT/seed" commit --quiet -am remote
git -C "$TEST_ROOT/seed" push --quiet
assert_immutable_git_source "$TEST_ROOT/deploy"
[[ "$(git -C "$TEST_ROOT/deploy" rev-parse HEAD)" == \
   "$(git -C "$TEST_ROOT/seed" rev-parse HEAD)" ]]

printf 'local\n' >>"$TEST_ROOT/deploy/version.txt"
git -C "$TEST_ROOT/deploy" commit --quiet -am local
if (assert_immutable_git_source "$TEST_ROOT/deploy" >/dev/null 2>&1); then
  die "Une avance locale absente d'origin/main a été acceptée."
fi
git -C "$TEST_ROOT/deploy" reset --quiet --hard origin/main

git -C "$TEST_ROOT/deploy" switch --quiet -c feature
if (assert_immutable_git_source "$TEST_ROOT/deploy" >/dev/null 2>&1); then
  die "Une branche autre que main a été acceptée."
fi
git -C "$TEST_ROOT/deploy" switch --quiet main

printf 'dirty\n' >>"$TEST_ROOT/deploy/version.txt"
if (assert_immutable_git_source "$TEST_ROOT/deploy" >/dev/null 2>&1); then
  die "Une source sale a été acceptée."
fi
git -C "$TEST_ROOT/deploy" restore version.txt

git -C "$TEST_ROOT/seed" pull --quiet --rebase
printf 'remote-divergence\n' >>"$TEST_ROOT/seed/version.txt"
git -C "$TEST_ROOT/seed" commit --quiet -am remote-divergence
git -C "$TEST_ROOT/seed" push --quiet
printf 'local-divergence\n' >>"$TEST_ROOT/deploy/version.txt"
git -C "$TEST_ROOT/deploy" commit --quiet -am local-divergence
if (assert_immutable_git_source "$TEST_ROOT/deploy" >/dev/null 2>&1); then
  die "Une divergence entre main et origin/main a été acceptée."
fi

printf 'updatecmd main synchronization tests passed.\n'
