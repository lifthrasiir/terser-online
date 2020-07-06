"use strict";

this.window = this;
importScripts('libzopfli.js');

// assumes that window.Module is a wasm output for zopfli
// adapted from https://github.com/gfx/universal-zopfli-js/
const z = window.Module;

function ensureByteBuffer(input) {
  if (typeof input === 'string') {
    const a = z.intArrayFromString(input);
    a.length--; // because emscripten's intArrayFromString() adds trailing nul
    return a;
  } else if (Array.isArray(input)) {
    return Uint8Array.from(input);
  } else {
    return input;
  }
}

const defaultOptions = {
  verbose: false,
  verbose_more: false,
  numiterations: 15,
  blocksplitting: true,
  blocksplittingmax: 15,
};

function compress(input, format, options) {
  console.assert(input != null, "buffer must not be null");
  console.assert(options != null, "options must not be null");

  const byteBuffer = ensureByteBuffer(input);
  const bufferPtr = z.allocate(byteBuffer, 'i8', z.ALLOC_NORMAL);

  const opts = { ...defaultOptions, ...options };

  const output = z._createZopfliJsOutput();
  z._compress(bufferPtr, byteBuffer.length, output,
    format,
    opts.verbose,
    opts.verbose_more,
    opts.numiterations,
    opts.blocksplitting,
    opts.blocksplittingmax,
  );

  const outputPtr = z._getBuffer(output);
  const outputSize = z._getBufferSize(output);

  const result = z.HEAPU8.slice(outputPtr, outputPtr + outputSize);
  z._deallocate(outputPtr);
  z._deallocate(output);
  z._deallocate(bufferPtr);

  return result;
}

var preinitqueue = null;
onmessage = e => {
  if (preinitqueue) {
    preinitqueue.push(e.data);
  } else {
    processmsg(e.data);
  }
};

const funcs = { compress };
function processmsg([tag, funcname, ...args]) {
  try {
    const func = funcs[funcname];
    if (func) {
      postMessage([tag, 0, func(...args)]);
    } else {
      throw 'unknown func ' + funcname;
    }
  } catch (e) {
    postMessage([tag, 1, e.toString()]);
  }
};

// libzopfli may be initialized asynchronously, need to delay message processing
if (!runtimeInitialized) {
  preinitqueue = [];
  addOnInit(() => {
    const queue = preinitqueue;
    preinitqueue = null;
    for (const data of queue) processmsg(data);
  });
}

