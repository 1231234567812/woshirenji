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
    textContent: '', textResult: '',
    decodeInput: '', decodeResult: '', decodeImagePath: '',
    curId: '', curName: '',
    images: [],
    filesShow: false,
    filesList: [],
    filesLoading: false,
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
    compressProgress: 0,
    compressStage: '',
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
    cropRatio: '1:1',
    cropResult: '',
    cropSize: '',
    cropping: false,
    // 图片旋转
    rotImg: '',
    rotDeg: 0,
    rotFlipH: false,
    rotFlipV: false,
    rotResult: '',
    rotating: false,
    // 颜色提取
    colorImg: '',
    colorList: [],
    colorPicking: false,
    // 图片马赛克
    mosaicImg: '',
    mosaicLevel: 8,
    mosaicResult: '',
    mosaicing: false,
    decoding: false,
  },

  _fullCode: '',
  _fullText: '',
  _fullDecode: '',
  _imageCache: [],
  _batchCodes: [],
  _projectsCache: null,
  _lastLoadTime: 0,
  _dataDirty: false,
  _fs: null,
  _batchId: 0,

  _getFs() {
    if (!this._fs) this._fs = wx.getFileSystemManager();
    return this._fs;
  },

  _previewImage(path) {
    if (path) wx.previewImage({ urls: [path], fail: () => wx.showToast({ title: '预览失败', icon: 'none' }) });
  },

  // 统一获取项目数据，优先用缓存
  _getPs() {
    if (this._projectsCache) return this._projectsCache;
    let ps = wx.getStorageSync('projects') || [];
    this._projectsCache = ps;
    return ps;
  },


  // Canvas 处理+导出（公共方法）
  // opts: { canvasId, imgSrc, imgInfo, drawW, drawH, fileType, quality, destPrefix }
  // drawFn: (ctx, canvas, img, info) => void
  // callback: (err, { path, size }) => void
  _canvasProcess(opts, drawFn, callback) {
    let that = this;
    let doProcess = function(info) {
      const query = wx.createSelectorQuery();
      query.select('#' + opts.canvasId).fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) { callback('Canvas 初始化失败'); return; }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          canvas.width = opts.drawW || info.width;
          canvas.height = opts.drawH || info.height;

          const img = canvas.createImage();
          img.onload = function() {
            try { drawFn(ctx, canvas, img, info); } catch (err) { callback('绘制失败'); return; }
            let fileType = opts.fileType || 'jpg';
            let quality = opts.quality || 0.9;
            wx.canvasToTempFilePath({
              canvas: canvas,
              fileType: fileType,
              quality: quality,
              success(r) {
                let fs = that._getFs();
                let dest = wx.env.USER_DATA_PATH + '/' + (opts.destPrefix || 'img') + '_' + Date.now() + '.' + fileType;
                fs.copyFile({
                  srcPath: r.tempFilePath, destPath: dest,
                  success() {
                    wx.getFileInfo({
                      filePath: dest,
                      success(fi) { callback(null, { path: dest, size: (fi.size / 1024).toFixed(1) + ' KB' }); },
                      fail() { callback(null, { path: dest, size: '' }); },
                    });
                  },
                  fail() { callback(null, { path: r.tempFilePath, size: '' }); },
                });
              },
              fail() { callback('导出失败'); },
            });
          };
          img.onerror = function() { callback('图片加载失败'); };
          img.src = opts.imgSrc;
        });
      };
    if (opts.imgInfo) {
      doProcess(opts.imgInfo);
    } else {
      wx.getImageInfo({
        src: opts.imgSrc,
        success: doProcess,
        fail() { callback('获取图片信息失败'); },
      });
    }
  },

  // 保存图片到相册（公共方法）
  _saveToAlbum(path) {
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

  // 分享文件（公共方法）
  _shareFile(path, fileName) {
    if (!path) return;
    wx.showActionSheet({
      itemList: ['转发给朋友', '用其他应用打开'],
      success(r) {
        if (r.tapIndex === 0) {
          wx.shareFileMessage({ filePath: path, fileName: fileName, fail: () => wx.showToast({ title: '分享失败', icon: 'none' }) });
        } else if (r.tapIndex === 1) {
          wx.openDocument({ filePath: path, showMenu: true, fail: () => wx.showToast({ title: '打开失败', icon: 'none' }) });
        }
      },
    });
  },

  // 选择图片（公共方法）
  _chooseImage(count, sizeType, onSuccess) {
    let st = Array.isArray(sizeType) ? sizeType : [sizeType];
    let onFail = (err) => { if (err && err.errMsg && err.errMsg.indexOf('cancel') < 0) wx.showToast({ title: '选择图片失败', icon: 'none' }); };
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: count, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: st, success: onSuccess, fail: onFail });
    } else {
      wx.chooseImage({ count: count, sourceType: ['album', 'camera'], sizeType: st, success: onSuccess, fail: onFail });
    }
  },

  // 从选择结果中提取临时路径（公共方法）
  _getTempPath(res) {
    let p = '';
    if (res.tempFiles && res.tempFiles[0]) p = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
    if (!p && res.tempFilePaths && res.tempFilePaths[0]) p = res.tempFilePaths[0];
    return p;
  },

  // ========== 批量转换 ==========
  chooseBatchImage() {
    if (this.data.batchConverting) return;
    let that = this;
    this._chooseImage(9, 'compressed', (res) => {
      let paths = [];
      if (res.tempFiles) {
        paths = res.tempFiles.map(f => f.tempFilePath || f.path).filter(Boolean);
      }
      if (paths.length === 0 && res.tempFilePaths) {
        paths = res.tempFilePaths.filter(Boolean);
      }
      if (paths.length === 0) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveTempImages(paths);
    });
  },

  _saveTempImages(tempPaths) {
    let that = this;
    let fs = this._getFs();
    let saved = [];
    let pending = tempPaths.length;
    tempPaths.forEach((p, idx) => {
      let ext = p.split('.').pop() || 'jpg';
      let dest = wx.env.USER_DATA_PATH + '/batch_' + Date.now() + '_' + idx + '.' + ext;
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
    let myBatchId = ++this._batchId;
    this._batchCodes = [];
    this.setData({ batchItems: [], batchConverting: true, batchProgress: '0/' + valid.length, batchTotal: valid.length });
    this._batchDone = 0;
    this._batchNextSlot = 0;
    this._batchImgStart = this.data.images.length;
    // 并行处理，每次最多3个
    this._batchConvertParallel(valid, 0, myBatchId);
  },

  _batchConvertParallel(paths, startIdx, myBatchId) {
    if (!this.data.batchConverting || this._batchId !== myBatchId) return;
    let that = this;
    let concurrency = 3;
    let endIdx = Math.min(startIdx + concurrency, paths.length);

    for (let i = startIdx; i < endIdx; i++) {
      this._batchConvertOne(paths, i, myBatchId, function() {
        if (that._batchId !== myBatchId) return;
        that._batchDone++;
        that.setData({ batchProgress: that._batchDone + '/' + paths.length });
        if (that._batchDone >= paths.length && that.data.batchConverting) {
          let sliced = that.data.images.slice(0, 20);
          that._imageCache = that._imageCache.slice(0, 20);
          that.setData({ batchConverting: false, batchProgress: '全部完成', images: sliced });
          that.saveImages(sliced);
          wx.showToast({ title: '转换完成', icon: 'success' });
          setTimeout(function() { that.setData({ batchProgress: '' }); }, 3000);
        }
      });
    }
    if (endIdx < paths.length) {
      setTimeout(function() { that._batchConvertParallel(paths, endIdx, myBatchId); }, 100);
    }
  },

  _batchConvertOne(paths, idx, myBatchId, onDone) {
    if (!this.data.batchConverting || this._batchId !== myBatchId) return;
    let that = this;
    this._getFs().readFile({
      filePath: paths[idx],
      encoding: 'base64',
      success(res) {
        if (that._batchId !== myBatchId) return;
        let ext = paths[idx].split('.').pop().toLowerCase();
        let mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));
        let b64 = 'data:' + mime + ';base64,' + res.data;
        let kb = (res.data.length * 0.75 / 1024).toFixed(1);
        that._batchCodes.push(b64);

        let slot = that._batchNextSlot++;
        let imgIdx = that._batchImgStart + idx;
        let item = { id: Date.now() + idx, path: paths[idx], size: kb + ' KB', code: b64.slice(0, 80) + '...', fullCode: b64 };
        let itemMeta = { id: item.id, type: 'image', path: paths[idx], size: kb + ' KB', preview: '' };

        let setDataObj = { ['batchItems[' + slot + ']']: item };
        if (imgIdx < 20) {
          setDataObj['images[' + imgIdx + ']'] = itemMeta;
          that._imageCache[imgIdx] = { base64: b64, textContent: '' };
        }
        that.setData(setDataObj);
        onDone();
      },
      fail() {
        if (that._batchId !== myBatchId) return;
        let slot = that._batchNextSlot++;
        let imgIdx = that._batchImgStart + idx;
        if (imgIdx < 20) that._imageCache[imgIdx] = { base64: '', textContent: '' };
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
    let data = item.fullCode;
    if (data.length <= 80000) {
      wx.setClipboardData({ data: data, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
    } else {
      let wan = (data.length / 10000).toFixed(1);
      wx.setClipboardData({ data: data.slice(0, 80000), success: () => wx.showToast({ title: '数据过长（约' + wan + '万字符），已复制前8万字符', icon: 'none', duration: 3000 }) });
    }
  },

  copyAllBatch() {
    if (this._batchCodes.length === 0) return;
    let all = this._batchCodes.join('\n');
    if (all.length <= 80000) {
      wx.setClipboardData({ data: all, success: () => wx.showToast({ title: '已复制全部 ' + this._batchCodes.length + ' 条', icon: 'success' }) });
    } else {
      let copied = 0, len = 0;
      for (let i = 0; i < this._batchCodes.length; i++) {
        if (len + this._batchCodes[i].length + 1 > 80000 && copied > 0) break;
        len += this._batchCodes[i].length + 1;
        copied++;
      }
      wx.setClipboardData({ data: all.slice(0, len), success: () => wx.showToast({ title: '已复制前 ' + copied + ' 条，共 ' + this._batchCodes.length + ' 条', icon: 'none', duration: 3000 }) });
    }
  },

  saveAllBatch() {
    if (this._batchCodes.length === 0) return;
    let that = this;
    wx.showModal({
      title: '批量保存', editable: true, placeholderText: '输入文件名前缀',
      success(res) {
        if (!res.confirm) return;
        let prefix = (res.content || 'batch').replace(/[:"<>|?*\n\r\\/]/g, '-').slice(0, 30);
        let fs = that._getFs();
        let ok = 0, fail = 0, total = that._batchCodes.length;
        let showResult = function() {
          let msg = fail > 0 ? '已保存 ' + ok + ' 个，失败 ' + fail + ' 个' : '已保存 ' + ok + ' 个文件';
          wx.showToast({ title: msg, icon: fail > 0 ? 'none' : 'success', duration: 2000 });
          if (ok > 0) {
            setTimeout(function() {
              wx.showActionSheet({
                itemList: ['浏览保存目录'],
                success: function(r) { if (r.tapIndex === 0) that.browseFiles(); },
              });
            }, 2200);
          }
        };
        that._batchCodes.forEach((code, i) => {
          let fname = wx.env.USER_DATA_PATH + '/' + prefix + '_' + (i + 1) + '.txt';
          fs.writeFile({
            filePath: fname, data: code, encoding: 'utf8',
            success() { ok++; if (ok + fail === total) showResult(); },
            fail() { fail++; if (ok + fail === total) showResult(); },
          });
        });
      },
    });
  },

  clearBatch() {
    if (this._batchCodes.length === 0) return;
    wx.showModal({
      title: '清空', content: '确定清空所有批量转换结果？',
      success: (res) => {
        if (res.confirm) {
          this._batchId++;
          this._batchCodes = [];
          this.setData({ batchItems: [], batchConverting: false, batchProgress: '', batchTotal: 0 });
        }
      },
    });
  },

  // ========== 二维码生成 ==========
  onQrInput(e) { this.setData({ qrInput: e.detail.value }); },
  setQrEc(e) { this.setData({ qrEcLevel: e.currentTarget.dataset.ec }); },

  generateQR() {
    if (this.data.qrGenerating) return;
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
      var fs = that._getFs();
      var dest = wx.env.USER_DATA_PATH + '/qr_' + Date.now() + '.png';
      fs.copyFile({
        srcPath: path, destPath: dest,
        success: function() {
          var itemMeta = { id: Date.now(), type: 'image', path: dest, size: '二维码', preview: text.slice(0, 30) };
          that._imageCache = [{ base64: '', textContent: 'QR:' + text }].concat(that._imageCache).slice(0, 20);
          var list = [itemMeta].concat(that.data.images).slice(0, 20);
          that.setData({ images: list });
          that.saveImages(list);
          wx.showToast({ title: '已生成', icon: 'success' });
        },
        fail: function() { wx.showToast({ title: '已生成，但历史保存失败', icon: 'none' }); }
      });
    });
  },

  saveQrImage() { this._saveToAlbum(this.data.qrImagePath); },

  shareQrImage() { this._shareFile(this.data.qrImagePath, 'qrcode.png'); },

  previewQrImage() { this._previewImage(this.data.qrImagePath); },

  // ========== 一键复制（历史记录中的单条） ==========
  copyHistoryCode(e) {
    let idx = e.currentTarget.dataset.index;
    let item = this.data.images[idx];
    if (!item) return;
    // 使用缓存，避免频繁读取存储
    let ps = this._getPs();
    let p = ps.find(x => x.id === this.data.curId);
    let full = p && p.items ? p.items.find(x => x.id === item.id) : null;
    let code = full ? (full.subtype === 'decode' ? (full.textContent || '') : (full.base64 || '')) : '';
    if (!code) { wx.showToast({ title: '无数据', icon: 'none' }); return; }
    if (code.length <= 80000) {
      wx.setClipboardData({ data: code, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
    } else {
      let wan = (code.length / 10000).toFixed(1);
      wx.setClipboardData({ data: code.slice(0, 80000), success: () => wx.showToast({ title: '数据过长（约' + wan + '万字符），已复制前8万字符', icon: 'none', duration: 3000 }) });
    }
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
        this._imageCache = (p.items || []).map(item => ({ base64: item.base64 || '', textContent: item.textContent || '' }));
        this._fullCode = ''; this._fullText = ''; this._fullDecode = '';
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
        if (res.confirm && res.content && res.content.trim()) {
          let ps = this._getPs();
          let newProj = { id: 'p_' + Date.now(), name: res.content.trim(), date: new Date().toLocaleString(), items: [] };
          // 拷贝数组，避免存储失败时污染缓存
          let psCopy = [newProj].concat(ps);
          try { wx.setStorageSync('projects', psCopy); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); return; }
          this._projectsCache = psCopy;
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
    this._imageCache = (p.items || []).map(item => ({ base64: item.base64 || '', textContent: item.textContent || '' }));
    this._fullCode = ''; this._fullText = ''; this._fullDecode = '';
    this.setData({
      view: 'work', curId: id, curName: p.name,
      images: (p.items || []).map(img => ({ id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview })),
      mode: '',
    });
  },

  delProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除', content: '确定删除？(删除后可在项目页恢复)',
      success: (res) => {
        if (res.confirm) {
          let ps = this._getPs();
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) {
            ps[i].deleted = true;
            try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '操作失败', icon: 'none' }); return; }
            this._projectsCache = ps; // 存储成功后才更新缓存
            // 局部更新，避免全量重载
            let newList = this.data.projects.filter(item => item.id !== id);
            this.setData({ projects: newList });
          }
        }
      },
    });
  },

  goBack() {
    wx.setNavigationBarTitle({ title: 'Base64 工具箱' });
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
      // 拷贝数组，避免存储失败时污染缓存
      let psCopy = ps.slice();
      psCopy[i] = { ...ps[i], items: (target || []).map((img, idx) => {
        let full = (this._imageCache && this._imageCache[idx]) ? this._imageCache[idx] : {};
        return { ...img, base64: full.base64 || '', textContent: full.textContent || '' };
      })};
      this._dataDirty = true;
      try { wx.setStorageSync('projects', psCopy); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); return; }
      this._projectsCache = psCopy;
    }
  },

  showMenu() { this.setData({ menuShow: true }); },
  hideMenu() { this.setData({ menuShow: false }); },
  reset(m) {
    this._batchId++;
    this._fullCode = ''; this._fullText = ''; this._fullDecode = '';
    let d = { menuShow: false, mode: m, imagePath: '', codeShow: '', size: '', converting: false, convertProgress: 0, convertStage: '' };
    if (m === 'text2code' || m === 'code2text' || m === 'code2img') {
      d.textContent = ''; d.textResult = ''; d.decodeInput = ''; d.decodeResult = ''; d.decodeImagePath = ''; d.decoding = false;
    } else if (m === 'batch') {
      d.batchItems = []; d.batchConverting = false; d.batchProgress = ''; d.batchTotal = 0;
    } else if (m === 'qrcode') {
      d.qrInput = ''; d.qrImagePath = ''; d.qrGenerating = false; d.qrEcLevel = 'M';
    } else if (m === 'compress') {
      d.compressImagePath = ''; d.compressOrigSize = ''; d.compressNewSize = ''; d.compressRatio = ''; d.compressResultPath = ''; d.compressing = false; d.compressProgress = 0; d.compressStage = ''; d.compressQualityLevel = 60;
    } else if (m === 'watermark') {
      d.wmImagePath = ''; d.wmText = ''; d.wmPosition = 'bottom-right'; d.wmColor = '#ffffff'; d.wmOpacity = 60; d.wmFontSize = 32; d.wmResultPath = ''; d.wmProcessing = false;
    } else if (m === 'fmt') {
      d.fmtImg = ''; d.fmtFrom = ''; d.fmtTo = 'png'; d.fmtResult = ''; d.fmtSize = ''; d.fmtConverting = false;
    } else if (m === 'resize') {
      d.resizeImg = ''; d.resizeW = 0; d.resizeH = 0; d.resizeNewW = 0; d.resizeNewH = 0; d.resizeRatio = true; d.resizeResult = ''; d.resizeSize = ''; d.resizing = false;
    } else if (m === 'crop') {
      d.cropImg = ''; d.cropW = 0; d.cropH = 0; d.cropRatio = '1:1'; d.cropResult = ''; d.cropSize = ''; d.cropping = false;
    } else if (m === 'rotate') {
      d.rotImg = ''; d.rotDeg = 0; d.rotFlipH = false; d.rotFlipV = false; d.rotResult = ''; d.rotating = false;
    } else if (m === 'color') {
      d.colorImg = ''; d.colorList = []; d.colorPicking = false;
    } else if (m === 'mosaic') {
      d.mosaicImg = ''; d.mosaicLevel = 8; d.mosaicResult = ''; d.mosaicing = false;
    }
    this.setData(d);
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
  startColor() { this.reset('color'); },
  startMosaic() { this.reset('mosaic'); },

  // ========== 图片压缩 ==========
  chooseCompressImage() {
    let that = this;
    this._chooseImage(1, 'original', (res) => {
      let tempPath = this._getTempPath(res);
      if (!tempPath) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(tempPath, 'compress', (p) => { if (p) that._onCompressImagePicked(p); });
    });
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
    if (this.data.compressing) return;
    let that = this;
    let src = this.data.compressImagePath;
    if (!src) return;
    this.setData({ compressing: true, compressProgress: 10, compressStage: '准备中...' });
    wx.showNavigationBarLoading();

    wx.compressImage({
      src: src,
      quality: this.data.compressQualityLevel,
      success(res) {
        that.setData({ compressProgress: 40, compressStage: '压缩完成，获取信息...' });
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
          let ratioNum = Number(ratio);
          let stageText = ratioNum >= 0 ? '完成！减小 ' + ratio + '%' : '完成！增大 ' + (-ratioNum) + '%';

          that.setData({ compressProgress: 70, compressStage: '保存中...' });
          // 保存压缩结果
          let fs = that._getFs();
          let dest = wx.env.USER_DATA_PATH + '/compressed_' + Date.now() + '.jpg';
          let doneData = { compressing: false, compressProgress: 100, compressStage: stageText, compressNewSize: newSizeStr, compressRatio: ratio };
          fs.copyFile({
            srcPath: compressedPath, destPath: dest,
            success() {
              that.setData({ ...doneData, compressResultPath: dest });
              wx.hideNavigationBarLoading();
              wx.showToast({ title: '压缩完成', icon: 'success' });
              setTimeout(() => { that.setData({ compressProgress: 0, compressStage: '' }); }, 800);
            },
            fail() {
              that.setData({ ...doneData, compressResultPath: compressedPath });
              wx.hideNavigationBarLoading();
              wx.showToast({ title: '保存失败，结果仅本次可用', icon: 'none' });
              setTimeout(() => { that.setData({ compressProgress: 0, compressStage: '' }); }, 800);
            },
          });
        }).catch(() => {
          that.setData({ compressing: false, compressProgress: 0, compressStage: '' });
          wx.hideNavigationBarLoading();
          wx.showToast({ title: '获取压缩结果失败', icon: 'none' });
        });
      },
      fail() {
        that.setData({ compressing: false, compressProgress: 0, compressStage: '' });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '压缩失败', icon: 'none' });
      },
    });
  },

  saveCompressedImage() { this._saveToAlbum(this.data.compressResultPath); },

  shareCompressedImage() {
    let p = this.data.compressResultPath;
    let ext = p ? p.split('.').pop() : 'jpg';
    this._shareFile(p, 'compressed.' + ext);
  },

  previewCompressResult() { this._previewImage(this.data.compressResultPath || this.data.compressImagePath); },

  // ========== 图片加水印 ==========
  chooseWmImage() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let tempPath = this._getTempPath(res);
      if (!tempPath) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(tempPath, 'wm', (p) => { if (p) that.setData({ wmImagePath: p, wmResultPath: '' }); });
    });
  },

  onWmTextInput(e) { this.setData({ wmText: e.detail.value }); },
  setWmPosition(e) { this.setData({ wmPosition: e.currentTarget.dataset.pos }); },
  setWmColor(e) { this.setData({ wmColor: e.currentTarget.dataset.color }); },
  onWmOpacityChange(e) { this.setData({ wmOpacity: e.detail.value }); },
  onWmFontSizeChange(e) { this.setData({ wmFontSize: e.detail.value }); },

  addWatermark() {
    if (this.data.wmProcessing) return;
    let that = this;
    let { wmImagePath, wmText, wmPosition, wmColor, wmOpacity, wmFontSize } = this.data;
    if (!wmImagePath) return;
    if (!wmText || !wmText.trim()) { wx.showToast({ title: '请输入水印文字', icon: 'none' }); return; }

    this.setData({ wmProcessing: true });
    wx.showNavigationBarLoading();

    let srcExt = wmImagePath.split('.').pop().toLowerCase();
    let fileType = srcExt === 'png' ? 'png' : 'jpg';

    this._canvasProcess({
      canvasId: 'wmCanvas',
      imgSrc: wmImagePath,
      fileType: fileType,
      quality: 0.9,
      destPrefix: 'wm_result',
    }, function(ctx, canvas, img, info) {
      let imgWidth = info.width, imgHeight = info.height;
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      let x = 0, y = 0, textAlign = 'left', textBaseline = 'top', padding = 20;
      let fontSize = Math.max(8, Math.min(wmFontSize * (imgWidth / 750), 200));

      switch (wmPosition) {
        case 'top-left': x = padding; y = padding; break;
        case 'top-right': x = imgWidth - padding; y = padding; textAlign = 'right'; break;
        case 'center': x = imgWidth / 2; y = imgHeight / 2; textAlign = 'center'; textBaseline = 'middle'; break;
        case 'bottom-left': x = padding; y = imgHeight - padding; textBaseline = 'bottom'; break;
        case 'bottom-right': x = imgWidth - padding; y = imgHeight - padding; textAlign = 'right'; textBaseline = 'bottom'; break;
      }

      ctx.font = 'bold ' + fontSize + 'px sans-serif';
      ctx.textAlign = textAlign;
      ctx.textBaseline = textBaseline;

      // 阴影增强可读性
      ctx.fillStyle = 'rgba(0, 0, 0, ' + (wmOpacity / 100 * 0.5) + ')';
      ctx.fillText(wmText, x + 2, y + 2);

      ctx.fillStyle = wmColor;
      ctx.globalAlpha = wmOpacity / 100;
      ctx.fillText(wmText, x, y);
      ctx.globalAlpha = 1;
    }, function(err, result) {
      that.setData({ wmProcessing: false });
      wx.hideNavigationBarLoading();
      if (err) {
        wx.showToast({ title: err, icon: 'none' });
      } else {
        that.setData({ wmResultPath: result.path });
        wx.showToast({ title: '水印添加成功', icon: 'success' });
      }
    });
  },

  saveWmImage() { this._saveToAlbum(this.data.wmResultPath); },

  shareWmImage() {
    let p = this.data.wmResultPath;
    let ext = p ? p.split('.').pop() : 'jpg';
    this._shareFile(p, 'watermark.' + ext);
  },

  previewWmResult() { this._previewImage(this.data.wmResultPath || this.data.wmImagePath); },

  // ========== 图片格式转换 ==========
  chooseFmtImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(p, 'fmt', (dest) => {
        if (!dest) return;
        let ext = dest.split('.').pop().toLowerCase();
        let from = 'jpg';
        if (ext === 'png') from = 'png';
        else if (ext === 'webp') from = 'webp';
        that.setData({ fmtImg: dest, fmtFrom: from, fmtTo: from === 'png' ? 'jpg' : 'png', fmtResult: '', fmtSize: '' });
      });
    });
  },

  setFmtTo(e) { this.setData({ fmtTo: e.currentTarget.dataset.fmt }); },

  doFmtConvert() {
    if (this.data.fmtConverting) return;
    let that = this;
    let { fmtImg, fmtTo } = this.data;
    if (!fmtImg) return;
    this.setData({ fmtConverting: true });
    wx.showNavigationBarLoading();

    that._canvasProcess({
      canvasId: 'fmtCanvas',
      imgSrc: fmtImg,
      fileType: fmtTo === 'jpg' ? 'jpg' : 'png',
      quality: fmtTo === 'jpg' ? 0.9 : undefined,
      destPrefix: 'fmt',
    }, function(ctx, canvas, img, info) {
      ctx.drawImage(img, 0, 0, info.width, info.height);
    }, function(err, result) {
      that.setData({ fmtConverting: false });
      wx.hideNavigationBarLoading();
      if (err) { wx.showToast({ title: err, icon: 'none' }); return; }
      that.setData({ fmtResult: result.path, fmtSize: result.size });
      wx.showToast({ title: '转换完成', icon: 'success' });
    });
  },

  saveFmtImg() { this._saveToAlbum(this.data.fmtResult); },

  shareFmtImg() { this._shareFile(this.data.fmtResult, 'converted.' + this.data.fmtTo); },

  previewFmtResult() { this._previewImage(this.data.fmtResult || this.data.fmtImg); },
  // ========== 图片尺寸调整 ==========
  chooseResizeImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(p, 'resize', (dest) => {
        if (!dest) return;
        wx.getImageInfo({
          src: dest,
          success(info) {
            that.setData({
              resizeImg: dest, resizeW: info.width, resizeH: info.height,
              resizeNewW: info.width, resizeNewH: info.height,
              resizeResult: '', resizeSize: '',
            });
          },
          fail() {
            that.setData({ resizeImg: dest, resizeW: 0, resizeH: 0, resizeNewW: 0, resizeNewH: 0, resizeResult: '', resizeSize: '' });
          },
        });
      });
    });
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

  toggleResizeRatio() {
    let newRatio = !this.data.resizeRatio;
    if (newRatio && this.data.resizeW > 0 && this.data.resizeH > 0) {
      // 重新锁定时以当前宽度为基准同步高度
      let w = this.data.resizeNewW;
      let h = Math.round(w * this.data.resizeH / this.data.resizeW);
      this.setData({ resizeRatio: true, resizeNewH: h });
    } else {
      this.setData({ resizeRatio: newRatio });
    }
  },

  doResize() {
    if (this.data.resizing) return;
    let that = this;
    let { resizeImg, resizeNewW, resizeNewH } = this.data;
    if (!resizeImg || resizeNewW <= 0 || resizeNewH <= 0) return;
    if (resizeNewW > 4096 || resizeNewH > 4096) { wx.showToast({ title: '尺寸不能超过4096像素', icon: 'none' }); return; }
    this.setData({ resizing: true });
    wx.showNavigationBarLoading();

    let srcExt = resizeImg.split('.').pop().toLowerCase();
    let fileType = srcExt === 'png' ? 'png' : 'jpg';
    this._canvasProcess({
      canvasId: 'resizeCanvas',
      imgSrc: resizeImg,
      drawW: resizeNewW,
      drawH: resizeNewH,
      fileType: fileType,
      quality: 0.9,
      destPrefix: 'resize',
    }, function(ctx, canvas, img) {
      ctx.drawImage(img, 0, 0, resizeNewW, resizeNewH);
    }, function(err, result) {
      that.setData({ resizing: false });
      wx.hideNavigationBarLoading();
      if (err) { wx.showToast({ title: err, icon: 'none' }); return; }
      that.setData({ resizeResult: result.path, resizeSize: result.size });
      wx.showToast({ title: '调整完成', icon: 'success' });
    });
  },

  saveResizeImg() { this._saveToAlbum(this.data.resizeResult); },

  shareResizeImg() {
    let p = this.data.resizeResult;
    let ext = p ? p.split('.').pop() : 'jpg';
    this._shareFile(p, 'resized.' + ext);
  },

  previewResizeResult() { this._previewImage(this.data.resizeResult || this.data.resizeImg); },

  // ========== 图片裁剪 ==========
  chooseCropImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(p, 'crop', (dest) => {
        if (!dest) return;
        wx.getImageInfo({
          src: dest,
          success(info) {
            that.setData({ cropImg: dest, cropW: info.width, cropH: info.height, cropResult: '', cropSize: '' });
          },
          fail() {
            that.setData({ cropImg: dest, cropW: 0, cropH: 0, cropResult: '', cropSize: '' });
            wx.showToast({ title: '获取图片尺寸失败', icon: 'none' });
          },
        });
      });
    });
  },

  setCropRatio(e) { this.setData({ cropRatio: e.currentTarget.dataset.ratio }); },

  doCrop() {
    if (this.data.cropping) return;
    let that = this;
    let { cropImg, cropW, cropH, cropRatio } = this.data;
    if (!cropImg || cropW <= 0 || cropH <= 0) { wx.showToast({ title: '请先选择图片', icon: 'none' }); return; }

    // 计算裁剪区域（居中裁剪）
    let sx = 0, sy = 0, sw = cropW, sh = cropH;
    if (cropRatio === '1:1') {
      let side = Math.min(cropW, cropH);
      sx = Math.floor((cropW - side) / 2);
      sy = Math.floor((cropH - side) / 2);
      sw = side; sh = side;
    } else if (cropRatio === '4:3') {
      let targetW = cropW;
      let targetH = Math.max(1, Math.floor(cropW * 3 / 4));
      if (targetH > cropH) {
        targetH = cropH;
        targetW = Math.max(1, Math.floor(cropH * 4 / 3));
      }
      sx = Math.floor((cropW - targetW) / 2);
      sy = Math.floor((cropH - targetH) / 2);
      sw = targetW; sh = targetH;
    } else if (cropRatio === '16:9') {
      let targetW = cropW;
      let targetH = Math.max(1, Math.floor(cropW * 9 / 16));
      if (targetH > cropH) {
        targetH = cropH;
        targetW = Math.max(1, Math.floor(cropH * 16 / 9));
      }
      sx = Math.floor((cropW - targetW) / 2);
      sy = Math.floor((cropH - targetH) / 2);
      sw = targetW; sh = targetH;
    }

    this.setData({ cropping: true });
    wx.showNavigationBarLoading();

    let srcExt = cropImg.split('.').pop().toLowerCase();
    let outExt = srcExt === 'png' ? 'png' : 'jpg';
    this._canvasProcess({
      canvasId: 'cropCanvas',
      imgSrc: cropImg,
      imgInfo: { width: cropW, height: cropH },
      drawW: sw, drawH: sh,
      fileType: outExt,
      destPrefix: 'crop',
    }, function(ctx, canvas, img) {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    }, function(err, result) {
      that.setData({ cropping: false });
      wx.hideNavigationBarLoading();
      if (err) {
        wx.showToast({ title: err, icon: 'none' });
      } else {
        that.setData({ cropResult: result.path, cropSize: result.size });
        wx.showToast({ title: '裁剪完成', icon: 'success' });
      }
    });
  },

  saveCropImg() { this._saveToAlbum(this.data.cropResult); },

  shareCropImg() {
    let p = this.data.cropResult;
    let ext = p ? p.split('.').pop() : 'jpg';
    this._shareFile(p, 'cropped.' + ext);
  },

  previewCropResult() { this._previewImage(this.data.cropResult || this.data.cropImg); },

  // ========== 图片旋转 ==========
  chooseRotImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(p, 'rot', (dest) => {
        if (!dest) return;
        that.setData({ rotImg: dest, rotDeg: 0, rotFlipH: false, rotFlipV: false, rotResult: '' });
      });
    });
  },

  rotLeft() { this.setData({ rotDeg: (this.data.rotDeg + 270) % 360 }); },
  rotRight() { this.setData({ rotDeg: (this.data.rotDeg + 90) % 360 }); },
  rotFlipH() { this.setData({ rotFlipH: !this.data.rotFlipH }); },
  rotFlipV() { this.setData({ rotFlipV: !this.data.rotFlipV }); },

  doRotate() {
    if (this.data.rotating) return;
    let that = this;
    let { rotImg, rotDeg, rotFlipH, rotFlipV } = this.data;
    if (!rotImg) return;
    if (rotDeg === 0 && !rotFlipH && !rotFlipV) { wx.showToast({ title: '未做任何变换', icon: 'none' }); return; }

    this.setData({ rotating: true });
    wx.showNavigationBarLoading();

    let srcExt = rotImg.split('.').pop().toLowerCase();
    let fileType = srcExt === 'png' ? 'png' : 'jpg';
    let isRightAngle = (rotDeg === 90 || rotDeg === 270);

    wx.getImageInfo({
      src: rotImg,
      success(info) {
        let iw = info.width, ih = info.height;
        let cw = isRightAngle ? ih : iw;
        let ch = isRightAngle ? iw : ih;

        that._canvasProcess({
          canvasId: 'rotCanvas',
          imgSrc: rotImg,
          imgInfo: info,
          drawW: cw,
          drawH: ch,
          fileType: fileType,
          destPrefix: 'rot',
        }, function(ctx, canvas, img) {
          ctx.save();
          ctx.translate(cw / 2, ch / 2);
          ctx.rotate(rotDeg * Math.PI / 180);
          if (rotFlipH) ctx.scale(-1, 1);
          if (rotFlipV) ctx.scale(1, -1);
          ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
          ctx.restore();
        }, function(err, result) {
          that.setData({ rotating: false });
          wx.hideNavigationBarLoading();
          if (err) {
            wx.showToast({ title: err, icon: 'none' });
          } else {
            that.setData({ rotResult: result.path });
            wx.showToast({ title: '旋转完成', icon: 'success' });
          }
        });
      },
      fail() {
        that.setData({ rotating: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '获取图片信息失败', icon: 'none' });
      },
    });
  },

  saveRotImg() { this._saveToAlbum(this.data.rotResult); },

  shareRotImg() {
    let p = this.data.rotResult;
    let ext = p ? p.split('.').pop() : 'jpg';
    this._shareFile(p, 'rotated.' + ext);
  },

  previewRotResult() { this._previewImage(this.data.rotResult || this.data.rotImg); },

  // ========== 颜色提取 ==========
  chooseColorImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(p, 'color', (dest) => {
        if (!dest) return;
        that.setData({ colorImg: dest, colorList: [] });
        that._extractColors(dest);
      });
    });
  },

  _extractColors(imgPath) {
    let that = this;
    this.setData({ colorPicking: true });
    wx.showNavigationBarLoading();

    wx.getImageInfo({
      src: imgPath,
      success(info) {
        // 保持宽高比缩小到 ~50px 加速采样
        let maxSide = Math.max(info.width, info.height);
        let scale = 50 / maxSide;
        let sw = Math.max(1, Math.round(info.width * scale));
        let sh = Math.max(1, Math.round(info.height * scale));
        const query = wx.createSelectorQuery();
        query.select('#colorCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            that.setData({ colorPicking: false });
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
            ctx.drawImage(img, 0, 0, sw, sh);
            let imgData = ctx.getImageData(0, 0, sw, sh);
            let pixels = imgData.data;
            let colors = that._clusterColors(pixels, 8);
            that.setData({ colorList: colors, colorPicking: false });
            wx.hideNavigationBarLoading();
          };
          img.onerror = function() {
            that.setData({ colorPicking: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: '图片加载失败', icon: 'none' });
          };
          img.src = imgPath;
        });
      },
      fail() {
        that.setData({ colorPicking: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '获取图片信息失败', icon: 'none' });
      },
    });
  },

  _clusterColors(pixels, count) {
    // 简单量化：将颜色空间划分为桶，取最常见的
    let buckets = {};
    let total = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i+3] < 128) continue; // 跳过透明像素
      total++;
      let r = Math.round(pixels[i] / 16) * 16;
      let g = Math.round(pixels[i+1] / 16) * 16;
      let b = Math.round(pixels[i+2] / 16) * 16;
      let key = r + ',' + g + ',' + b;
      if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
      buckets[key].r += pixels[i];
      buckets[key].g += pixels[i+1];
      buckets[key].b += pixels[i+2];
      buckets[key].count++;
    }
    let sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
    // 取更多候选，合并视觉上相近的颜色后返回 count 个
    let candidates = sorted.slice(0, count * 3);
    let merged = [];
    for (let i = 0; i < candidates.length; i++) {
      let c = candidates[i];
      let cr = Math.round(c.r / c.count), cg = Math.round(c.g / c.count), cb = Math.round(c.b / c.count);
      let similar = false;
      for (let j = 0; j < merged.length; j++) {
        let dr = cr - merged[j].r, dg = cg - merged[j].g, db = cb - merged[j].b;
        if (dr * dr + dg * dg + db * db < 900) { // RGB距离 < 30
          merged[j].r = Math.round((merged[j].r * merged[j].count + c.r) / (merged[j].count + c.count));
          merged[j].g = Math.round((merged[j].g * merged[j].count + c.g) / (merged[j].count + c.count));
          merged[j].b = Math.round((merged[j].b * merged[j].count + c.b) / (merged[j].count + c.count));
          merged[j].count += c.count;
          similar = true;
          break;
        }
      }
      if (!similar) merged.push({ r: cr, g: cg, b: cb, count: c.count });
      if (merged.length >= count) break;
    }
    return merged.map((c, i) => {
      let hex = '#' + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1).toUpperCase();
      let pct = total > 0 ? (c.count / total * 100).toFixed(1) : '0.0';
      return { hex: hex, r: c.r, g: c.g, b: c.b, pct: pct, id: i };
    });
  },

  copyColorHex(e) {
    let hex = e.currentTarget.dataset.hex;
    wx.setClipboardData({ data: hex, success: () => wx.showToast({ title: '已复制 ' + hex, icon: 'success' }) });
  },

  copyAllColors() {
    let list = this.data.colorList;
    if (!list || !list.length) return;
    let all = list.map(c => c.hex).join(', ');
    wx.setClipboardData({ data: all, success: () => wx.showToast({ title: '已复制 ' + list.length + ' 个颜色', icon: 'success' }) });
  },

  previewColorImg() { this._previewImage(this.data.colorImg); },

  // ========== 图片马赛克 ==========
  chooseMosaicImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveToTempFile(p, 'mosaic', (dest) => {
        if (!dest) return;
        that.setData({ mosaicImg: dest, mosaicResult: '' });
      });
    });
  },

  setMosaicLevel(e) { this.setData({ mosaicLevel: Number(e.currentTarget.dataset.level) }); },

  doMosaic() {
    if (this.data.mosaicing) return;
    let that = this;
    let { mosaicImg, mosaicLevel } = this.data;
    if (!mosaicImg) return;

    this.setData({ mosaicing: true });
    wx.showNavigationBarLoading();

    let srcExt = mosaicImg.split('.').pop().toLowerCase();
    let outExt = srcExt === 'png' ? 'png' : 'jpg';
    this._canvasProcess({
      canvasId: 'mosaicCanvas',
      imgSrc: mosaicImg,
      fileType: outExt,
      destPrefix: 'mosaic',
    }, function(ctx, canvas, img, info) {
      let iw = info.width, ih = info.height;
      let sw = Math.max(1, Math.floor(iw / mosaicLevel));
      let sh = Math.max(1, Math.floor(ih / mosaicLevel));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, sw, sh);
      ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, iw, ih);
    }, function(err, result) {
      that.setData({ mosaicing: false });
      wx.hideNavigationBarLoading();
      if (err) {
        wx.showToast({ title: err, icon: 'none' });
      } else {
        that.setData({ mosaicResult: result.path });
        wx.showToast({ title: '马赛克完成', icon: 'success' });
      }
    });
  },

  saveMosaicImg() { this._saveToAlbum(this.data.mosaicResult); },

  shareMosaicImg() {
    let p = this.data.mosaicResult;
    let ext = p ? p.split('.').pop() : 'jpg';
    this._shareFile(p, 'mosaic.' + ext);
  },

  previewMosaicResult() { this._previewImage(this.data.mosaicResult || this.data.mosaicImg); },

  quickAction(e) {
    let mode = e.currentTarget.dataset.mode;
    if (!this.data.curId) {
      // 使用缓存，避免频繁读取存储
      let ps = this._getPs();
      // 复用已有的未删除"快速项目"，避免重复创建
      let existing = ps.find(p => p.name === '快速项目' && !p.deleted);
      if (existing) {
        this._imageCache = (existing.items || []).map(item => ({ base64: item.base64 || '', textContent: item.textContent || '' }));
        this._fullCode = ''; this._fullText = ''; this._fullDecode = '';
        this.setData({ view: 'work', curId: existing.id, curName: existing.name, images: (existing.items || []).map(img => ({ id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview })) });
      } else {
        let p = { id: 'p_' + Date.now(), name: '快速项目', date: new Date().toLocaleString(), items: [] };
        ps.unshift(p);
        try { wx.setStorageSync('projects', ps); } catch (err) { wx.showToast({ title: '存储空间不足', icon: 'none' }); return; }
        this._projectsCache = ps;
        this.setData({ view: 'work', curId: p.id, curName: p.name, images: [] });
      }
    } else {
      this.setData({ view: 'work' });
    }
    this.reset(mode);
  },

  _onImagePicked(tempPath) {
    this._fullCode = '';
    this.setData({ imagePath: tempPath, codeShow: '', size: '' });
  },

  _saveToTempFile(tempPath, prefix, callback) {
    if (!tempPath) { wx.showToast({ title: '图片路径无效', icon: 'none' }); callback(null); return; }
    let fs = this._getFs();
    let ext = tempPath.split('.').pop().toLowerCase();
    if (['png', 'webp', 'gif'].indexOf(ext) < 0) ext = 'jpg';
    let dest = wx.env.USER_DATA_PATH + '/' + prefix + '_' + Date.now() + '.' + ext;
    fs.copyFile({
      srcPath: tempPath, destPath: dest,
      success: () => callback(dest),
      fail: () => {
        fs.saveFile({
          tempFilePath: tempPath,
          success: (res) => callback(res.savedFilePath),
          fail: () => { wx.showToast({ title: '图片保存失败', icon: 'none' }); callback(null); },
        });
      },
    });
  },

  _saveTempImage(tempPath) {
    this._saveToTempFile(tempPath, 'img', (dest) => { if (dest) this._onImagePicked(dest); });
  },

  chooseImage() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '获取图片失败', icon: 'none' }); return; }
      that._saveTempImage(p);
    });
  },

  setQuality(e) {
    this.setData({ compressQuality: Number(e.currentTarget.dataset.q) });
  },

  convertImage() {
    if (this.data.converting) return;
    let that = this;
    let src = this.data.imagePath;
    if (!src) return;

    // 合并初始状态更新，减少setData调用
    this.setData({ converting: true, convertProgress: 5, convertStage: '' });
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
                that.setData({ convertProgress: 40, convertStage: '压缩完成，减小 ' + ratio + '%' });
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

    this._getFs().readFile({
      filePath: filePath, encoding: 'base64',
      success(res) {
        let ext = filePath.split('.').pop().toLowerCase();
        let mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));
        let b64 = 'data:' + mime + ';base64,' + res.data;
        let kb = fileSizeKB || (res.data.length * 0.75 / 1024).toFixed(1);
        that._fullCode = b64;
        let itemMeta = { id: Date.now(), type: 'image', path: that.data.imagePath, size: kb + ' KB', preview: '' };
        that._imageCache = [{ base64: b64, textContent: '' }].concat(that._imageCache).slice(0, 20);
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
    let that = this;
    this._getFs().writeFile({
      filePath: fname, data: code, encoding: 'utf8',
      success: () => that._shareFile(fname, 'base64.txt'),
      fail: () => wx.showToast({ title: '写入失败', icon: 'none' }),
    });
  },

  copyCode() {
    if (!this._fullCode) return;
    let data = this._fullCode;
    if (data.length <= 80000) {
      wx.setClipboardData({ data: data, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
    } else {
      let wan = (data.length / 10000).toFixed(1);
      wx.setClipboardData({ data: data.slice(0, 80000), success: () => wx.showToast({ title: '数据过长（约' + wan + '万字符），已复制前8万字符', icon: 'none', duration: 3000 }) });
    }
  },

  previewImg() { this._previewImage(this.data.imagePath); },

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

        this._getFs().writeFile({
          filePath: fname,
          data: code,
          encoding: 'utf8',
          success: () => {
            wx.showActionSheet({
              itemList: ['用其他应用打开', '转发给朋友', '浏览保存目录'],
              success: (r) => {
                if (r.tapIndex === 0) {
                  wx.openDocument({ filePath: fname, showMenu: true, fail: () => that.browseFiles() });
                } else if (r.tapIndex === 1) {
                  wx.shareFileMessage({ filePath: fname, fileName: name + '.txt', fail: () => wx.showToast({ title: '分享失败', icon: 'none' }) });
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
    let raw = this.data.textContent; if (!raw || !raw.trim()) { wx.showToast({ title: '请输入文字', icon: 'none' }); return; }
    let b64 = '';
    try {
      let bytes;
      if (typeof TextEncoder !== 'undefined') {
        bytes = new TextEncoder().encode(raw);
      } else {
        let utf8 = unescape(encodeURIComponent(raw));
        bytes = new Uint8Array(utf8.length);
        for (let i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
      }
      let str = '';
      for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      b64 = btoa(str);
    } catch (e) { wx.showToast({ title: '编码失败', icon: 'none' }); return; }
    this._fullText = b64;
    let itemMeta = { id: Date.now(), type: 'text', path: '', size: raw.length + ' 字', preview: raw.slice(0, 30) };
    this._imageCache = [{ base64: b64, textContent: raw }].concat(this._imageCache).slice(0, 20);
    let list = [itemMeta].concat(this.data.images).slice(0, 20);
    // 合并更新
    this.setData({ textResult: b64.length > 300 ? b64.slice(0, 300) + '...' : b64, images: list });
    this.saveImages(list);
  },
  copyTextCode() {
    if (!this._fullText) return;
    let data = this._fullText;
    if (data.length <= 80000) {
      wx.setClipboardData({ data: data, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
    } else {
      let wan = (data.length / 10000).toFixed(1);
      wx.setClipboardData({ data: data.slice(0, 80000), success: () => wx.showToast({ title: '数据过长（约' + wan + '万字符），已复制前8万字符', icon: 'none', duration: 3000 }) });
    }
  },

  onDecodeInput(e) { this.setData({ decodeInput: e.detail.value }); },
  decodeToText() {
    let b64 = this.data.decodeInput; let idx = b64.indexOf('base64,'); if (idx >= 0) b64 = b64.slice(idx + 7);
    b64 = b64.replace(/\s/g, '');
    if (!b64) { wx.showToast({ title: '请输入 Base64 代码', icon: 'none' }); return; }
    try {
      let bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      let r;
      if (typeof TextDecoder !== 'undefined') {
        r = new TextDecoder().decode(bytes);
      } else {
        let chunks = [];
        for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)));
        r = chunks.join('');
      }
      this._fullDecode = r;
      let itemMeta = { id: Date.now(), type: 'text', subtype: 'decode', path: '', size: r.length + ' 字', preview: r.slice(0, 30) };
      this._imageCache = [{ base64: b64, textContent: r }].concat(this._imageCache).slice(0, 20);
      let list = [itemMeta].concat(this.data.images).slice(0, 20);
      // 合并更新
      this.setData({ decodeResult: r.length > 500 ? r.slice(0, 500) + '...' : r, images: list });
      this.saveImages(list);
    } catch (e) { wx.showToast({ title: '格式错误，请检查输入', icon: 'none' }); }
  },
  copyDecode() {
    if (!this._fullDecode) return;
    let data = this._fullDecode;
    if (data.length <= 80000) {
      wx.setClipboardData({ data: data, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
    } else {
      let wan = (data.length / 10000).toFixed(1);
      wx.setClipboardData({ data: data.slice(0, 80000), success: () => wx.showToast({ title: '数据过长（约' + wan + '万字符），已复制前8万字符', icon: 'none', duration: 3000 }) });
    }
  },

  decodeToImage() {
    if (this.data.decoding) return;
    let b64 = this.data.decodeInput.trim();
    if (!b64) { wx.showToast({ title: '请输入 Base64 代码', icon: 'none' }); return; }
    let idx = b64.indexOf('base64,');
    let raw = (idx >= 0 ? b64.slice(idx + 7) : b64).replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
      wx.showToast({ title: '不是有效的 Base64', icon: 'none' });
      return;
    }
    if (!b64.startsWith('data:image')) b64 = 'data:image/png;base64,' + raw;
    let mimeMatch = b64.match(/^data:(image\/\w+);/);
    let ext = mimeMatch ? (mimeMatch[1].split('/')[1] === 'jpeg' ? 'jpg' : mimeMatch[1].split('/')[1]) : 'png';
    let fname = wx.env.USER_DATA_PATH + '/dc' + Date.now() + '.' + ext;
    let that = this;
    this.setData({ decoding: true });
    this._getFs().writeFile({
      filePath: fname, data: raw, encoding: 'base64',
      success: () => {
        wx.getFileInfo({
          filePath: fname,
          success(fi) {
            that.setData({ decoding: false });
            let kb = (fi.size / 1024).toFixed(1);
            let itemMeta = { id: Date.now(), type: 'image', path: fname, size: kb + ' KB', preview: '' };
            that._imageCache = [{ base64: b64, textContent: '' }].concat(that._imageCache).slice(0, 20);
            let list = [itemMeta].concat(that.data.images).slice(0, 20);
            that.setData({ decodeImagePath: fname, images: list });
            that.saveImages(list);
            wx.showToast({ title: '已显示', icon: 'success' });
          },
          fail() {
            that.setData({ decoding: false });
            let itemMeta = { id: Date.now(), type: 'image', path: fname, size: '', preview: '' };
            that._imageCache = [{ base64: b64, textContent: '' }].concat(that._imageCache).slice(0, 20);
            let list = [itemMeta].concat(that.data.images).slice(0, 20);
            that.setData({ decodeImagePath: fname, images: list });
            that.saveImages(list);
            wx.showToast({ title: '已显示', icon: 'success' });
          },
        });
      },
      fail: () => { that.setData({ decoding: false }); wx.showToast({ title: '写入失败', icon: 'none' }); },
    });
  },
  previewDecodeImg() { this._previewImage(this.data.decodeImagePath); },

  _readUserFiles(callback, txtOnly) {
    this._getFs().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        let files = (res.files || []).filter(f => txtOnly ? f.endsWith('.txt') : (f.endsWith('.txt') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.gif')));
        if (files.length === 0) { callback([]); wx.showToast({ title: '暂无文件', icon: 'none' }); return; }
        callback(files.map(f => ({ name: f, path: wx.env.USER_DATA_PATH + '/' + f })));
      },
      fail: () => { callback([]); wx.showToast({ title: '无法读取目录', icon: 'none' }); },
    });
  },
  browseFiles() {
    this.setData({ filesShow: true, filesList: [], fileMode: '', filesLoading: true });
    this._readUserFiles(list => this.setData({ filesList: list, filesLoading: false }));
  },
  pickFileForMode(e) {
    this.setData({ fileMode: e.currentTarget.dataset.mode, filesShow: true, filesList: [], filesLoading: true });
    this._readUserFiles(list => this.setData({ filesList: list, filesLoading: false }), true);
  },
  openFile(e) {
    let idx = e.currentTarget.dataset.index;
    let f = this.data.filesList[idx];
    if (!f) return;
    let that = this;
    // 选择文件模式：读取内容填入输入框
    if (this.data.fileMode) {
      let mode = this.data.fileMode;
      this._getFs().readFile({
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
      itemList: ['用其他应用打开', '转发给朋友'],
      success: (r) => {
        if (r.tapIndex === 0) {
          let ext = f.name.split('.').pop().toLowerCase();
          if (['jpg', 'jpeg', 'png', 'webp', 'gif'].indexOf(ext) >= 0) {
            wx.previewImage({ urls: [f.path], fail: () => wx.showToast({ title: '预览失败', icon: 'none' }) });
          } else {
            wx.openDocument({ filePath: f.path, showMenu: true, fail: () => wx.showToast({ title: '打开失败', icon: 'none' }) });
          }
        } else if (r.tapIndex === 1) {
          wx.shareFileMessage({ filePath: f.path, fileName: f.name, fail: () => wx.showToast({ title: '分享失败', icon: 'none' }) });
        }
      },
    });
  },
  closeFiles() { this.setData({ filesShow: false, fileMode: '', filesLoading: false }); },

  loadHistory(e) {
    let idx = e.currentTarget.dataset.index, item = this.data.images[idx];
    if (!item) return;
    // 使用缓存，避免频繁读取存储
    let ps = this._getPs();
    let p = ps.find(x => x.id === this.data.curId);
    let full = p && p.items ? p.items.find(x => x.id === item.id) : null;
    this._batchId++;
    this._fullCode = ''; this._fullText = ''; this._fullDecode = '';
    // 重新初始化 _imageCache，与 openProject/onShow 保持一致，防止索引错位
    if (p) this._imageCache = (p.items || []).map(it => ({ base64: it.base64 || '', textContent: it.textContent || '' }));
    if (item.type === 'image') {
      let b64 = full ? (full.base64 || '') : '';
      this._fullCode = b64;
      let d = { menuShow: false, mode: 'img2code', imagePath: '', codeShow: '', size: '', converting: false, convertProgress: 0, convertStage: '' };
      d.imagePath = item.path;
      d.codeShow = b64.slice(0, 200) + (b64.length > 200 ? '...' : '');
      d.size = item.size || '';
      this.setData(d);
    } else {
      if (full && full.subtype === 'decode') {
        let b64 = full ? (full.base64 || '') : '';
        let txt = full ? (full.textContent || '') : '';
        this._fullDecode = txt;
        let d = { menuShow: false, mode: 'code2text', textContent: '', textResult: '', decodeInput: '', decodeResult: '', decodeImagePath: '', decoding: false };
        d.decodeInput = b64;
        d.decodeResult = txt.length > 500 ? txt.slice(0, 500) + '...' : txt;
        this.setData(d);
      } else {
        let txt = full ? (full.textContent || '') : '';
        let b64 = full ? (full.base64 || '') : '';
        this._fullText = b64;
        let d = { menuShow: false, mode: 'text2code', textContent: '', textResult: '', decodeInput: '', decodeResult: '', decodeImagePath: '', decoding: false };
        d.textContent = txt;
        d.textResult = b64.slice(0, 200) + (b64.length > 200 ? '...' : '');
        this.setData(d);
      }
    }
  },
});
