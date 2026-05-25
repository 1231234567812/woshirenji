const app = getApp();
var qrRenderer = require('../../utils/qr-renderer');

Page({
  data: {
    view: 'list',
    projects: [],
    loading: false,
    darkMode: false,
    mode: '', menuShow: false,
    imagePath: '', codeShow: '', size: '',
    converting: false,
    convertProgress: 0,
    convertStage: '',
    compressQuality: 60,
    compressedSize: '',
    textContent: '', textResult: '',
    decodeInput: '', decodeResult: '', decodeImagePath: '',
    curId: '', curName: '',
    images: [],
    filesShow: false,
    filesList: [],
    fileMode: '',
    batchItems: [], batchConverting: false, batchProgress: '', batchTotal: 0,
    qrInput: '', qrImagePath: '', qrGenerating: false, qrEcLevel: 'M',
    // 图片压缩功能
    compressImagePath: '',
    compressOrigSize: '',
    compressNewSize: '',
    compressRatio: '',
    compressResultPath: '',
    compressing: false,
    compressQualityLevel: 60,
    // 图片加水印功能
    wmImagePath: '',
    wmText: '',
    wmPosition: 'bottom-right',
    wmColor: '#ffffff',
    wmOpacity: 60,
    wmFontSize: 32,
    wmResultPath: '',
    wmProcessing: false,
    // 图片格式转换
    fmtImg: '',
    fmtFrom: '',
    fmtTo: 'png',
    fmtResult: '',
    fmtSize: '',
    fmtConverting: false,
    // 图片尺寸调整
    resizeImg: '',
    resizeW: 0,
    resizeH: 0,
    resizeNewW: 0,
    resizeNewH: 0,
    resizeRatio: true,
    resizeResult: '',
    resizeSize: '',
    resizing: false,
    // 图片裁剪
    cropImg: '',
    cropW: 0,
    cropH: 0,
    cropRatio: 'free',
    cropResult: '',
    cropSize: '',
    cropping: false,
    // 图片旋转
    rotImg: '',
    rotDeg: 0,
    rotFlipH: false,
    rotFlipV: false,
    rotResult: '',
    rotSize: '',
    rotating: false,
  },

  _fullCode: '',
  _fullText: '',
  _imageCache: [],
  _batchCodes: [],
  _projectsCache: null,
  _lastLoadTime: 0,
  _dataDirty: false,

  // 统一获取项目数据，优先用缓存
  _getPs() {
    if (this._projectsCache) return this._projectsCache;
    let ps = wx.getStorageSync('projects') || [];
    this._projectsCache = ps;
    return ps;
  },

  // Canvas 图片处理公共方法：加载图片→绘制→导出→保存
  // opts: { canvasId, imgSrc, drawW, drawH, fileType, quality, destPrefix }
  // callback: (err, { path, size }) => void
  _canvasExport(opts, callback) {
    let that = this;
    const query = wx.createSelectorQuery();
    query.select('#' + opts.canvasId).fields({ node: true, size: true }).exec(function(res) {
      if (!res[0] || !res[0].node) { callback('Canvas 初始化失败'); return; }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      canvas.width = opts.drawW;
      canvas.height = opts.drawH;

      const img = canvas.createImage();
      img.onload = function() {
        ctx.drawImage(img, 0, 0, opts.drawW, opts.drawH);
        let fileType = opts.fileType || 'jpg';
        let quality = opts.quality;
        wx.canvasToTempFilePath({
          canvas: canvas,
          fileType: fileType,
          quality: quality,
          success: function(r) {
            let fs = wx.getFileSystemManager();
            let dest = wx.env.USER_DATA_PATH + '/' + (opts.destPrefix || 'img') + '_' + Date.now() + '.' + fileType;
            fs.copyFile({
              srcPath: r.tempFilePath, destPath: dest,
              success: function() {
                wx.getFileInfo({
                  filePath: dest,
                  success: function(fi) { callback(null, { path: dest, size: (fi.size / 1024).toFixed(1) + ' KB' }); },
                  fail: function() { callback(null, { path: dest, size: '' }); },
                });
              },
              fail: function() { callback(null, { path: r.tempFilePath, size: '' }); },
            });
          },
          fail: function() { callback('导出失败'); },
        });
      };
      img.onerror = function() { callback('图片加载失败'); };
      img.src = opts.imgSrc;
    });
  },

  // ========== 批量转换 ==========
  chooseBatchImage() {
    let that = this;
    let onSuccess = (res) => {
      let paths = [];
      if (res.tempFiles) {
        paths = res.tempFiles.map(f => f.tempFilePath || f.path).filter(Boolean);
      }
      if (paths.length === 0 && res.tempFilePaths) {
        paths = res.tempFilePaths.filter(Boolean);
      }
      if (paths.length === 0) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveTempImages(paths);
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 9, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 9, sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    }
  },

  _saveTempImages(tempPaths) {
    let that = this;
    let fs = wx.getFileSystemManager();
    let saved = [];
    let pending = tempPaths.length;
    tempPaths.forEach((p, idx) => {
      let dest = wx.env.USER_DATA_PATH + '/batch_' + Date.now() + '_' + idx + '.jpg';
      fs.copyFile({
        srcPath: p, destPath: dest,
        success() { saved[idx] = dest; if (--pending === 0) that._startBatchConvert(saved); },
        fail() {
          fs.saveFile({
            tempFilePath: p,
            success(r) { saved[idx] = r.savedFilePath; if (--pending === 0) that._startBatchConvert(saved); },
            fail() { saved[idx] = null; if (--pending === 0) that._startBatchConvert(saved.filter(Boolean)); },
          });
        },
      });
    });
  },

  _startBatchConvert(paths) {
    let valid = paths.filter(Boolean);
    if (valid.length === 0) { wx.showToast({ title: '图片保存失败', icon: 'none' }); return; }
    this._batchCodes = [];
    this.setData({ batchItems: [], batchConverting: true, batchProgress: '0/' + valid.length, batchTotal: valid.length });
    this._batchDone = 0;
    this._batchNextSlot = 0;
    this._batchImgStart = this.data.images.length;
    // 并行处理，每次最多3个
    this._batchConvertParallel(valid, 0);
  },

  _batchConvertParallel(paths, startIdx) {
    let that = this;
    let concurrency = 3;
    let endIdx = Math.min(startIdx + concurrency, paths.length);

    for (let i = startIdx; i < endIdx; i++) {
      this._batchConvertOne(paths, i, function() {
        that._batchDone++;
        that.setData({ batchProgress: that._batchDone + '/' + paths.length });
        if (that._batchDone >= paths.length) {
          that.setData({ batchConverting: false, batchProgress: '全部完成' });
          that.saveImages(that.data.images.slice(0, 30));
          wx.showToast({ title: '转换完成', icon: 'success' });
        }
      });
    }
    if (endIdx < paths.length) {
      setTimeout(function() { that._batchConvertParallel(paths, endIdx); }, 100);
    }
  },

  _batchConvertOne(paths, idx, onDone) {
    let that = this;
    wx.getFileSystemManager().readFile({
      filePath: paths[idx],
      encoding: 'base64',
      success(res) {
        let b64 = 'data:image/jpeg;base64,' + res.data;
        let kb = (res.data.length * 0.75 / 1024).toFixed(1);
        that._batchCodes.push(b64);

        let slot = that._batchNextSlot++;
        let imgIdx = that._batchImgStart + idx;
        let item = { id: Date.now() + idx, path: paths[idx], size: kb + ' KB', code: b64.slice(0, 80) + '...', fullCode: b64 };
        let itemMeta = { id: item.id, type: 'image', path: paths[idx], size: kb + ' KB', preview: '' };

        that.setData({
          ['batchItems[' + slot + ']']: item,
          ['images[' + imgIdx + ']']: itemMeta
        });
        that._imageCache = [{ base64: b64 }].concat(that._imageCache).slice(0, 20);
        onDone();
      },
      fail() {
        let slot = that._batchNextSlot++;
        that.setData({
          ['batchItems[' + slot + ']']: { id: Date.now() + idx, path: paths[idx], size: '失败', code: '读取失败', fullCode: '' }
        });
        onDone();
      },
    });
  },

  copyBatchItem(e) {
    let idx = e.currentTarget.dataset.index;
    let item = this.data.batchItems[idx];
    if (!item || !item.fullCode) return;
    wx.setClipboardData({ data: item.fullCode.slice(0, 80000), success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
  },

  copyAllBatch() {
    if (this._batchCodes.length === 0) return;
    let all = this._batchCodes.join('\n');
    wx.setClipboardData({ data: all.slice(0, 80000), success: () => wx.showToast({ title: '已复制全部', icon: 'success' }), fail: () => wx.showToast({ title: '太长了，分批复制', icon: 'none' }) });
  },

  saveAllBatch() {
    if (this._batchCodes.length === 0) return;
    let that = this;
    wx.showModal({
      title: '批量保存', editable: true, placeholderText: '输入文件名前缀',
      success(res) {
        if (!res.confirm) return;
        let prefix = (res.content || 'batch').replace(/[:"<>|?*\n\r\\/]/g, '-').slice(0, 30);
        let fs = wx.getFileSystemManager();
        let ok = 0, fail = 0;
        that._batchCodes.forEach((code, i) => {
          let fname = wx.env.USER_DATA_PATH + '/' + prefix + '_' + (i + 1) + '.txt';
          fs.writeFile({
            filePath: fname, data: code, encoding: 'utf8',
            success() { ok++; },
            fail() { fail++; },
          });
        });
        wx.showToast({ title: '已保存 ' + that._batchCodes.length + ' 个文件', icon: 'success' });
      },
    });
  },

  clearBatch() {
    this._batchCodes = [];
    this.setData({ batchItems: [], batchConverting: false, batchProgress: '', batchTotal: 0 });
  },

  // ========== 二维码生成 ==========
  onQrInput(e) { this.setData({ qrInput: e.detail.value }); },
  setQrEc(e) { this.setData({ qrEcLevel: e.currentTarget.dataset.ec }); },

  generateQR() {
    var text = this.data.qrInput;
    if (!text || !text.trim()) { wx.showToast({ title: '请输入内容', icon: 'none' }); return; }
    this.setData({ qrGenerating: true });
    var that = this;
    qrRenderer.generateQRImage(text.trim(), {
      ecLevel: this.data.qrEcLevel, size: 600
    }, function(err, path) {
      that.setData({ qrGenerating: false });
      if (err) {
        wx.showToast({ title: '生成失败，内容可能过长', icon: 'none' });
        return;
      }
      that.setData({ qrImagePath: path });
      // 保存到历史
      var fs = wx.getFileSystemManager();
      var dest = wx.env.USER_DATA_PATH + '/qr_' + Date.now() + '.png';
      fs.copyFile({
        srcPath: path, destPath: dest,
        success: function() {
          var itemMeta = { id: Date.now(), type: 'image', path: dest, size: '二维码', preview: text.slice(0, 30) };
          that._imageCache = [{ base64: '', textContent: 'QR:' + text }].concat(that._imageCache).slice(0, 10);
          var list = [itemMeta].concat(that.data.images).slice(0, 20);
          that.setData({ images: list });
          that.saveImages(list);
        },
        fail: function() {}
      });
      wx.showToast({ title: '已生成', icon: 'success' });
    });
  },

  saveQrImage() {
    var path = this.data.qrImagePath;
    if (!path) return;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success: function() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail: function(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要授权', content: '请在设置中允许保存到相册',
            success: function(r) { if (r.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  shareQrImage() {
    var path = this.data.qrImagePath;
    if (!path) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success: function(r) {
        if (r.tapIndex === 0) {
          wx.shareFileMessage({ filePath: path, fileName: 'qrcode.png' });
        } else if (r.tapIndex === 1) {
          wx.openDocument({ filePath: path, showMenu: true });
        }
      }
    });
  },

  previewQrImage() {
    if (this.data.qrImagePath) wx.previewImage({ urls: [this.data.qrImagePath] });
  },

  // ========== 一键复制（历史记录中的单条） ==========
  copyHistoryCode(e) {
    let idx = e.currentTarget.dataset.index;
    let item = this.data.images[idx];
    if (!item) return;
    // 使用缓存，避免频繁读取存储
    let ps = this._getPs();
    let p = ps.find(x => x.id === this.data.curId);
    let full = p && p.items ? p.items.find(x => x.id === item.id) : null;
    let code = full ? (full.base64 || '') : '';
    if (!code) { wx.showToast({ title: '无数据', icon: 'none' }); return; }
    wx.setClipboardData({ data: code.slice(0, 80000), success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
  },

  onLoad() {
    this.setData({ darkMode: app.globalData.darkMode });
    if (app.globalData.darkMode) this.applyDark(true);
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0, dark: app.globalData.darkMode });

    // 防抖：500ms内不重复加载
    let now = Date.now();
    if (now - this._lastLoadTime > 500) {
      this.load();
      this._lastLoadTime = now;
    }

    let dm = app.globalData.darkMode;
    if (dm !== this.data.darkMode) {
      this.setData({ darkMode: dm });
      this.applyDark(dm);
    }
    let pendingId = wx.getStorageSync('openProjectId');
    if (pendingId) {
      wx.removeStorageSync('openProjectId');
      let ps = this._getPs();
      let p = ps.find(x => x.id === pendingId);
      if (p && !p.deleted) {
        wx.setNavigationBarTitle({ title: p.name });
        this._imageCache = []; this._fullCode = ''; this._fullText = '';
        this.setData({
          view: 'work', curId: pendingId, curName: p.name,
          images: (p.items || []).map(img => ({ id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview })),
          mode: '',
        });
        return;
      }
    }
  },

  load() {
    this.setData({ loading: true });
    let ps = wx.getStorageSync('projects') || [];
    this._projectsCache = ps;

    // 过滤+映射，只取需要的字段
    let filtered = [];
    for (let i = 0; i < ps.length; i++) {
      let p = ps[i];
      if (p.deleted) continue;
      let items = p.items || [];
      let mapped = [];
      for (let j = 0; j < items.length; j++) {
        let img = items[j];
        mapped.push({ id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview });
      }
      filtered.push({ id: p.id, name: p.name, date: p.date, items: mapped });
    }
    this.setData({ projects: filtered, loading: false });
  },

  applyDark(dark) {
    let bg = dark ? '#000000' : '#F5F5F7';
    let fc = dark ? '#ffffff' : '#000000';
    wx.setNavigationBarColor({ frontColor: fc, backgroundColor: bg });
    wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg });
  },

  createProject() {
    wx.showModal({
      title: '新建项目', editable: true, placeholderText: '输入项目名称',
      success: (res) => {
        if (res.confirm && res.content) {
          let ps = this._getPs();
          let newProj = { id: 'p_' + Date.now(), name: res.content, date: new Date().toLocaleString(), items: [] };
          ps.unshift(newProj);
          this._projectsCache = ps;
          try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
          // 局部更新，prepend到列表头部
          let newList = [{ id: newProj.id, name: newProj.name, date: newProj.date, items: [] }].concat(this.data.projects);
          this.setData({ projects: newList });
        }
      },
    });
  },

  openProject(e) {
    let id = e.currentTarget.dataset.id;
    // 使用缓存，避免频繁读取存储
    let ps = this._getPs();
    let p = ps.find(x => x.id === id);
    if (!p || p.deleted) return;
    wx.setNavigationBarTitle({ title: p.name });
    this._imageCache = []; this._fullCode = ''; this._fullText = '';
    this.setData({
      view: 'work', curId: id, curName: p.name,
      images: (p.items || []).map(img => ({ id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview })),
      mode: '',
    });
  },

  delProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除', content: '确定删除？',
      success: (res) => {
        if (res.confirm) {
          let ps = this._getPs();
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) {
            ps[i].deleted = true;
            this._projectsCache = ps;
            try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '操作失败', icon: 'none' }); }
            // 局部更新，避免全量重载
            let newList = this.data.projects.filter(item => item.id !== id);
            this.setData({ projects: newList });
          }
        }
      },
    });
  },

  goBack() {
    wx.setNavigationBarTitle({ title: '图片转代码' });
    this.setData({ view: 'list' });
    // 只在数据有变更时才重载
    if (this._dataDirty) {
      this.load();
      this._dataDirty = false;
    }
  },

  saveImages(list) {
    let ps = this._getPs();
    let i = ps.findIndex(p => p.id === this.data.curId);
    if (i >= 0) {
      let target = list || this.data.images;
      ps[i].items = (target || []).map((img, idx) => {
        let full = (this._imageCache && this._imageCache[idx]) ? this._imageCache[idx] : {};
        return { ...img, base64: full.base64 || '', textContent: full.textContent || '' };
      });
      this._projectsCache = ps;
      this._dataDirty = true;
      try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
    }
  },

  showMenu() { this.setData({ menuShow: true }); },
  hideMenu() { this.setData({ menuShow: false }); },
  reset(m) {
    this._fullCode = ''; this._fullText = ''; this._imageCache = []; this._batchCodes = [];
    this.setData({ menuShow: false, mode: m, imagePath: '', codeShow: '', size: '', converting: false, convertProgress: 0, convertStage: '', compressedSize: '' });
    if (m === 'text2code' || m === 'code2text' || m === 'code2img') {
      this.setData({ textContent: '', textResult: '', decodeInput: '', decodeResult: '', decodeImagePath: '' });
    } else if (m === 'batch') {
      this.setData({ batchItems: [], batchConverting: false, batchProgress: '', batchTotal: 0 });
    } else if (m === 'qrcode') {
      this.setData({ qrInput: '', qrImagePath: '', qrGenerating: false, qrEcLevel: 'M' });
    } else if (m === 'compress') {
      this.setData({ compressImagePath: '', compressOrigSize: '', compressNewSize: '', compressRatio: '', compressResultPath: '', compressing: false, compressQualityLevel: 60 });
    } else if (m === 'watermark') {
      this.setData({ wmImagePath: '', wmText: '', wmPosition: 'bottom-right', wmColor: '#ffffff', wmOpacity: 60, wmFontSize: 32, wmResultPath: '', wmProcessing: false });
    } else if (m === 'fmt') {
      this.setData({ fmtImg: '', fmtFrom: '', fmtTo: 'png', fmtResult: '', fmtSize: '', fmtConverting: false });
    } else if (m === 'resize') {
      this.setData({ resizeImg: '', resizeW: 0, resizeH: 0, resizeNewW: 0, resizeNewH: 0, resizeRatio: true, resizeResult: '', resizeSize: '', resizing: false });
    } else if (m === 'crop') {
      this.setData({ cropImg: '', cropW: 0, cropH: 0, cropRatio: 'free', cropResult: '', cropSize: '', cropping: false });
    } else if (m === 'rotate') {
      this.setData({ rotImg: '', rotDeg: 0, rotFlipH: false, rotFlipV: false, rotResult: '', rotSize: '', rotating: false });
    }
  },
  startImg2Code() { this.reset('img2code'); },
  startText2Code() { this.reset('text2code'); },
  startCode2Text() { this.reset('code2text'); },
  startCode2Img() { this.reset('code2img'); },
  startBatchImg() { this.reset('batch'); },
  startQrCode() { this.reset('qrcode'); },
  startCompress() { this.reset('compress'); },
  startWatermark() { this.reset('watermark'); },
  startFmt() { this.reset('fmt'); },
  startResize() { this.reset('resize'); },
  startCrop() { this.reset('crop'); },
  startRotate() { this.reset('rotate'); },

  // ========== 图片压缩 ==========
  chooseCompressImage() {
    let that = this;
    let onSuccess = (res) => {
      let tempPath = '';
      if (res.tempFiles && res.tempFiles[0]) {
        tempPath = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
      }
      if (!tempPath && res.tempFilePaths && res.tempFilePaths[0]) {
        tempPath = res.tempFilePaths[0];
      }
      if (!tempPath) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      // 保存到本地
      let fs = wx.getFileSystemManager();
      let dest = wx.env.USER_DATA_PATH + '/compress_' + Date.now() + '.jpg';
      fs.copyFile({
        srcPath: tempPath, destPath: dest,
        success() { that._onCompressImagePicked(dest); },
        fail() {
          fs.saveFile({
            tempFilePath: tempPath,
            success(r) { that._onCompressImagePicked(r.savedFilePath); },
            fail() { wx.showToast({ title: '图片保存失败', icon: 'none' }); },
          });
        },
      });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['original'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], sizeType: ['original'], success: onSuccess, fail: () => {} });
    }
  },

  _onCompressImagePicked(path) {
    let that = this;
    wx.getFileInfo({
      filePath: path,
      success(info) {
        let kb = (info.size / 1024).toFixed(1);
        let mb = (info.size / 1024 / 1024).toFixed(2);
        let sizeStr = info.size > 1024 * 1024 ? mb + ' MB' : kb + ' KB';
        that.setData({
          compressImagePath: path,
          compressOrigSize: sizeStr,
          compressNewSize: '',
          compressRatio: '',
          compressResultPath: '',
        });
      },
      fail() {
        that.setData({
          compressImagePath: path,
          compressOrigSize: '未知',
          compressNewSize: '',
          compressRatio: '',
          compressResultPath: '',
        });
      },
    });
  },

  setCompressQuality(e) {
    this.setData({ compressQualityLevel: Number(e.currentTarget.dataset.q) });
  },

  doCompress() {
    let that = this;
    let src = this.data.compressImagePath;
    if (!src) return;
    this.setData({ compressing: true });
    wx.showNavigationBarLoading();

    wx.compressImage({
      src: src,
      quality: this.data.compressQualityLevel,
      success(res) {
        let compressedPath = res.tempFilePath;
        // 同时获取压缩后和原始文件信息，减少嵌套
        let getInfo = (path) => new Promise((resolve) => {
          wx.getFileInfo({ filePath: path, success: resolve, fail: () => resolve({ size: 0 }) });
        });
        Promise.all([getInfo(compressedPath), getInfo(src)]).then(([compInfo, origInfo]) => {
          let newKB = compInfo.size;
          let origKB = origInfo.size;
          let ratio = origKB > 0 ? ((1 - newKB / origKB) * 100).toFixed(0) : '0';
          let newSizeStr = newKB > 1024 * 1024 ? (newKB / 1024 / 1024).toFixed(2) + ' MB' : (newKB / 1024).toFixed(1) + ' KB';

          // 保存压缩结果
          let fs = wx.getFileSystemManager();
          let dest = wx.env.USER_DATA_PATH + '/compressed_' + Date.now() + '.jpg';
          fs.copyFile({
            srcPath: compressedPath, destPath: dest,
            success() {
              that.setData({ compressing: false, compressNewSize: newSizeStr, compressRatio: ratio, compressResultPath: dest });
              wx.hideNavigationBarLoading();
              wx.showToast({ title: '压缩完成', icon: 'success' });
            },
            fail() {
              that.setData({ compressing: false, compressNewSize: newSizeStr, compressRatio: ratio, compressResultPath: compressedPath });
              wx.hideNavigationBarLoading();
            },
          });
        }).catch(() => {
          that.setData({ compressing: false });
          wx.hideNavigationBarLoading();
          wx.showToast({ title: '获取压缩结果失败', icon: 'none' });
        });
      },
      fail() {
        that.setData({ compressing: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '压缩失败', icon: 'none' });
      },
    });
  },

  saveCompressedImage() {
    let path = this.data.compressResultPath;
    if (!path) return;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要授权', content: '请在设置中允许保存到相册',
            success(r) { if (r.confirm) wx.openSetting(); },
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  shareCompressedImage() {
    let path = this.data.compressResultPath;
    if (!path) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success(r) {
        if (r.tapIndex === 0) {
          wx.shareFileMessage({ filePath: path, fileName: 'compressed.jpg' });
        } else if (r.tapIndex === 1) {
          wx.openDocument({ filePath: path, showMenu: true });
        }
      },
    });
  },

  previewCompressResult() {
    if (this.data.compressResultPath) wx.previewImage({ urls: [this.data.compressResultPath] });
  },

  // ========== 图片加水印 ==========
  chooseWmImage() {
    let that = this;
    let onSuccess = (res) => {
      let tempPath = '';
      if (res.tempFiles && res.tempFiles[0]) {
        tempPath = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
      }
      if (!tempPath && res.tempFilePaths && res.tempFilePaths[0]) {
        tempPath = res.tempFilePaths[0];
      }
      if (!tempPath) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      // 保存到本地
      let fs = wx.getFileSystemManager();
      let dest = wx.env.USER_DATA_PATH + '/wm_' + Date.now() + '.jpg';
      fs.copyFile({
        srcPath: tempPath, destPath: dest,
        success() { that.setData({ wmImagePath: dest, wmResultPath: '' }); },
        fail() {
          fs.saveFile({
            tempFilePath: tempPath,
            success(r) { that.setData({ wmImagePath: r.savedFilePath, wmResultPath: '' }); },
            fail() { wx.showToast({ title: '图片保存失败', icon: 'none' }); },
          });
        },
      });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    }
  },

  onWmTextInput(e) { this.setData({ wmText: e.detail.value }); },
  setWmPosition(e) { this.setData({ wmPosition: e.currentTarget.dataset.pos }); },
  setWmColor(e) { this.setData({ wmColor: e.currentTarget.dataset.color }); },
  onWmOpacityChange(e) { this.setData({ wmOpacity: e.detail.value }); },
  onWmFontSizeChange(e) { this.setData({ wmFontSize: e.detail.value }); },

  addWatermark() {
    let that = this;
    let { wmImagePath, wmText, wmPosition, wmColor, wmOpacity, wmFontSize } = this.data;
    if (!wmImagePath || !wmText) return;

    this.setData({ wmProcessing: true });
    wx.showNavigationBarLoading();

    // 获取图片信息
    wx.getImageInfo({
      src: wmImagePath,
      success(imgInfo) {
        let imgWidth = imgInfo.width;
        let imgHeight = imgInfo.height;

        // 使用 Canvas 2D 绘制水印
        const query = wx.createSelectorQuery();
        query.select('#wmCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            that.setData({ wmProcessing: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          // 设置 Canvas 尺寸为图片尺寸
          canvas.width = imgWidth;
          canvas.height = imgHeight;

          // 创建图片对象
          const img = canvas.createImage();
          img.onload = function() {
            // 绘制原图
            ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

            // 计算水印位置
            let x = 0, y = 0;
            let textAlign = 'left';
            let textBaseline = 'top';
            let padding = 20;

            // 根据字体大小调整位置
            let fontSize = wmFontSize * (imgWidth / 750); // 按比例缩放

            switch (wmPosition) {
              case 'top-left':
                x = padding;
                y = padding;
                textAlign = 'left';
                textBaseline = 'top';
                break;
              case 'top-right':
                x = imgWidth - padding;
                y = padding;
                textAlign = 'right';
                textBaseline = 'top';
                break;
              case 'center':
                x = imgWidth / 2;
                y = imgHeight / 2;
                textAlign = 'center';
                textBaseline = 'middle';
                break;
              case 'bottom-left':
                x = padding;
                y = imgHeight - padding;
                textAlign = 'left';
                textBaseline = 'bottom';
                break;
              case 'bottom-right':
                x = imgWidth - padding;
                y = imgHeight - padding;
                textAlign = 'right';
                textBaseline = 'bottom';
                break;
            }

            // 设置水印样式
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
            ctx.textAlign = textAlign;
            ctx.textBaseline = textBaseline;

            // 绘制文字阴影（增强可读性）
            ctx.fillStyle = 'rgba(0, 0, 0, ' + (wmOpacity / 100 * 0.5) + ')';
            ctx.fillText(wmText, x + 2, y + 2);

            // 绘制水印文字
            let color = wmColor;
            let alpha = wmOpacity / 100;
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.fillText(wmText, x, y);
            ctx.globalAlpha = 1;

            // 导出图片
            wx.canvasToTempFilePath({
              canvas: canvas,
              quality: 0.9,
              success(res) {
                // 保存结果
                let fs = wx.getFileSystemManager();
                let dest = wx.env.USER_DATA_PATH + '/wm_result_' + Date.now() + '.jpg';
                fs.copyFile({
                  srcPath: res.tempFilePath, destPath: dest,
                  success() {
                    that.setData({ wmResultPath: dest, wmProcessing: false });
                    wx.hideNavigationBarLoading();
                    wx.showToast({ title: '水印添加成功', icon: 'success' });
                  },
                  fail() {
                    that.setData({ wmResultPath: res.tempFilePath, wmProcessing: false });
                    wx.hideNavigationBarLoading();
                    wx.showToast({ title: '水印添加成功', icon: 'success' });
                  },
                });
              },
              fail(err) {
                that.setData({ wmProcessing: false });
                wx.hideNavigationBarLoading();
                wx.showToast({ title: '导出失败', icon: 'none' });
              },
            });
          };

          img.onerror = function() {
            that.setData({ wmProcessing: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: '图片加载失败', icon: 'none' });
          };

          img.src = wmImagePath;
        });
      },
      fail() {
        that.setData({ wmProcessing: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '获取图片信息失败', icon: 'none' });
      },
    });
  },

  saveWmImage() {
    let path = this.data.wmResultPath;
    if (!path) return;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '需要授权', content: '请在设置中允许保存到相册',
            success(r) { if (r.confirm) wx.openSetting(); },
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  shareWmImage() {
    let path = this.data.wmResultPath;
    if (!path) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success(r) {
        if (r.tapIndex === 0) {
          wx.shareFileMessage({ filePath: path, fileName: 'watermark.jpg' });
        } else if (r.tapIndex === 1) {
          wx.openDocument({ filePath: path, showMenu: true });
        }
      },
    });
  },

  previewWmResult() {
    let path = this.data.wmResultPath || this.data.wmImagePath;
    if (path) wx.previewImage({ urls: [path] });
  },

  // ========== 图片格式转换 ==========
  chooseFmtImg() {
    let that = this;
    let onSuccess = (res) => {
      let p = '';
      if (res.tempFiles && res.tempFiles[0]) p = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
      if (!p && res.tempFilePaths && res.tempFilePaths[0]) p = res.tempFilePaths[0];
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      // 检测格式
      let ext = p.split('.').pop().toLowerCase();
      let from = 'jpg';
      if (ext === 'png') from = 'png';
      else if (ext === 'webp') from = 'webp';
      that.setData({ fmtImg: p, fmtFrom: from, fmtTo: from === 'png' ? 'jpg' : 'png', fmtResult: '', fmtSize: '' });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    }
  },

  setFmtTo(e) { this.setData({ fmtTo: e.currentTarget.dataset.fmt }); },

  doFmtConvert() {
    let that = this;
    let { fmtImg, fmtTo } = this.data;
    if (!fmtImg) return;
    this.setData({ fmtConverting: true });
    wx.showNavigationBarLoading();

    wx.getImageInfo({
      src: fmtImg,
      success(info) {
        that._canvasExport({
          canvasId: 'fmtCanvas',
          imgSrc: fmtImg,
          drawW: info.width,
          drawH: info.height,
          fileType: fmtTo === 'jpg' ? 'jpg' : 'png',
          quality: fmtTo === 'jpg' ? 0.9 : undefined,
          destPrefix: 'fmt',
        }, function(err, result) {
          that.setData({ fmtConverting: false });
          wx.hideNavigationBarLoading();
          if (err) { wx.showToast({ title: err, icon: 'none' }); return; }
          that.setData({ fmtResult: result.path, fmtSize: result.size });
          wx.showToast({ title: '转换完成', icon: 'success' });
        });
      },
      fail() {
        that.setData({ fmtConverting: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '获取图片信息失败', icon: 'none' });
      },
    });
  },

  saveFmtImg() {
    let p = this.data.fmtResult;
    if (!p) return;
    wx.saveImageToPhotosAlbum({
      filePath: p,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({ title: '需要授权', content: '请在设置中允许保存到相册', success(r) { if (r.confirm) wx.openSetting(); } });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  shareFmtImg() {
    let p = this.data.fmtResult;
    let fmt = this.data.fmtTo;
    if (!p) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success(r) {
        if (r.tapIndex === 0) wx.shareFileMessage({ filePath: p, fileName: 'converted.' + fmt });
        else if (r.tapIndex === 1) wx.openDocument({ filePath: p, showMenu: true });
      },
    });
  },

  previewFmtResult() {
    if (this.data.fmtResult) wx.previewImage({ urls: [this.data.fmtResult] });
  },
  // ========== 图片尺寸调整 ==========
  chooseResizeImg() {
    let that = this;
    let onSuccess = (res) => {
      let p = '';
      if (res.tempFiles && res.tempFiles[0]) p = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
      if (!p && res.tempFilePaths && res.tempFilePaths[0]) p = res.tempFilePaths[0];
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      wx.getImageInfo({
        src: p,
        success(info) {
          that.setData({
            resizeImg: p, resizeW: info.width, resizeH: info.height,
            resizeNewW: info.width, resizeNewH: info.height,
            resizeResult: '', resizeSize: '',
          });
        },
        fail() {
          that.setData({ resizeImg: p, resizeW: 0, resizeH: 0, resizeNewW: 0, resizeNewH: 0, resizeResult: '', resizeSize: '' });
        },
      });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    }
  },

  onResizeW(e) {
    let w = Number(e.detail.value) || 0;
    let h = this.data.resizeNewH;
    if (this.data.resizeRatio && this.data.resizeW > 0) {
      h = Math.round(w * this.data.resizeH / this.data.resizeW);
    }
    this.setData({ resizeNewW: w, resizeNewH: h });
  },

  onResizeH(e) {
    let h = Number(e.detail.value) || 0;
    let w = this.data.resizeNewW;
    if (this.data.resizeRatio && this.data.resizeH > 0) {
      w = Math.round(h * this.data.resizeW / this.data.resizeH);
    }
    this.setData({ resizeNewW: w, resizeNewH: h });
  },

  toggleResizeRatio() { this.setData({ resizeRatio: !this.data.resizeRatio }); },

  doResize() {
    let that = this;
    let { resizeImg, resizeNewW, resizeNewH } = this.data;
    if (!resizeImg || resizeNewW <= 0 || resizeNewH <= 0) return;
    this.setData({ resizing: true });
    wx.showNavigationBarLoading();

    this._canvasExport({
      canvasId: 'resizeCanvas',
      imgSrc: resizeImg,
      drawW: resizeNewW,
      drawH: resizeNewH,
      fileType: 'jpg',
      quality: 0.9,
      destPrefix: 'resize',
    }, function(err, result) {
      that.setData({ resizing: false });
      wx.hideNavigationBarLoading();
      if (err) { wx.showToast({ title: err, icon: 'none' }); return; }
      that.setData({ resizeResult: result.path, resizeSize: result.size });
      wx.showToast({ title: '调整完成', icon: 'success' });
    });
  },

  saveResizeImg() {
    let p = this.data.resizeResult;
    if (!p) return;
    wx.saveImageToPhotosAlbum({
      filePath: p,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({ title: '需要授权', content: '请在设置中允许保存到相册', success(r) { if (r.confirm) wx.openSetting(); } });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  shareResizeImg() {
    let p = this.data.resizeResult;
    if (!p) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success(r) {
        if (r.tapIndex === 0) wx.shareFileMessage({ filePath: p, fileName: 'resized.jpg' });
        else if (r.tapIndex === 1) wx.openDocument({ filePath: p, showMenu: true });
      },
    });
  },

  previewResizeResult() {
    if (this.data.resizeResult) wx.previewImage({ urls: [this.data.resizeResult] });
  },

  // ========== 图片裁剪 ==========
  chooseCropImg() {
    let that = this;
    let onSuccess = (res) => {
      let p = '';
      if (res.tempFiles && res.tempFiles[0]) p = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
      if (!p && res.tempFilePaths && res.tempFilePaths[0]) p = res.tempFilePaths[0];
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      wx.getImageInfo({
        src: p,
        success(info) {
          that.setData({ cropImg: p, cropW: info.width, cropH: info.height, cropResult: '', cropSize: '' });
        },
        fail() {
          that.setData({ cropImg: p, cropW: 0, cropH: 0, cropResult: '', cropSize: '' });
        },
      });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    }
  },

  setCropRatio(e) { this.setData({ cropRatio: e.currentTarget.dataset.ratio }); },

  doCrop() {
    let that = this;
    let { cropImg, cropW, cropH, cropRatio } = this.data;
    if (!cropImg || cropW <= 0 || cropH <= 0) return;

    // 计算裁剪区域（居中裁剪）
    let sx = 0, sy = 0, sw = cropW, sh = cropH;
    if (cropRatio === '1:1') {
      let side = Math.min(cropW, cropH);
      sx = Math.floor((cropW - side) / 2);
      sy = Math.floor((cropH - side) / 2);
      sw = side; sh = side;
    } else if (cropRatio === '4:3') {
      let targetW = cropW;
      let targetH = Math.floor(cropW * 3 / 4);
      if (targetH > cropH) {
        targetH = cropH;
        targetW = Math.floor(cropH * 4 / 3);
      }
      sx = Math.floor((cropW - targetW) / 2);
      sy = Math.floor((cropH - targetH) / 2);
      sw = targetW; sh = targetH;
    } else if (cropRatio === '16:9') {
      let targetW = cropW;
      let targetH = Math.floor(cropW * 9 / 16);
      if (targetH > cropH) {
        targetH = cropH;
        targetW = Math.floor(cropH * 16 / 9);
      }
      sx = Math.floor((cropW - targetW) / 2);
      sy = Math.floor((cropH - targetH) / 2);
      sw = targetW; sh = targetH;
    }
    // free 模式不裁剪，使用原图

    this.setData({ cropping: true });
    wx.showNavigationBarLoading();

    const query = wx.createSelectorQuery();
    query.select('#cropCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) {
        that.setData({ cropping: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      canvas.width = sw;
      canvas.height = sh;

      const img = canvas.createImage();
      img.onload = function() {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        wx.canvasToTempFilePath({
          canvas: canvas,
          quality: 0.9,
          success(r) {
            let fs = wx.getFileSystemManager();
            let dest = wx.env.USER_DATA_PATH + '/crop_' + Date.now() + '.jpg';
            fs.copyFile({
              srcPath: r.tempFilePath, destPath: dest,
              success() {
                wx.getFileInfo({
                  filePath: dest,
                  success(fi) {
                    let kb = (fi.size / 1024).toFixed(1);
                    that.setData({ cropResult: dest, cropSize: kb + ' KB', cropping: false });
                    wx.hideNavigationBarLoading();
                    wx.showToast({ title: '裁剪完成', icon: 'success' });
                  },
                  fail() {
                    that.setData({ cropResult: dest, cropSize: '', cropping: false });
                    wx.hideNavigationBarLoading();
                  },
                });
              },
              fail() {
                that.setData({ cropResult: r.tempFilePath, cropSize: '', cropping: false });
                wx.hideNavigationBarLoading();
              },
            });
          },
          fail() {
            that.setData({ cropping: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: '导出失败', icon: 'none' });
          },
        });
      };
      img.onerror = function() {
        that.setData({ cropping: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '图片加载失败', icon: 'none' });
      };
      img.src = cropImg;
    });
  },

  saveCropImg() {
    let p = this.data.cropResult;
    if (!p) return;
    wx.saveImageToPhotosAlbum({
      filePath: p,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({ title: '需要授权', content: '请在设置中允许保存到相册', success(r) { if (r.confirm) wx.openSetting(); } });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  shareCropImg() {
    let p = this.data.cropResult;
    if (!p) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success(r) {
        if (r.tapIndex === 0) wx.shareFileMessage({ filePath: p, fileName: 'cropped.jpg' });
        else if (r.tapIndex === 1) wx.openDocument({ filePath: p, showMenu: true });
      },
    });
  },

  previewCropResult() {
    if (this.data.cropResult) wx.previewImage({ urls: [this.data.cropResult] });
  },

  // ========== 图片旋转 ==========
  chooseRotImg() {
    let that = this;
    let onSuccess = (res) => {
      let p = '';
      if (res.tempFiles && res.tempFiles[0]) p = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
      if (!p && res.tempFilePaths && res.tempFilePaths[0]) p = res.tempFilePaths[0];
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that.setData({ rotImg: p, rotDeg: 0, rotFlipH: false, rotFlipV: false, rotResult: '', rotSize: '' });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    }
  },

  rotLeft() { this.setData({ rotDeg: (this.data.rotDeg + 270) % 360 }); },
  rotRight() { this.setData({ rotDeg: (this.data.rotDeg + 90) % 360 }); },
  rotFlipH() { this.setData({ rotFlipH: !this.data.rotFlipH }); },
  rotFlipV() { this.setData({ rotFlipV: !this.data.rotFlipV }); },

  doRotate() {
    let that = this;
    let { rotImg, rotDeg, rotFlipH, rotFlipV } = this.data;
    if (!rotImg) return;

    this.setData({ rotating: true });
    wx.showNavigationBarLoading();

    wx.getImageInfo({
      src: rotImg,
      success(info) {
        let iw = info.width, ih = info.height;
        // 90/270度旋转时宽高互换
        let isRightAngle = (rotDeg === 90 || rotDeg === 270);
        let cw = isRightAngle ? ih : iw;
        let ch = isRightAngle ? iw : ih;

        const query = wx.createSelectorQuery();
        query.select('#rotCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            that.setData({ rotating: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'Canvas 初始化失败', icon: 'none' });
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          canvas.width = cw;
          canvas.height = ch;

          const img = canvas.createImage();
          img.onload = function() {
            ctx.save();
            ctx.translate(cw / 2, ch / 2);
            ctx.rotate(rotDeg * Math.PI / 180);
            if (rotFlipH) ctx.scale(-1, 1);
            if (rotFlipV) ctx.scale(1, -1);
            ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
            ctx.restore();

            wx.canvasToTempFilePath({
              canvas: canvas,
              quality: 0.9,
              success(r) {
                let fs = wx.getFileSystemManager();
                let dest = wx.env.USER_DATA_PATH + '/rot_' + Date.now() + '.jpg';
                fs.copyFile({
                  srcPath: r.tempFilePath, destPath: dest,
                  success() {
                    wx.getFileInfo({
                      filePath: dest,
                      success(fi) {
                        let kb = (fi.size / 1024).toFixed(1);
                        that.setData({ rotResult: dest, rotSize: kb + ' KB', rotating: false });
                        wx.hideNavigationBarLoading();
                        wx.showToast({ title: '旋转完成', icon: 'success' });
                      },
                      fail() {
                        that.setData({ rotResult: dest, rotSize: '', rotating: false });
                        wx.hideNavigationBarLoading();
                      },
                    });
                  },
                  fail() {
                    that.setData({ rotResult: r.tempFilePath, rotSize: '', rotating: false });
                    wx.hideNavigationBarLoading();
                  },
                });
              },
              fail() {
                that.setData({ rotating: false });
                wx.hideNavigationBarLoading();
                wx.showToast({ title: '导出失败', icon: 'none' });
              },
            });
          };
          img.onerror = function() {
            that.setData({ rotating: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: '图片加载失败', icon: 'none' });
          };
          img.src = rotImg;
        });
      },
      fail() {
        that.setData({ rotating: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '获取图片信息失败', icon: 'none' });
      },
    });
  },

  saveRotImg() {
    let p = this.data.rotResult;
    if (!p) return;
    wx.saveImageToPhotosAlbum({
      filePath: p,
      success() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
      fail(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({ title: '需要授权', content: '请在设置中允许保存到相册', success(r) { if (r.confirm) wx.openSetting(); } });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  shareRotImg() {
    let p = this.data.rotResult;
    if (!p) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success(r) {
        if (r.tapIndex === 0) wx.shareFileMessage({ filePath: p, fileName: 'rotated.jpg' });
        else if (r.tapIndex === 1) wx.openDocument({ filePath: p, showMenu: true });
      },
    });
  },

  previewRotResult() {
    if (this.data.rotResult) wx.previewImage({ urls: [this.data.rotResult] });
  },

  quickAction(e) {
    let mode = e.currentTarget.dataset.mode;
    if (!this.data.curId) {
      // 使用缓存，避免频繁读取存储
      let ps = this._getPs();
      let p = { id: 'p_' + Date.now(), name: '快速项目', date: new Date().toLocaleString(), items: [] };
      ps.unshift(p);
      this._projectsCache = ps; // 更新缓存
      try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); return; }
      this.setData({ view: 'work', curId: p.id, curName: p.name, images: [] });
    }
    this.reset(mode);
  },

  _onImagePicked(tempPath) {
    this._fullCode = '';
    this.setData({ imagePath: tempPath, codeShow: '', size: '' });
  },

  _saveTempImage(tempPath) {
    if (!tempPath) {
      wx.showToast({ title: '图片路径无效', icon: 'none' });
      return;
    }
    let fs = wx.getFileSystemManager();
    let dest = wx.env.USER_DATA_PATH + '/img_' + Date.now() + '.jpg';
    fs.copyFile({
      srcPath: tempPath, destPath: dest,
      success: () => this._onImagePicked(dest),
      fail: () => {
        fs.saveFile({
          tempFilePath: tempPath,
          success: (res) => this._onImagePicked(res.savedFilePath),
          fail: () => wx.showToast({ title: '图片保存失败', icon: 'none' }),
        });
      },
    });
  },

  chooseImage() {
    let onSuccess = (res) => {
      let tempPath = '';
      if (res.tempFiles && res.tempFiles[0]) {
        tempPath = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
      }
      if (!tempPath && res.tempFilePaths && res.tempFilePaths[0]) {
        tempPath = res.tempFilePaths[0];
      }
      if (!tempPath) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      this._saveTempImage(tempPath);
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: 1, sourceType: ['album', 'camera'], sizeType: ['compressed'], success: onSuccess, fail: () => {} });
    }
  },

  setQuality(e) {
    this.setData({ compressQuality: Number(e.currentTarget.dataset.q) });
  },

  convertImage() {
    let that = this;
    let src = this.data.imagePath;
    if (!src) return;

    // 合并初始状态更新，减少setData调用
    this.setData({ converting: true, convertProgress: 5, convertStage: '准备中...', compressedSize: '' });
    wx.showNavigationBarLoading();

    // Step 1: 检查原始文件大小
    wx.getFileInfo({
      filePath: src,
      success(info) {
        let origKB = (info.size / 1024).toFixed(1);

        // 小于 200KB 跳过压缩
        if (info.size < 200 * 1024) {
          that.setData({ convertProgress: 30, convertStage: '文件较小，跳过压缩' });
          that._doReadBase64(src, origKB);
          return;
        }

        // Step 2: 压缩图片
        that.setData({ convertProgress: 20, convertStage: '压缩中...' });
        wx.compressImage({
          src: src,
          quality: that.data.compressQuality,
          success(res) {
            let compressedPath = res.tempFilePath;
            wx.getFileInfo({
              filePath: compressedPath,
              success(cInfo) {
                let compKB = (cInfo.size / 1024).toFixed(1);
                let ratio = ((1 - cInfo.size / info.size) * 100).toFixed(0);
                that.setData({ convertProgress: 40, convertStage: '压缩完成，减小 ' + ratio + '%', compressedSize: compKB + ' KB' });
                that._doReadBase64(compressedPath, compKB);
              },
              fail() { that._doReadBase64(src, origKB); },
            });
          },
          fail() {
            // 压缩失败，回退原图
            that.setData({ convertProgress: 30, convertStage: '压缩不支持，使用原图' });
            that._doReadBase64(src, origKB);
          },
        });
      },
      fail() {
        // 无法获取文件信息，直接读取
        that.setData({ convertProgress: 30, convertStage: '读取中...' });
        that._doReadBase64(src, '');
      },
    });
  },

  _doReadBase64(filePath, fileSizeKB) {
    let that = this;
    this.setData({ convertProgress: 55, convertStage: '读取数据中...' });

    wx.getFileSystemManager().readFile({
      filePath: filePath, encoding: 'base64',
      success(res) {
        let b64 = 'data:image/jpeg;base64,' + res.data;
        let kb = fileSizeKB || (res.data.length * 0.75 / 1024).toFixed(1);
        that._fullCode = b64;
        let itemMeta = { id: Date.now(), type: 'image', path: that.data.imagePath, size: kb + ' KB', preview: '' };
        that._imageCache = [{ base64: b64 }].concat(that._imageCache).slice(0, 10);
        let list = [itemMeta].concat(that.data.images).slice(0, 20);

        // 合并所有更新到一次setData
        that.setData({
          convertProgress: 100,
          convertStage: '完成！' + kb + ' KB',
          codeShow: b64.slice(0, 200) + '...',
          size: kb + ' KB',
          images: list,
        });
        that.saveImages(list);

        wx.hideNavigationBarLoading();
        // 延迟清除进度条
        setTimeout(() => {
          that.setData({ converting: false, convertProgress: 0, convertStage: '' });
        }, 800);
      },
      fail() {
        wx.hideNavigationBarLoading();
        that.setData({ converting: false, convertProgress: 0, convertStage: '' });
        wx.showToast({ title: '读取失败', icon: 'none' });
      },
    });
  },

  shareCodeFile() {
    let code = this._fullCode;
    if (!code) return;
    let fname = wx.env.USER_DATA_PATH + '/share_' + Date.now() + '.txt';
    wx.getFileSystemManager().writeFile({
      filePath: fname, data: code, encoding: 'utf8',
      success: () => wx.shareFileMessage({ filePath: fname, fileName: 'base64.txt' }),
      fail: () => wx.showToast({ title: '写入失败', icon: 'none' }),
    });
  },

  copyCode() {
    if (!this._fullCode) return;
    wx.setClipboardData({
      data: this._fullCode.slice(0, 80000),
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '太长了', icon: 'none' }),
    });
  },

  previewImg() { wx.previewImage({ urls: [this.data.imagePath] }); },

  saveCodeFile() {
    let code = this._fullCode;
    if (!code) return;
    let that = this;
    wx.showModal({
      title: '保存代码文件',
      editable: true,
      placeholderText: '输入文件名',
      success: (res) => {
        if (!res.confirm) return;
        let name = (res.content || 'base64_text').replace(/[:"<>|?*\n\r\\/]/g, '-').slice(0, 50);
        let fname = wx.env.USER_DATA_PATH + '/' + name + '.txt';

        wx.getFileSystemManager().writeFile({
          filePath: fname,
          data: code,
          encoding: 'utf8',
          success: () => {
            wx.showToast({ title: '已保存', icon: 'success' });
            wx.showActionSheet({
              itemList: ['用其他应用打开', '转发给朋友', '浏览保存目录'],
              success: (r) => {
                if (r.tapIndex === 0) {
                  wx.openDocument({ filePath: fname, showMenu: true, fail: () => that.browseFiles() });
                } else if (r.tapIndex === 1) {
                  wx.shareFileMessage({ filePath: fname, fileName: name + '.txt' });
                } else {
                  that.browseFiles();
                }
              },
            });
          },
          fail: (err) => wx.showToast({ title: '写入失败: ' + (err.errMsg || ''), icon: 'none' }),
        });
      },
    });
  },

  onTextInput(e) { this.setData({ textContent: e.detail.value }); },
  convertText() {
    let raw = this.data.textContent; if (!raw) return;
    let b64 = '';
    try {
      let bytes = new TextEncoder().encode(raw);
      let str = '';
      for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      b64 = btoa(str);
    } catch (e) { b64 = '编码失败'; }
    this._fullText = b64;
    let itemMeta = { id: Date.now(), type: 'text', path: '', size: raw.length + ' 字', preview: raw.slice(0, 30) };
    this._imageCache = [{ base64: b64, textContent: raw }].concat(this._imageCache).slice(0, 10);
    let list = [itemMeta].concat(this.data.images).slice(0, 20);
    // 合并更新
    this.setData({ textResult: b64.length > 300 ? b64.slice(0, 300) + '...' : b64, images: list });
    this.saveImages(list);
  },
  copyTextCode() {
    if (!this._fullText) return;
    wx.setClipboardData({
      data: this._fullText.slice(0, 80000),
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '太长了', icon: 'none' }),
    });
  },

  onDecodeInput(e) { this.setData({ decodeInput: e.detail.value }); },
  decodeToText() {
    let b64 = this.data.decodeInput; let idx = b64.indexOf('base64,'); if (idx >= 0) b64 = b64.slice(idx + 7);
    b64 = b64.replace(/\s/g, '');
    try {
      let bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      let r = typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : String.fromCharCode.apply(null, bytes);
      let itemMeta = { id: Date.now(), type: 'text', path: '', size: r.length + ' 字', preview: r.slice(0, 30) };
      this._imageCache = [{ base64: this.data.decodeInput, textContent: r }].concat(this._imageCache).slice(0, 10);
      let list = [itemMeta].concat(this.data.images).slice(0, 20);
      // 合并更新
      this.setData({ decodeResult: r.length > 500 ? r.slice(0, 500) + '...' : r, images: list });
      this.saveImages(list);
    } catch (e) { wx.showToast({ title: '格式错误，请检查输入', icon: 'none' }); }
  },
  copyDecode() { wx.setClipboardData({ data: this.data.decodeResult, success: () => wx.showToast({ title: '已复制', icon: 'success' }) }); },

  decodeToImage() {
    let b64 = this.data.decodeInput.trim();
    if (!b64) return;
    let idx = b64.indexOf('base64,');
    let raw = (idx >= 0 ? b64.slice(idx + 7) : b64).replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(raw)) {
      wx.showToast({ title: '不是有效的 Base64', icon: 'none' });
      return;
    }
    if (!b64.startsWith('data:image')) b64 = 'data:image/png;base64,' + raw;
    let fname = wx.env.USER_DATA_PATH + '/dc' + Date.now() + '.jpg';
    let that = this;
    wx.getFileSystemManager().writeFile({
      filePath: fname, data: raw, encoding: 'base64',
      success: () => {
        let itemMeta = { id: Date.now(), type: 'image', path: fname, size: '', preview: '' };
        that._imageCache = [{ base64: b64, path: fname }].concat(that._imageCache).slice(0, 10);
        let list = [itemMeta].concat(that.data.images).slice(0, 20);
        that.setData({ decodeImagePath: fname, images: list });
        that.saveImages(list);
        wx.showToast({ title: '已显示', icon: 'success' });
      },
      fail: () => wx.showToast({ title: '写入失败', icon: 'none' }),
    });
  },
  previewDecodeImg() { wx.previewImage({ urls: [this.data.decodeImagePath] }); },

  _readUserFiles(callback) {
    wx.getFileSystemManager().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        let files = (res.files || []).filter(f => f.endsWith('.txt') || f.endsWith('.jpg') || f.endsWith('.png'));
        if (files.length === 0) { wx.showToast({ title: '暂无文件', icon: 'none' }); return; }
        callback(files.map(f => ({ name: f, path: wx.env.USER_DATA_PATH + '/' + f })));
      },
      fail: () => wx.showToast({ title: '无法读取目录', icon: 'none' }),
    });
  },
  browseFiles() {
    this._readUserFiles(list => this.setData({ filesList: list, filesShow: true, fileMode: '' }));
  },
  pickFileForMode(e) {
    this.setData({ fileMode: e.currentTarget.dataset.mode });
    this._readUserFiles(list => this.setData({ filesList: list, filesShow: true }));
  },
  openFile(e) {
    let idx = e.currentTarget.dataset.index;
    let f = this.data.filesList[idx];
    if (!f) return;
    let that = this;
    // 选择文件模式：读取内容填入输入框
    if (this.data.fileMode) {
      let mode = this.data.fileMode;
      wx.getFileSystemManager().readFile({
        filePath: f.path, encoding: 'utf8',
        success: (res) => {
          if (mode === 'text2code') {
            that.setData({ textContent: res.data, filesShow: false });
          } else if (mode === 'code2text' || mode === 'code2img') {
            that.setData({ decodeInput: res.data, filesShow: false });
          }
          wx.showToast({ title: '已读取', icon: 'success' });
        },
        fail: () => wx.showToast({ title: '读取失败', icon: 'none' }),
      });
      return;
    }
    // 普通模式：操作文件
    wx.showActionSheet({
      itemList: ['用其他应用打开', '转发给朋友', '取消'],
      success: (r) => {
        if (r.tapIndex === 0) {
          wx.openDocument({ filePath: f.path, showMenu: true });
        } else if (r.tapIndex === 1) {
          wx.shareFileMessage({ filePath: f.path, fileName: f.name });
        }
      },
    });
  },
  closeFiles() { this.setData({ filesShow: false, fileMode: '' }); },

  loadHistory(e) {
    let idx = e.currentTarget.dataset.index, item = this.data.images[idx];
    if (!item) return;
    // 使用缓存，避免频繁读取存储
    let ps = this._getPs();
    let p = ps.find(x => x.id === this.data.curId);
    if (item.type === 'image') {
      let full = p && p.items ? p.items.find(x => x.id === item.id) : null;
      let b64 = full ? (full.base64 || '') : '';
      this._fullCode = b64;
      this.setData({ mode: 'img2code', imagePath: item.path, codeShow: b64.slice(0, 200) + (b64.length > 200 ? '...' : ''), size: item.size || '' });
    } else {
      let full = p && p.items ? p.items.find(x => x.id === item.id) : null;
      this._fullText = full ? (full.base64 || '') : '';
      this.setData({ mode: 'text2code', textContent: full ? (full.textContent || '') : '', textResult: this._fullText.slice(0, 200) + (this._fullText.length > 200 ? '...' : '') });
    }
  },
});
