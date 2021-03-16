#!/bin/bash
set -eEuo pipefail
cd `dirname "$0"` && SCRIPT_DIR=`pwd -P`

hash scons 2>/dev/null || { echo >&2 "ERROR: scons not found. Please install scons."; exit 1; }
hash python 2>/dev/null || { echo >&2 "ERROR: python not found. Please install python."; exit 1; }
[ -z ${EMSDK+x} ] && { echo >&2 "ERROR: emscripten env not set. Please run 'source emsdk_env.sh'."; exit 1; }
if [ -z ${EMSCRIPTEN_ROOT+x} ] ; then
  DEFAULT_ROOT="$EMSDK/upstream/emscripten"
  [ -e "$DEFAULT_ROOT/emcc" ] || echo "WARNING: Failed to generate valid env EMSCRIPTEN_ROOT=$DEFAULT_ROOT. You may need to set it manually for scons."
  export EMSCRIPTEN_ROOT=$DEFAULT_ROOT
fi
echo $EMSCRIPTEN_ROOT

NUM_CPUS=`getconf _NPROCESSORS_ONLN`
emscons scons -j $NUM_CPUS $@
