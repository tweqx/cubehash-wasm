#!/bin/bash

# emscripten binaries need to be in your $PATH, run "source ./emsdk_env.sh" in the emscripten installation directory to do that

emcc cubehash.c -O3 -o dist/cubehash.js -s MODULARIZE=1 -s 'EXPORT_NAME="createCubehashModule"' -s EXTRA_EXPORTED_RUNTIME_METHODS='["cwrap"]' -s EXPORTED_FUNCTIONS="['_malloc', '_free']" -s WASM=1

if [ $? == 0 ]; then
  cat dist/cubehash.js wrapper/wrapper.js > dist/cubehash-wasm.js ;
  rm dist/cubehash.js
fi

