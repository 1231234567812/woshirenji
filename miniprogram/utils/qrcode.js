// QR Code Generator - 纯 JavaScript 实现，适用于微信小程序
// 基于 QR Code 标准 (ISO/IEC 18004)，支持版本 1-10，纠错级别 L/M/Q/H

var QRCode = (function() {
  // 纠错级别常量
  var EC_LEVELS = { L: 1, M: 0, Q: 3, H: 2 };

  // 编码模式常量
  var MODE_NUMERIC = 1;
  var MODE_ALPHANUMERIC = 2;
  var MODE_BYTE = 4;

  // 字符计数指示器位数 [版本范围][模式]
  var CHAR_COUNT_BITS = [
    [10, 9, 8, 8],   // 版本 1-9
    [12, 11, 16, 10], // 版本 10-26
    [14, 13, 16, 12], // 版本 27-40
  ];

  // 每个版本每个纠错级别的容量表 [版本][ec_level] = { total, data, ec, blocks }
  var EC_BLOCKS = [
    null, // 版本 0 不存在
    // 版本 1
    [{ total: 26, data: 19, ec: 7, blocks: 1 }, { total: 26, data: 16, ec: 10, blocks: 1 }, { total: 26, data: 13, ec: 13, blocks: 1 }, { total: 26, data: 9, ec: 17, blocks: 1 }],
    // 版本 2
    [{ total: 44, data: 34, ec: 10, blocks: 1 }, { total: 44, data: 28, ec: 16, blocks: 1 }, { total: 44, data: 22, ec: 22, blocks: 1 }, { total: 44, data: 16, ec: 28, blocks: 1 }],
    // 版本 3
    [{ total: 70, data: 55, ec: 15, blocks: 1 }, { total: 70, data: 44, ec: 26, blocks: 1 }, { total: 70, data: 34, ec: 18, blocks: 2 }, { total: 70, data: 26, ec: 22, blocks: 2 }],
    // 版本 4
    [{ total: 100, data: 80, ec: 20, blocks: 1 }, { total: 100, data: 64, ec: 18, blocks: 2 }, { total: 100, data: 48, ec: 26, blocks: 2 }, { total: 100, data: 36, ec: 16, blocks: 4 }],
    // 版本 5
    [{ total: 134, data: 108, ec: 26, blocks: 1 }, { total: 134, data: 86, ec: 24, blocks: 2 }, { total: 134, data: 62, ec: 18, blocks: 2 }, { total: 134, data: 46, ec: 22, blocks: 2 }],
    // 版本 6
    [{ total: 172, data: 136, ec: 18, blocks: 2 }, { total: 172, data: 108, ec: 16, blocks: 4 }, { total: 172, data: 76, ec: 24, blocks: 4 }, { total: 172, data: 60, ec: 28, blocks: 4 }],
    // 版本 7
    [{ total: 196, data: 156, ec: 20, blocks: 2 }, { total: 196, data: 124, ec: 18, blocks: 4 }, { total: 196, data: 88, ec: 18, blocks: 2 }, { total: 196, data: 66, ec: 26, blocks: 4 }],
    // 版本 8
    [{ total: 242, data: 194, ec: 24, blocks: 2 }, { total: 242, data: 154, ec: 22, blocks: 2 }, { total: 242, data: 110, ec: 22, blocks: 4 }, { total: 242, data: 86, ec: 26, blocks: 4 }],
    // 版本 9
    [{ total: 292, data: 232, ec: 30, blocks: 2 }, { total: 292, data: 182, ec: 22, blocks: 3 }, { total: 292, data: 132, ec: 20, blocks: 4 }, { total: 292, data: 100, ec: 24, blocks: 4 }],
    // 版本 10
    [{ total: 346, data: 274, ec: 18, blocks: 2 }, { total: 346, data: 216, ec: 26, blocks: 4 }, { total: 346, data: 154, ec: 24, blocks: 6 }, { total: 346, data: 122, ec: 28, blocks: 6 }],
  ];

  // GF(256) 运算表
  var GF_EXP = new Array(256);
  var GF_LOG = new Array(256);
  (function() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x = x << 1;
      if (x >= 256) x ^= 0x11d;
    }
    GF_EXP[255] = GF_EXP[0];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
  }

  function gfPolyMul(p, q) {
    var r = new Array(p.length + q.length - 1).fill(0);
    for (var i = 0; i < p.length; i++) {
      for (var j = 0; j < q.length; j++) {
        r[i + j] ^= gfMul(p[i], q[j]);
      }
    }
    return r;
  }

  function rsGenPoly(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      g = gfPolyMul(g, [1, GF_EXP[i]]);
    }
    return g;
  }

  function rsEncode(data, ecLen) {
    var gen = rsGenPoly(ecLen);
    var msg = new Array(data.length + ecLen).fill(0);
    for (var i = 0; i < data.length; i++) msg[i] = data[i];
    for (var i = 0; i < data.length; i++) {
      var coef = msg[i];
      if (coef !== 0) {
        for (var j = 0; j < gen.length; j++) {
          msg[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  }

  // 判断字符类型
  function isNumeric(s) { return /^[0-9]+$/.test(s); }
  function isAlphanumeric(s) { return /^[0-9A-Z $%*+\-./:]+$/.test(s); }

  var ALPHANUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  function alphanumericValue(c) { return ALPHANUM_CHARS.indexOf(c); }

  // 选择最佳编码模式
  function selectMode(data) {
    if (isNumeric(data)) return MODE_NUMERIC;
    if (isAlphanumeric(data)) return MODE_ALPHANUMERIC;
    return MODE_BYTE;
  }

  // 字符计数指示器位数
  function charCountBits(mode, version) {
    var idx = version <= 9 ? 0 : version <= 26 ? 1 : 2;
    var modeIdx = mode === MODE_NUMERIC ? 0 : mode === MODE_ALPHANUMERIC ? 1 : 2;
    return CHAR_COUNT_BITS[idx][modeIdx];
  }

  // 编码数据为比特流
  function encodeData(data, mode) {
    var bits = [];
    function addBits(val, len) {
      for (var i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    }

    if (mode === MODE_NUMERIC) {
      for (var i = 0; i < data.length; i += 3) {
        var chunk = data.slice(i, Math.min(i + 3, data.length));
        var n = parseInt(chunk, 10);
        var bitsPerDigit = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
        addBits(n, bitsPerDigit);
      }
    } else if (mode === MODE_ALPHANUMERIC) {
      for (var i = 0; i < data.length; i += 2) {
        if (i + 1 < data.length) {
          addBits(alphanumericValue(data[i]) * 45 + alphanumericValue(data[i + 1]), 11);
        } else {
          addBits(alphanumericValue(data[i]), 6);
        }
      }
    } else {
      // Byte mode - 支持 UTF-8
      var bytes;
      if (typeof TextEncoder !== 'undefined') {
        bytes = new TextEncoder().encode(data);
      } else {
        // 手动 UTF-8 编码
        bytes = [];
        for (var i = 0; i < data.length; i++) {
          var c = data.charCodeAt(i);
          if (c < 0x80) {
            bytes.push(c);
          } else if (c < 0x800) {
            bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
          } else if (c < 0xd800 || c >= 0xe000) {
            bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
          } else {
            // 代理对
            i++;
            c = 0x10000 + (((c & 0x3ff) << 10) | (data.charCodeAt(i) & 0x3ff));
            bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
          }
        }
        bytes = new Uint8Array(bytes);
      }
      for (var i = 0; i < bytes.length; i++) {
        addBits(bytes[i], 8);
      }
    }
    return bits;
  }

  // 选择最小版本
  function selectVersion(dataLen, mode, ecLevel) {
    var ecIdx = EC_LEVELS[ecLevel];
    for (var v = 1; v <= 10; v++) {
      var info = EC_BLOCKS[v][ecIdx];
      var capacity = info.data;
      // 计算模式指示器 + 字符计数 + 数据所需的字节数
      var modeBits = 4;
      var ccBits = charCountBits(mode, v);
      var dataBits;
      if (mode === MODE_NUMERIC) {
        var groups = Math.ceil(dataLen / 3);
        dataBits = groups * 10 - (dataLen % 3 === 1 ? 3 : dataLen % 3 === 2 ? 0 : 0);
      } else if (mode === MODE_ALPHANUMERIC) {
        dataBits = Math.floor(dataLen / 2) * 11 + (dataLen % 2) * 6;
      } else {
        // 对于字节模式，需要计算 UTF-8 编码后的字节数
        var utf8Len;
        if (typeof TextEncoder !== 'undefined') {
          utf8Len = new TextEncoder().encode(arguments[3] || '').length;
        } else {
          utf8Len = dataLen; // 简化估算
        }
        dataBits = utf8Len * 8;
      }
      var totalBits = modeBits + ccBits + dataBits;
      var totalBytes = Math.ceil(totalBits / 8) + 2; // +2 for terminator padding
      if (totalBytes <= capacity) return v;
    }
    return -1; // 数据太长
  }

  // 创建矩阵
  function createMatrix(size) {
    var matrix = [];
    for (var i = 0; i < size; i++) {
      matrix[i] = new Array(size).fill(null);
    }
    return matrix;
  }

  // 放置定位图案
  function placeFinderPattern(matrix, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || rr >= matrix.length || cc < 0 || cc >= matrix.length) continue;
        if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[rr][cc] = 1;
        } else {
          matrix[rr][cc] = 0;
        }
      }
    }
  }

  // 放置对齐图案
  function placeAlignmentPattern(matrix, row, col) {
    for (var r = -2; r <= 2; r++) {
      for (var c = -2; c <= 2; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || rr >= matrix.length || cc < 0 || cc >= matrix.length) continue;
        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
          matrix[rr][cc] = 1;
        } else {
          matrix[rr][cc] = 0;
        }
      }
    }
  }

  // 对齐图案位置
  var ALIGNMENT_POSITIONS = [
    null, [], [6, 18], [6, 22], [6, 26], [6, 30],
    [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
  ];

  // 放置时序图案
  function placeTimingPatterns(matrix) {
    var size = matrix.length;
    for (var i = 8; i < size - 8; i++) {
      if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0 ? 1 : 0;
      if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0 ? 1 : 0;
    }
  }

  // 放置格式信息
  function placeFormatInfo(matrix, ecLevel, mask) {
    var ecIdx = EC_LEVELS[ecLevel];
    var formatInfo = (ecIdx << 3) | mask;
    var bits = formatInfo;
    // BCH(15,5) 编码
    var g = 0x537; // 生成多项式
    var data = bits << 10;
    for (var i = 4; i >= 0; i--) {
      if (data & (1 << (i + 10))) {
        data ^= g << i;
      }
    }
    bits = (bits << 10) | data;
    // XOR 掩码
    bits ^= 0x5412;

    // 放置格式信息
    var positions1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    var positions2 = [
      [matrix.length - 1, 8], [matrix.length - 2, 8], [matrix.length - 3, 8],
      [matrix.length - 4, 8], [matrix.length - 5, 8], [matrix.length - 6, 8],
      [matrix.length - 7, 8], [8, matrix.length - 8], [8, matrix.length - 7],
      [8, matrix.length - 6], [8, matrix.length - 5], [8, matrix.length - 4],
      [8, matrix.length - 3], [8, matrix.length - 2], [8, matrix.length - 1]
    ];

    for (var i = 0; i < 15; i++) {
      var bit = (bits >> i) & 1;
      matrix[positions1[i][0]][positions1[i][1]] = bit;
      matrix[positions2[i][0]][positions2[i][1]] = bit;
    }
  }

  // 放置数据位
  function placeData(matrix, data) {
    var size = matrix.length;
    var bitIdx = 0;
    var upward = true;

    for (var col = size - 1; col >= 0; col -= 2) {
      if (col === 6) col = 5; // 跳过时序列
      var rows = [];
      for (var r = 0; r < size; r++) {
        rows.push(upward ? size - 1 - r : r);
      }
      for (var ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];
        for (var dc = 0; dc <= 1; dc++) {
          var c = col - dc;
          if (c < 0 || c >= size) continue;
          if (matrix[row][c] !== null) continue;
          matrix[row][c] = bitIdx < data.length ? data[bitIdx] : 0;
          bitIdx++;
        }
      }
      upward = !upward;
    }
  }

  // 掩码模式
  var MASK_FUNCTIONS = [
    function(r, c) { return (r + c) % 2 === 0; },
    function(r, c) { return r % 2 === 0; },
    function(r, c) { return c % 3 === 0; },
    function(r, c) { return (r + c) % 3 === 0; },
    function(r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function(r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
    function(r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; },
    function(r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; },
  ];

  // 应用掩码
  function applyMask(matrix, mask) {
    var size = matrix.length;
    var masked = createMatrix(size);
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (matrix[r][c] === null) {
          masked[r][c] = 0;
        } else {
          masked[r][c] = matrix[r][c] ^ (MASK_FUNCTIONS[mask](r, c) ? 1 : 0);
        }
      }
    }
    return masked;
  }

  // 计算惩罚分数
  function calcPenalty(matrix) {
    var size = matrix.length;
    var penalty = 0;

    // 规则 1：连续相同颜色
    for (var r = 0; r < size; r++) {
      var count = 1;
      for (var c = 1; c < size; c++) {
        if (matrix[r][c] === matrix[r][c - 1]) {
          count++;
          if (count === 5) penalty += 3;
          else if (count > 5) penalty += 1;
        } else {
          count = 1;
        }
      }
    }
    for (var c = 0; c < size; c++) {
      var count = 1;
      for (var r = 1; r < size; r++) {
        if (matrix[r][c] === matrix[r - 1][c]) {
          count++;
          if (count === 5) penalty += 3;
          else if (count > 5) penalty += 1;
        } else {
          count = 1;
        }
      }
    }

    return penalty;
  }

  // 主生成函数
  function generate(text, ecLevel) {
    ecLevel = ecLevel || 'M';
    if (!text || text.length === 0) return null;

    var mode = selectMode(text);
    var version = selectVersion(text.length, mode, ecLevel, text);
    if (version < 0) return null;

    var ecIdx = EC_LEVELS[ecLevel];
    var ecInfo = EC_BLOCKS[version][ecIdx];
    var size = version * 4 + 17;

    // 编码数据
    var dataBits = [];
    // 模式指示器 (4位)
    addBitsToArray(dataBits, mode, 4);
    // 字符计数
    var ccBits = charCountBits(mode, version);
    var dataLen = mode === MODE_BYTE ? new TextEncoder().encode(text).length : text.length;
    addBitsToArray(dataBits, dataLen, ccBits);
    // 数据
    var encoded = encodeData(text, mode);
    dataBits = dataBits.concat(encoded);
    // 终止符
    addBitsToArray(dataBits, 0, Math.min(4, ecInfo.data * 8 - dataBits.length));
    // 填充到字节边界
    while (dataBits.length % 8 !== 0) dataBits.push(0);
    // 填充字节
    var padBytes = [0xEC, 0x11];
    var padIdx = 0;
    while (dataBits.length < ecInfo.data * 8) {
      addBitsToArray(dataBits, padBytes[padIdx % 2], 8);
      padIdx++;
    }
    dataBits = dataBits.slice(0, ecInfo.data * 8);

    // 转换为字节数组
    var dataBytes = [];
    for (var i = 0; i < dataBits.length; i += 8) {
      var byte = 0;
      for (var j = 0; j < 8; j++) byte = (byte << 1) | (dataBits[i + j] || 0);
      dataBytes.push(byte);
    }

    // 计算纠错码
    var ecBytes = rsEncode(dataBytes, ecInfo.ec);

    // 创建矩阵
    var matrix = createMatrix(size);

    // 放置定位图案
    placeFinderPattern(matrix, 0, 0);
    placeFinderPattern(matrix, 0, size - 7);
    placeFinderPattern(matrix, size - 7, 0);

    // 放置对齐图案
    if (version >= 2) {
      var positions = ALIGNMENT_POSITIONS[version];
      for (var i = 0; i < positions.length; i++) {
        for (var j = 0; j < positions.length; j++) {
          var r = positions[i], c = positions[j];
          // 不与定位图案重叠
          if (r <= 8 && c <= 8) continue;
          if (r <= 8 && c >= size - 8) continue;
          if (r >= size - 8 && c <= 8) continue;
          placeAlignmentPattern(matrix, r, c);
        }
      }
    }

    // 放置时序图案
    placeTimingPatterns(matrix);

    // 保留格式信息区域
    for (var i = 0; i < 8; i++) {
      matrix[8][i] = 0;
      matrix[i][8] = 0;
      matrix[8][size - 1 - i] = 0;
      matrix[size - 1 - i][8] = 0;
    }
    matrix[8][8] = 0;
    matrix[size - 8][8] = 1; // 暗模块

    // 合并数据和纠错码
    var allData = dataBytes.concat(ecBytes);
    var allBits = [];
    for (var i = 0; i < allData.length; i++) {
      addBitsToArray(allBits, allData[i], 8);
    }

    // 放置数据
    placeData(matrix, allBits);

    // 选择最佳掩码
    var bestMask = 0;
    var bestPenalty = Infinity;
    for (var m = 0; m < 8; m++) {
      var masked = applyMask(matrix, m);
      // 临时放置格式信息
      placeFormatInfo(masked, ecLevel, m);
      var penalty = calcPenalty(masked);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestMask = m;
      }
    }

    // 应用最终掩码
    var result = applyMask(matrix, bestMask);
    placeFormatInfo(result, ecLevel, bestMask);

    return { modules: result, size: size, version: version };
  }

  function addBitsToArray(arr, val, len) {
    for (var i = len - 1; i >= 0; i--) {
      arr.push((val >> i) & 1);
    }
  }

  return { generate: generate, EC_LEVELS: EC_LEVELS };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QRCode;
}
