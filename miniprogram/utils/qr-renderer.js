var QRCode = require('./qrcode');

// 在 Canvas 2D 上绘制二维码
function drawQRCode(canvas, text, options) {
  options = options || {};
  var ecLevel = options.ecLevel || 'M';
  var fgColor = options.fgColor || '#000000';
  var bgColor = options.bgColor || '#ffffff';
  var margin = options.margin || 4; // 模块数
  var size = options.size || 300; // canvas 像素

  var qr = QRCode.generate(text, ecLevel);
  if (!qr) return false;

  var moduleCount = qr.size;
  var totalModules = moduleCount + margin * 2;
  var cellSize = size / totalModules;

  var ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // 清空背景
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // 绘制模块
  ctx.fillStyle = fgColor;
  for (var r = 0; r < moduleCount; r++) {
    for (var c = 0; c < moduleCount; c++) {
      if (qr.modules[r][c]) {
        var x = (c + margin) * cellSize;
        var y = (r + margin) * cellSize;
        ctx.fillRect(x, y, cellSize + 0.5, cellSize + 0.5); // +0.5 避免缝隙
      }
    }
  }

  return true;
}

// 生成二维码图片文件
function generateQRImage(text, options, callback) {
  options = options || {};
  var size = options.size || 600;

  var query = wx.createSelectorQuery();
  query.select('#qrCanvas')
    .fields({ node: true, size: true })
    .exec(function(res) {
      if (!res || !res[0] || !res[0].node) {
        // 回退：使用离屏 canvas
        var canvas = wx.createOffscreenCanvas({ type: '2d', width: size, height: size });
        var success = drawQRCode(canvas, text, Object.assign({}, options, { size: size }));
        if (success) {
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: function(r) { callback(null, r.tempFilePath); },
            fail: function(e) { callback(e); }
          });
        } else {
          callback(new Error('生成失败'));
        }
        return;
      }

      var canvas = res[0].node;
      canvas.width = size;
      canvas.height = size;
      var success = drawQRCode(canvas, text, Object.assign({}, options, { size: size }));
      if (success) {
        setTimeout(function() {
          wx.canvasToTempFilePath({
            canvas: canvas,
            success: function(r) { callback(null, r.tempFilePath); },
            fail: function(e) { callback(e); }
          });
        }, 100);
      } else {
        callback(new Error('生成失败'));
      }
    });
}

module.exports = { drawQRCode: drawQRCode, generateQRImage: generateQRImage };
