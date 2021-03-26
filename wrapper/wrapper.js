/* don't remove this line */
if (typeof createCubehashModule === 'undefined') {
  createCubehashModule = Promise.reject(new Error('cubehash wasm module was not available'));
}

var cubehash = {
  internal: {
    module: null,
    bytesFromBuffer: function(internalBuffer, bufLen) {
      const resultView = new Uint8Array(this.module.HEAP8.buffer, internalBuffer, bufLen); // view, not a copy
      const result = new Uint8Array(resultView); // copy, not a view!
      return result;
    },

    bufferFromBytes: function(bytes) {
      var internalBuffer = this.create_buffer(bytes.length);
      this.applyBytesToBuffer(bytes, internalBuffer);
      return internalBuffer;
    },
    applyBytesToBuffer: function(bytes, internalBuffer) {
      this.module.HEAP8.set(bytes, internalBuffer);
    },
    toHex: function(bytes) {
      return Array.prototype.map.call(bytes, function(n) {
        return (n < 16 ? '0' : '') + n.toString(16)
      }).join('');
    },
    inputToBytes: function (input) {
      if (input instanceof Uint8Array)
        return input;
      else if (typeof input === 'string')
        return (new TextEncoder()).encode(input);
      else
        throw new Error('Input must be an string, Buffer or Uint8Array');
    }
  },

  /**
   * Checks if Cubehash support is ready (WASM Module loaded)
   * @return {Boolean}
   */
  isReady: function() {
    return cubehash.internal.module !== null;
  },

  /**
   * Initializes a Hashing Context for Hash
   * @param {Number} i Number of initialization rounds. i > 0, 16 by default.
   * @param {Number} r Number of rounds per block. r > 0, 16 by default.
   * @param {Number} b Number of bytes per block. 128 >= b > 0, 32 by default.
   * @param {Number} f Number of finalization rounds. f > 0, 32 by default.
   * @param {Number} h Digest size in bits. 8 >= h >= 512 and h is a multiple of 8. 512 by default.
   * @return {Object} the context object for this hashing session. Should only be used to hash one data source.
   */
  init: function(i, r, b, f, h) {
    if (i === undefined || typeof i !== 'number' || i <= 0)
      i = 16;
    if (r === undefined || typeof r !== 'number' || r <= 0)
      r = 16;
    if (b === undefined || typeof b !== 'number' || b <= 0 || b > 128)
      b = 32;
    if (f === undefined || typeof f !== 'number' || f <= 0)
      f = 32;
    if (h === undefined || typeof h !== 'number' || h < 8 || h > 512 || h % 8 != 0)
      h = 512;

    return {
      'digest_size': h,
      'context': cubehash.internal.init(i, r, b, f, h)
    };
  },

  /**
   * Update the hashing context with new input data
   * @param {Object} contextObject the context object for this hashing session
   * @param {Uint8Array} bytes an array of bytes to hash
   */
  update: function(contextObject, bytes) {
    var inputBuffer = cubehash.internal.bufferFromBytes(bytes);

    cubehash.internal.update(contextObject.context, inputBuffer, bytes.length);

    cubehash.internal.destroy_buffer(inputBuffer);
  },

  /**
   * Update the hashing context with new input data
   * @param {Object} contextObject the context object for this hashing session
   * @param {Object} value the value to use as bytes to update the hash calculation. Must be String or Uint8Array.
   */
   updateFromValue: function(contextObject, value) {
     cubehash.update(contextObject, cubehash.internal.inputToBytes(value));
   },

  /**
   * Finalizes the hashing session and produces digest ("hash") bytes.
   * Size of the returned array is always digest_size/8 bytes long.
   * This method does not clean up the hashing context - be sure to call cleanup(ctx) !
   * @param {Object} contextObject the context object for this hashing session
   * @return {Uint8Array} an array of bytes representing the raw digest ("hash") value.
   */
  final: function(contextObject) {
    var digestByteLen = contextObject.digest_size / 8;
    var digestBuffer = cubehash.internal.create_buffer(digestByteLen);

    cubehash.internal.final(contextObject.context, digestBuffer);

    var digestBytes = cubehash.internal.bytesFromBuffer(digestBuffer, digestByteLen);
    cubehash.internal.destroy_buffer(digestBuffer);
    return digestBytes;
  },

  /**
   * Cleans up and releases the Context object for the (now ended) hashing session.
   * @param {Object} contextObject the context object for this hashing session
   */
  cleanup: function(contextObject) {
    cubehash.internal.cleanup(contextObject.context);
  },

  /**
   * Calculates the cubehash message digest ("hash") for the input bytes or string
   * @param {Object} input the input value to hash - either Uint8Array or String
   * @param {Number} i : see init
   * @param {Number} r : see init
   * @param {Number} b : see init
   * @param {Number} f : see init
   * @param {Number} h : see init
   * @return {Uint8Array} an array of bytes representing the raw digest ("hash") value.
   */
  digest: function(input, i, r, b, f, h) {
    input = cubehash.internal.inputToBytes(input);

    var ctx = cubehash.init(i, r, b, f, h);
    cubehash.update(ctx, input);
    var bytes = cubehash.final(ctx);
    cubehash.cleanup(ctx);

    return bytes;
  },

  /**
   * Calculates the cubehash message digest ("hash") for the input bytes or string
   * @param {Object} input the input value to hash - either Uint8Array or String
   * @param {Number} i : see init
   * @param {Number} r : see init
   * @param {Number} b : see init
   * @param {Number} f : see init
   * @param {Number} h : see init
   * @return {String} a hexadecimal representation of the digest ("hash") bytes.
   */
  digestHex: function(input, i, r, b, f, h) {
    var bytes = cubehash.digest(input, i, r, b, f, h);
    return cubehash.internal.toHex(bytes);
  }
};

createCubehashModule().then(async module => {
  // Memory allocations helpers
  cubehash.internal.create_buffer  = module.cwrap('malloc', 'number', ['number']);
  cubehash.internal.destroy_buffer = module.cwrap('free',   '',       ['number']);

  cubehash.internal.init    = module.cwrap('cubehash_init',    'number', ['number','number','number','number','number']);
  cubehash.internal.update  = module.cwrap('cubehash_update',  '',       ['number','number','number']);
  cubehash.internal.final   = module.cwrap('cubehash_final',   '',       ['number','number']);
  cubehash.internal.cleanup = module.cwrap('cubehash_cleanup', '',       ['number']);
  cubehash.internal.module  = module;
});

