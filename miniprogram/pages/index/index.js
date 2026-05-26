?const app = getApp();
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
    // ͼƬѹ������
    compressImagePath: '',
    compressOrigSize: '',
    compressNewSize: '',
    compressRatio: '',
    compressResultPath: '',
    compressing: false,
    compressQualityLevel: 60,
    // ͼƬ��ˮӡ����?    wmImagePath: '',
    wmText: '',
    wmPosition: 'bottom-right',
    wmColor: '#ffffff',
    wmOpacity: 60,
    wmFontSize: 32,
    wmResultPath: '',
    wmProcessing: false,
    // ͼƬ��ʽת��
    fmtImg: '',
    fmtFrom: '',
    fmtTo: 'png',
    fmtResult: '',
    fmtSize: '',
    fmtConverting: false,
    // ͼƬ�ߴ����
    resizeImg: '',
    resizeW: 0,
    resizeH: 0,
    resizeNewW: 0,
    resizeNewH: 0,
    resizeRatio: true,
    resizeResult: '',
    resizeSize: '',
    resizing: false,
    // ͼƬ�ü�
    cropImg: '',
    cropW: 0,
    cropH: 0,
    cropRatio: 'free',
    cropResult: '',
    cropSize: '',
    cropping: false,
    // ͼƬ��ת
    rotImg: '',
    rotDeg: 0,
    rotFlipH: false,
    rotFlipV: false,
    rotResult: '',
    rotSize: '',
    rotating: false,
    // ��ɫ��ȡ
    colorImg: '',
    colorList: [],
    colorPicking: false,
    // ͼƬ������?    mosaicImg: '',
    mosaicLevel: 8,
    mosaicResult: '',
    mosaicSize: '',
    mosaicing: false,
  },

  _fullCode: '',
  _fullText: '',
  _imageCache: [],
  _batchCodes: [],
  _projectsCache: null,
  _lastLoadTime: 0,
  _dataDirty: false,
  _fs: null,

  _getFs() {
    if (!this._fs) this._fs = wx.getFileSystemManager();
    return this._fs;
  },

  _previewImage(path) {
    if (path) wx.previewImage({ urls: [path] });
  },

  // ͳһ��ȡ��Ŀ���ݣ������û���
  _getPs() {
    if (this._projectsCache) return this._projectsCache;
    let ps = wx.getStorageSync('projects') || [];
    this._projectsCache = ps;
    return ps;
  },

  // Canvas ͼƬ������������������ͼƬ�����ơ�����������
  // opts: { canvasId, imgSrc, drawW, drawH, fileType, quality, destPrefix }
  // callback: (err, { path, size }) => void
  _canvasExport(opts, callback) {
    let that = this;
    const query = wx.createSelectorQuery();
    query.select('#' + opts.canvasId).fields({ node: true, size: true }).exec(function(res) {
      if (!res[0] || !res[0].node) { callback('Canvas ��ʼ��ʧ��?); return; }
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
            let fs = this._getFs();
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
          fail: function() { callback('����ʧ��'); },
        });
      };
      img.onerror = function() { callback('ͼƬ����ʧ��'); };
      img.src = opts.imgSrc;
    });
  },

  // ����ͼƬ����ᣨ����������?  _saveToAlbum(path) {
    if (!path) return;
    wx.saveImageToPhotosAlbum({
      filePath: path,
      success() { wx.showToast({ title: '�ѱ��浽���', icon: 'success' }); },
      fail(res) {
        if (res.errMsg && res.errMsg.indexOf('auth deny') >= 0) {
          wx.showModal({
            title: '��Ҫ�ڴ�?, content: '�����������������浽���',
            success(r) { if (r.confirm) wx.openSetting(); },
          });
        } else {
          wx.showToast({ title: '����ʧ��', icon: 'none' });
        }
      },
    });
  },

  // �����ļ�������������
  _shareFile(path, fileName) {
    if (!path) return;
    wx.showActionSheet({
      itemList: ['ת�������?, '������Ӧ�ô�'],
      success(r) {
        if (r.tapIndex === 0) {
          wx.shareFileMessage({ filePath: path, fileName: fileName });
        } else if (r.tapIndex === 1) {
          wx.openDocument({ filePath: path, showMenu: true });
        }
      },
    });
  },

  // ѡ��ͼƬ������������
  _chooseImage(count, sizeType, onSuccess) {
    if (wx.chooseMedia) {
      wx.chooseMedia({ count: count, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: sizeType, success: onSuccess, fail: () => {} });
    } else {
      wx.chooseImage({ count: count, sourceType: ['album', 'camera'], sizeType: sizeType, success: onSuccess, fail: () => {} });
    }
  },

  // ��ѡ��������ȡ��ʱ·��������������?  _getTempPath(res) {
    let p = '';
    if (res.tempFiles && res.tempFiles[0]) p = res.tempFiles[0].tempFilePath || res.tempFiles[0].path;
    if (!p && res.tempFilePaths && res.tempFilePaths[0]) p = res.tempFilePaths[0];
    return p;
  },

  // ========== ����ת�� ==========
  chooseBatchImage() {
    let that = this;
    this._chooseImage(9, 'compressed', (res) => {
      let paths = [];
      if (res.tempFiles) {
        paths = res.tempFiles.map(f => f.tempFilePath || f.path).filter(Boolean);
      }
      if (paths.length === 0 && res.tempFilePaths) {
        paths = res.tempFilePaths.filter(Boolean);
      }
      if (paths.length === 0) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      that._saveTempImages(paths);
    });
  },

  _saveTempImages(tempPaths) {
    let that = this;
    let fs = this._getFs();
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
    if (valid.length === 0) { wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' }); return; }
    this._batchCodes = [];
    this.setData({ batchItems: [], batchConverting: true, batchProgress: '0/' + valid.length, batchTotal: valid.length });
    this._batchDone = 0;
    this._batchNextSlot = 0;
    this._batchImgStart = this.data.images.length;
    // ���д�����ÿ�����?��?    this._batchConvertParallel(valid, 0);
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
          that.setData({ batchConverting: false, batchProgress: 'ȫ�����' });
          that.saveImages(that.data.images.slice(0, 30));
          wx.showToast({ title: 'ת�����', icon: 'success' });
        }
      });
    }
    if (endIdx < paths.length) {
      setTimeout(function() { that._batchConvertParallel(paths, endIdx); }, 100);
    }
  },

  _batchConvertOne(paths, idx, onDone) {
    let that = this;
    this._getFs().readFile({
      filePath: paths[idx],
      encoding: 'base64',
      success(res) {
        let ext = paths[idx].split('.').pop().toLowerCase();
        let mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));
        let b64 = 'data:' + mime + ';base64,' + res.data;
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
          ['batchItems[' + slot + ']']: { id: Date.now() + idx, path: paths[idx], size: 'ʧ��', code: '��ȡʧ��', fullCode: '' }
        });
        onDone();
      },
    });
  },

  copyBatchItem(e) {
    let idx = e.currentTarget.dataset.index;
    let item = this.data.batchItems[idx];
    if (!item || !item.fullCode) return;
    wx.setClipboardData({ data: item.fullCode.slice(0, 80000), success: () => wx.showToast({ title: '�Ѹ���?, icon: 'success' }) });
  },

  copyAllBatch() {
    if (this._batchCodes.length === 0) return;
    let all = this._batchCodes.join('\n');
    wx.setClipboardData({ data: all.slice(0, 80000), success: () => wx.showToast({ title: '�Ѹ���ȫ��?, icon: 'success' }), fail: () => wx.showToast({ title: '̫���ˣ���������', icon: 'none' }) });
  },

  saveAllBatch() {
    if (this._batchCodes.length === 0) return;
    let that = this;
    wx.showModal({
      title: '��������', editable: true, placeholderText: '�����ļ���ǰ׺',
      success(res) {
        if (!res.confirm) return;
        let prefix = (res.content || 'batch').replace(/[:"<>|?*\n\r\\/]/g, '-').slice(0, 30);
        let fs = this._getFs();
        let ok = 0, fail = 0, total = that._batchCodes.length;
        that._batchCodes.forEach((code, i) => {
          let fname = wx.env.USER_DATA_PATH + '/' + prefix + '_' + (i + 1) + '.txt';
          fs.writeFile({
            filePath: fname, data: code, encoding: 'utf8',
            success() { ok++; if (ok + fail === total) { wx.showToast({ title: fail > 0 ? '�ѱ���' + ok + ' ����ʧ�� ' + fail + ' ��? : '�ѱ���' + ok + ' ���Ĵ�?, icon: fail > 0 ? 'none' : 'success' }); } },
            fail() { fail++; if (ok + fail === total) { wx.showToast({ title: ok > 0 ? '�ѱ���' + ok + ' ����ʧ�� ' + fail + ' ��? : '����ʧ��', icon: 'none' }); } },
          });
        });
      },
    });
  },

  clearBatch() {
    this._batchCodes = [];
    this.setData({ batchItems: [], batchConverting: false, batchProgress: '', batchTotal: 0 });
  },

  // ========== ��ά������?==========
  onQrInput(e) { this.setData({ qrInput: e.detail.value }); },
  setQrEc(e) { this.setData({ qrEcLevel: e.currentTarget.dataset.ec }); },

  generateQR() {
    let text = this.data.qrInput;
    if (!text || !text.trim()) { wx.showToast({ title: '�������ڴ�?, icon: 'none' }); return; }
    this.setData({ qrGenerating: true });
    let that = this;
    qrRenderer.generateQRImage(text.trim(), {
      ecLevel: this.data.qrEcLevel, size: 600
    }, function(err, path) {
      that.setData({ qrGenerating: false });
      if (err) {
        wx.showToast({ title: '����ʧ�ܣ����ݿ��ܹ���?, icon: 'none' });
        return;
      }
      that.setData({ qrImagePath: path });
      // ���浽����?      let fs = this._getFs();
      let dest = wx.env.USER_DATA_PATH + '/qr_' + Date.now() + '.png';
      fs.copyFile({
        srcPath: path, destPath: dest,
        success: function() {
          let itemMeta = { id: Date.now(), type: 'image', path: dest, size: '��ά��?, preview: text.slice(0, 30) };
          that._imageCache = [{ base64: '', textContent: 'QR:' + text }].concat(that._imageCache).slice(0, 10);
          let list = [itemMeta].concat(that.data.images).slice(0, 20);
          that.setData({ images: list });
          that.saveImages(list);
        },
        fail: function() {}
      });
      wx.showToast({ title: '������?, icon: 'success' });
    });
  },

  saveQrImage() { this._saveToAlbum(this.data.qrImagePath); },

  shareQrImage() { this._shareFile(this.data.qrImagePath, 'qrcode.png'); },

  previewQrImage() { this._previewImage(this.data.qrImagePath); },

  // ========== һ�����ƣ���ʷ��¼�еĵ�����?==========
  copyHistoryCode(e) {
    let idx = e.currentTarget.dataset.index;
    let item = this.data.images[idx];
    if (!item) return;
    // ʹ�û��棬����Ƶ����ȡ���?    let ps = this._getPs();
    let p = ps.find(x => x.id === this.data.curId);
    let full = p && p.items ? p.items.find(x => x.id === item.id) : null;
    let code = full ? (full.base64 || '') : '';
    if (!code) { wx.showToast({ title: '������?, icon: 'none' }); return; }
    wx.setClipboardData({ data: code.slice(0, 80000), success: () => wx.showToast({ title: '�Ѹ���?, icon: 'success' }) });
  },

  onLoad() {
    this.setData({ darkMode: app.globalData.darkMode });
    if (app.globalData.darkMode) this.applyDark(true);
  },

  onShow() {
    const tabBar = this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0, dark: app.globalData.darkMode });

    // ������?00ms�ڲ��ظ�����
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

    // ����+ӳ�䣬ֻȡ��Ҫ���ֶ�
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
      title: '�½���Ŀ', editable: true, placeholderText: '������Ŀ����',
      success: (res) => {
        if (res.confirm && res.content) {
          let ps = this._getPs();
          let newProj = { id: 'p_' + Date.now(), name: res.content, date: new Date().toLocaleString(), items: [] };
          ps.unshift(newProj);
          this._projectsCache = ps;
          try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '�洢�ռ䲻��', icon: 'none' }); }
          // �ֲ����£�prepend���б�ͷ��?          let newList = [{ id: newProj.id, name: newProj.name, date: newProj.date, items: [] }].concat(this.data.projects);
          this.setData({ projects: newList });
        }
      },
    });
  },

  openProject(e) {
    let id = e.currentTarget.dataset.id;
    // ʹ�û��棬����Ƶ����ȡ���?    let ps = this._getPs();
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
      title: 'ɾ��', content: 'ȷ��ɾ����?,
      success: (res) => {
        if (res.confirm) {
          let ps = this._getPs();
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) {
            ps[i].deleted = true;
            this._projectsCache = ps;
            try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '����ʧ��', icon: 'none' }); }
            // �ֲ����£�����ȫ������
            let newList = this.data.projects.filter(item => item.id !== id);
            this.setData({ projects: newList });
          }
        }
      },
    });
  },

  goBack() {
    wx.setNavigationBarTitle({ title: 'ͼƬת����? });
    this.setData({ view: 'list' });
    // ֻ�������б��ʱ���ش�?    if (this._dataDirty) {
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
      try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '�洢�ռ䲻��', icon: 'none' }); }
    }
  },

  showMenu() { this.setData({ menuShow: true }); },
  hideMenu() { this.setData({ menuShow: false }); },
  reset(m) {
    this._fullCode = ''; this._fullText = ''; this._imageCache = []; this._batchCodes = [];
    let d = { menuShow: false, mode: m, imagePath: '', codeShow: '', size: '', converting: false, convertProgress: 0, convertStage: '', compressedSize: '' };
    if (m === 'text2code' || m === 'code2text' || m === 'code2img') {
      d.textContent = ''; d.textResult = ''; d.decodeInput = ''; d.decodeResult = ''; d.decodeImagePath = '';
    } else if (m === 'batch') {
      d.batchItems = []; d.batchConverting = false; d.batchProgress = ''; d.batchTotal = 0;
    } else if (m === 'qrcode') {
      d.qrInput = ''; d.qrImagePath = ''; d.qrGenerating = false; d.qrEcLevel = 'M';
    } else if (m === 'compress') {
      d.compressImagePath = ''; d.compressOrigSize = ''; d.compressNewSize = ''; d.compressRatio = ''; d.compressResultPath = ''; d.compressing = false; d.compressQualityLevel = 60;
    } else if (m === 'watermark') {
      d.wmImagePath = ''; d.wmText = ''; d.wmPosition = 'bottom-right'; d.wmColor = '#ffffff'; d.wmOpacity = 60; d.wmFontSize = 32; d.wmResultPath = ''; d.wmProcessing = false;
    } else if (m === 'fmt') {
      d.fmtImg = ''; d.fmtFrom = ''; d.fmtTo = 'png'; d.fmtResult = ''; d.fmtSize = ''; d.fmtConverting = false;
    } else if (m === 'resize') {
      d.resizeImg = ''; d.resizeW = 0; d.resizeH = 0; d.resizeNewW = 0; d.resizeNewH = 0; d.resizeRatio = true; d.resizeResult = ''; d.resizeSize = ''; d.resizing = false;
    } else if (m === 'crop') {
      d.cropImg = ''; d.cropW = 0; d.cropH = 0; d.cropRatio = 'free'; d.cropResult = ''; d.cropSize = ''; d.cropping = false;
    } else if (m === 'rotate') {
      d.rotImg = ''; d.rotDeg = 0; d.rotFlipH = false; d.rotFlipV = false; d.rotResult = ''; d.rotSize = ''; d.rotating = false;
    } else if (m === 'color') {
      d.colorImg = ''; d.colorList = []; d.colorPicking = false;
    } else if (m === 'mosaic') {
      d.mosaicImg = ''; d.mosaicLevel = 8; d.mosaicResult = ''; d.mosaicSize = ''; d.mosaicing = false;
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

  // ========== ͼƬѹ�� ==========
  chooseCompressImage() {
    let that = this;
    this._chooseImage(1, 'original', (res) => {
      let tempPath = this._getTempPath(res);
      if (!tempPath) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      that._saveToTempFile(tempPath, 'compress', (p) => that._onCompressImagePicked(p));
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
          compressOrigSize: 'δ֪',
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
        // ͬʱ��ȡѹ�����ԭʼ�ļ���Ϣ������Ƕ��?        let getInfo = (path) => new Promise((resolve) => {
          wx.getFileInfo({ filePath: path, success: resolve, fail: () => resolve({ size: 0 }) });
        });
        Promise.all([getInfo(compressedPath), getInfo(src)]).then(([compInfo, origInfo]) => {
          let newKB = compInfo.size;
          let origKB = origInfo.size;
          let ratio = origKB > 0 ? ((1 - newKB / origKB) * 100).toFixed(0) : '0';
          let newSizeStr = newKB > 1024 * 1024 ? (newKB / 1024 / 1024).toFixed(2) + ' MB' : (newKB / 1024).toFixed(1) + ' KB';

          // ����ѹ�����
          let fs = this._getFs();
          let dest = wx.env.USER_DATA_PATH + '/compressed_' + Date.now() + '.jpg';
          fs.copyFile({
            srcPath: compressedPath, destPath: dest,
            success() {
              that.setData({ compressing: false, compressNewSize: newSizeStr, compressRatio: ratio, compressResultPath: dest });
              wx.hideNavigationBarLoading();
              wx.showToast({ title: 'ѹ�����', icon: 'success' });
            },
            fail() {
              that.setData({ compressing: false, compressNewSize: newSizeStr, compressRatio: ratio, compressResultPath: compressedPath });
              wx.hideNavigationBarLoading();
            },
          });
        }).catch(() => {
          that.setData({ compressing: false });
          wx.hideNavigationBarLoading();
          wx.showToast({ title: '��ȡѹ�����ʧ��', icon: 'none' });
        });
      },
      fail() {
        that.setData({ compressing: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: 'ѹ��ʧ��', icon: 'none' });
      },
    });
  },

  saveCompressedImage() { this._saveToAlbum(this.data.compressResultPath); },

  shareCompressedImage() { this._shareFile(this.data.compressResultPath, 'compressed.jpg'); },

  previewCompressResult() { this._previewImage(this.data.compressResultPath); },

  // ========== ͼƬ��ˮ��?==========
  chooseWmImage() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let tempPath = this._getTempPath(res);
      if (!tempPath) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      that._saveToTempFile(tempPath, 'wm', (p) => that.setData({ wmImagePath: p, wmResultPath: '' }));
    });
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

    // ��ȡͼƬ��Ϣ
    wx.getImageInfo({
      src: wmImagePath,
      success(imgInfo) {
        let imgWidth = imgInfo.width;
        let imgHeight = imgInfo.height;

        // ʹ�� Canvas 2D ����ˮӡ
        const query = wx.createSelectorQuery();
        query.select('#wmCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            that.setData({ wmProcessing: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'Canvas ��ʼ��ʧ��?, icon: 'none' });
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          // ���� Canvas �ߴ�ΪͼƬ�ߴ�?          canvas.width = imgWidth;
          canvas.height = imgHeight;

          // ����ͼƬ����
          const img = canvas.createImage();
          img.onload = function() {
            // ����ԭͼ
            ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

            // ����ˮӡλ��
            let x = 0, y = 0;
            let textAlign = 'left';
            let textBaseline = 'top';
            let padding = 20;

            // ���������С����λ��
            let fontSize = wmFontSize * (imgWidth / 750); // ����������?
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

            // ����ˮӡ��ʽ
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
            ctx.textAlign = textAlign;
            ctx.textBaseline = textBaseline;

            // ����������Ӱ����ǿ�ɶ��ԣ�
            ctx.fillStyle = 'rgba(0, 0, 0, ' + (wmOpacity / 100 * 0.5) + ')';
            ctx.fillText(wmText, x + 2, y + 2);

            // ����ˮӡ����
            let color = wmColor;
            let alpha = wmOpacity / 100;
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
            ctx.fillText(wmText, x, y);
            ctx.globalAlpha = 1;

            // ����ͼƬ
            wx.canvasToTempFilePath({
              canvas: canvas,
              quality: 0.9,
              success(res) {
                // ������
                let fs = this._getFs();
                let dest = wx.env.USER_DATA_PATH + '/wm_result_' + Date.now() + '.jpg';
                fs.copyFile({
                  srcPath: res.tempFilePath, destPath: dest,
                  success() {
                    that.setData({ wmResultPath: dest, wmProcessing: false });
                    wx.hideNavigationBarLoading();
                    wx.showToast({ title: 'ˮӡ���ӳɹ�', icon: 'success' });
                  },
                  fail() {
                    that.setData({ wmResultPath: res.tempFilePath, wmProcessing: false });
                    wx.hideNavigationBarLoading();
                    wx.showToast({ title: 'ˮӡ���ӳɹ�', icon: 'success' });
                  },
                });
              },
              fail(err) {
                that.setData({ wmProcessing: false });
                wx.hideNavigationBarLoading();
                wx.showToast({ title: '����ʧ��', icon: 'none' });
              },
            });
          };

          img.onerror = function() {
            that.setData({ wmProcessing: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' });
          };

          img.src = wmImagePath;
        });
      },
      fail() {
        that.setData({ wmProcessing: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '��ȡͼƬ��Ϣʧ��', icon: 'none' });
      },
    });
  },

  saveWmImage() { this._saveToAlbum(this.data.wmResultPath); },

  shareWmImage() { this._shareFile(this.data.wmResultPath, 'watermark.jpg'); },

  previewWmResult() { this._previewImage(this.data.wmResultPath || this.data.wmImagePath); },

  // ========== ͼƬ��ʽת�� ==========
  chooseFmtImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      // �����?      let ext = p.split('.').pop().toLowerCase();
      let from = 'jpg';
      if (ext === 'png') from = 'png';
      else if (ext === 'webp') from = 'webp';
      that.setData({ fmtImg: p, fmtFrom: from, fmtTo: from === 'png' ? 'jpg' : 'png', fmtResult: '', fmtSize: '' });
    });
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
          wx.showToast({ title: 'ת�����', icon: 'success' });
        });
      },
      fail() {
        that.setData({ fmtConverting: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '��ȡͼƬ��Ϣʧ��', icon: 'none' });
      },
    });
  },

  saveFmtImg() { this._saveToAlbum(this.data.fmtResult); },

  shareFmtImg() { this._shareFile(this.data.fmtResult, 'converted.' + this.data.fmtTo); },

  previewFmtResult() { this._previewImage(this.data.fmtResult); },
  // ========== ͼƬ�ߴ���� ==========
  chooseResizeImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
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
      wx.showToast({ title: '�������', icon: 'success' });
    });
  },

  saveResizeImg() { this._saveToAlbum(this.data.resizeResult); },

  shareResizeImg() { this._shareFile(this.data.resizeResult, 'resized.jpg'); },

  previewResizeResult() { this._previewImage(this.data.resizeResult); },

  // ========== ͼƬ�ü� ==========
  chooseCropImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      wx.getImageInfo({
        src: p,
        success(info) {
          that.setData({ cropImg: p, cropW: info.width, cropH: info.height, cropResult: '', cropSize: '' });
        },
        fail() {
          that.setData({ cropImg: p, cropW: 0, cropH: 0, cropResult: '', cropSize: '' });
        },
      });
    });
  },

  setCropRatio(e) { this.setData({ cropRatio: e.currentTarget.dataset.ratio }); },

  doCrop() {
    let that = this;
    let { cropImg, cropW, cropH, cropRatio } = this.data;
    if (!cropImg || cropW <= 0 || cropH <= 0) return;

    // ����ü����򣨾��вü���
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
    // free ģʽ���ü���ʹ��ԭͼ

    this.setData({ cropping: true });
    wx.showNavigationBarLoading();

    const query = wx.createSelectorQuery();
    query.select('#cropCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) {
        that.setData({ cropping: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: 'Canvas ��ʼ��ʧ��?, icon: 'none' });
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
            let fs = this._getFs();
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
                    wx.showToast({ title: '�ü����', icon: 'success' });
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
            wx.showToast({ title: '����ʧ��', icon: 'none' });
          },
        });
      };
      img.onerror = function() {
        that.setData({ cropping: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' });
      };
      img.src = cropImg;
    });
  },

  saveCropImg() { this._saveToAlbum(this.data.cropResult); },

  shareCropImg() { this._shareFile(this.data.cropResult, 'cropped.jpg'); },

  previewCropResult() { this._previewImage(this.data.cropResult); },

  // ========== ͼƬ��ת ==========
  chooseRotImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      that.setData({ rotImg: p, rotDeg: 0, rotFlipH: false, rotFlipV: false, rotResult: '', rotSize: '' });
    });
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
        // 90/270����תʱ���߻���
        let isRightAngle = (rotDeg === 90 || rotDeg === 270);
        let cw = isRightAngle ? ih : iw;
        let ch = isRightAngle ? iw : ih;

        const query = wx.createSelectorQuery();
        query.select('#rotCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            that.setData({ rotating: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'Canvas ��ʼ��ʧ��?, icon: 'none' });
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
                let fs = this._getFs();
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
                        wx.showToast({ title: '��ת���', icon: 'success' });
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
                wx.showToast({ title: '����ʧ��', icon: 'none' });
              },
            });
          };
          img.onerror = function() {
            that.setData({ rotating: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' });
          };
          img.src = rotImg;
        });
      },
      fail() {
        that.setData({ rotating: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '��ȡͼƬ��Ϣʧ��', icon: 'none' });
      },
    });
  },

  saveRotImg() { this._saveToAlbum(this.data.rotResult); },

  shareRotImg() { this._shareFile(this.data.rotResult, 'rotated.jpg'); },

  previewRotResult() { this._previewImage(this.data.rotResult); },

  // ========== ��ɫ��ȡ ==========
  chooseColorImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      that.setData({ colorImg: p, colorList: [] });
      that._extractColors(p);
    });
  },

  _extractColors(imgPath) {
    let that = this;
    this.setData({ colorPicking: true });
    wx.showNavigationBarLoading();

    wx.getImageInfo({
      src: imgPath,
      success(info) {
        // ��С��?50x50 ���ٲɴ�?        let sw = 50, sh = 50;
        const query = wx.createSelectorQuery();
        query.select('#colorCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            that.setData({ colorPicking: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'Canvas ��ʼ��ʧ��?, icon: 'none' });
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
            wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' });
          };
          img.src = imgPath;
        });
      },
      fail() {
        that.setData({ colorPicking: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '��ȡͼƬ��Ϣʧ��', icon: 'none' });
      },
    });
  },

  _clusterColors(pixels, count) {
    // ������������ɫ�ռ仮��Ϊ count ��Ͱ��ȡ�����?    let buckets = {};
    let total = pixels.length / 4;
    for (let i = 0; i < pixels.length; i += 4) {
      let r = Math.round(pixels[i] / 32) * 32;
      let g = Math.round(pixels[i+1] / 32) * 32;
      let b = Math.round(pixels[i+2] / 32) * 32;
      let key = r + ',' + g + ',' + b;
      if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
      buckets[key].r += pixels[i];
      buckets[key].g += pixels[i+1];
      buckets[key].b += pixels[i+2];
      buckets[key].count++;
    }
    let arr = Object.values(buckets).sort((a, b) => b.count - a.count).slice(0, count);
    return arr.map((c, i) => {
      let r = Math.round(c.r / c.count);
      let g = Math.round(c.g / c.count);
      let b = Math.round(c.b / c.count);
      let hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
      let pct = (c.count / total * 100).toFixed(1);
      return { hex: hex, r: r, g: g, b: b, pct: pct, id: i };
    });
  },

  copyColorHex(e) {
    let hex = e.currentTarget.dataset.hex;
    wx.setClipboardData({ data: hex, success: () => wx.showToast({ title: '�Ѹ���?' + hex, icon: 'success' }) });
  },

  previewColorImg() { this._previewImage(this.data.colorImg); },

  // ========== ͼƬ������?==========
  chooseMosaicImg() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      that.setData({ mosaicImg: p, mosaicResult: '', mosaicSize: '' });
    });
  },

  setMosaicLevel(e) { this.setData({ mosaicLevel: Number(e.currentTarget.dataset.level) }); },

  doMosaic() {
    let that = this;
    let { mosaicImg, mosaicLevel } = this.data;
    if (!mosaicImg) return;

    this.setData({ mosaicing: true });
    wx.showNavigationBarLoading();

    wx.getImageInfo({
      src: mosaicImg,
      success(info) {
        let iw = info.width, ih = info.height;
        // ��С��?1/level ��С�ٷŴ�ʵ��������Ч��?        let sw = Math.max(1, Math.floor(iw / mosaicLevel));
        let sh = Math.max(1, Math.floor(ih / mosaicLevel));

        const query = wx.createSelectorQuery();
        query.select('#mosaicCanvas').fields({ node: true, size: true }).exec((res) => {
          if (!res[0] || !res[0].node) {
            that.setData({ mosaicing: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'Canvas ��ʼ��ʧ��?, icon: 'none' });
            return;
          }
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          canvas.width = iw;
          canvas.height = ih;

          const img = canvas.createImage();
          img.onload = function() {
            // �Ȼ�Сͼ
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, sw, sh);
            // �ٷŴ�ԭ�ߴ�?            ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, iw, ih);

            wx.canvasToTempFilePath({
              canvas: canvas,
              quality: 0.9,
              success(r) {
                let fs = this._getFs();
                let dest = wx.env.USER_DATA_PATH + '/mosaic_' + Date.now() + '.jpg';
                fs.copyFile({
                  srcPath: r.tempFilePath, destPath: dest,
                  success() {
                    wx.getFileInfo({
                      filePath: dest,
                      success(fi) {
                        let kb = (fi.size / 1024).toFixed(1);
                        that.setData({ mosaicResult: dest, mosaicSize: kb + ' KB', mosaicing: false });
                        wx.hideNavigationBarLoading();
                        wx.showToast({ title: '���������?, icon: 'success' });
                      },
                      fail() {
                        that.setData({ mosaicResult: dest, mosaicSize: '', mosaicing: false });
                        wx.hideNavigationBarLoading();
                      },
                    });
                  },
                  fail() {
                    that.setData({ mosaicResult: r.tempFilePath, mosaicSize: '', mosaicing: false });
                    wx.hideNavigationBarLoading();
                  },
                });
              },
              fail() {
                that.setData({ mosaicing: false });
                wx.hideNavigationBarLoading();
                wx.showToast({ title: '����ʧ��', icon: 'none' });
              },
            });
          };
          img.onerror = function() {
            that.setData({ mosaicing: false });
            wx.hideNavigationBarLoading();
            wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' });
          };
          img.src = mosaicImg;
        });
      },
      fail() {
        that.setData({ mosaicing: false });
        wx.hideNavigationBarLoading();
        wx.showToast({ title: '��ȡͼƬ��Ϣʧ��', icon: 'none' });
      },
    });
  },

  saveMosaicImg() { this._saveToAlbum(this.data.mosaicResult); },

  shareMosaicImg() { this._shareFile(this.data.mosaicResult, 'mosaic.jpg'); },

  previewMosaicResult() { this._previewImage(this.data.mosaicResult); },

  quickAction(e) {
    let mode = e.currentTarget.dataset.mode;
    if (!this.data.curId) {
      // ʹ�û��棬����Ƶ����ȡ���?      let ps = this._getPs();
      let p = { id: 'p_' + Date.now(), name: '�������?, date: new Date().toLocaleString(), items: [] };
      ps.unshift(p);
      this._projectsCache = ps; // ���»���
      try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '�洢�ռ䲻��', icon: 'none' }); return; }
      this.setData({ view: 'work', curId: p.id, curName: p.name, images: [] });
    }
    this.reset(mode);
  },

  _onImagePicked(tempPath) {
    this._fullCode = '';
    this.setData({ imagePath: tempPath, codeShow: '', size: '' });
  },

  _saveToTempFile(tempPath, prefix, callback) {
    if (!tempPath) { wx.showToast({ title: 'ͼƬ·����Ч', icon: 'none' }); return; }
    let fs = this._getFs();
    let dest = wx.env.USER_DATA_PATH + '/' + prefix + '_' + Date.now() + '.jpg';
    fs.copyFile({
      srcPath: tempPath, destPath: dest,
      success: () => callback(dest),
      fail: () => {
        fs.saveFile({
          tempFilePath: tempPath,
          success: (res) => callback(res.savedFilePath),
          fail: () => wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' }),
        });
      },
    });
  },

  _saveTempImage(tempPath) {
    if (!tempPath) {
      wx.showToast({ title: 'ͼƬ·����Ч', icon: 'none' });
      return;
    }
    let fs = this._getFs();
    let dest = wx.env.USER_DATA_PATH + '/img_' + Date.now() + '.jpg';
    fs.copyFile({
      srcPath: tempPath, destPath: dest,
      success: () => this._onImagePicked(dest),
      fail: () => {
        fs.saveFile({
          tempFilePath: tempPath,
          success: (res) => this._onImagePicked(res.savedFilePath),
          fail: () => wx.showToast({ title: 'ͼƬ����ʧ��', icon: 'none' }),
        });
      },
    });
  },

  chooseImage() {
    let that = this;
    this._chooseImage(1, 'compressed', (res) => {
      let p = this._getTempPath(res);
      if (!p) { wx.showToast({ title: '��ȡͼƬʧ��', icon: 'none' }); return; }
      that._saveTempImage(p);
    });
  },

  setQuality(e) {
    this.setData({ compressQuality: Number(e.currentTarget.dataset.q) });
  },

  convertImage() {
    let that = this;
    let src = this.data.imagePath;
    if (!src) return;

    // �ϲ���ʼ״̬���£�����setData����
    this.setData({ converting: true, convertProgress: 5, convertStage: '׼����?..', compressedSize: '' });
    wx.showNavigationBarLoading();

    // Step 1: ���ԭʼ�ļ����?    wx.getFileInfo({
      filePath: src,
      success(info) {
        let origKB = (info.size / 1024).toFixed(1);

        // С�� 200KB ����ѹ��
        if (info.size < 200 * 1024) {
          that.setData({ convertProgress: 30, convertStage: '�ļ���С������ѹ��? });
          that._doReadBase64(src, origKB);
          return;
        }

        // Step 2: ѹ��ͼƬ
        that.setData({ convertProgress: 20, convertStage: 'ѹ����?..' });
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
                that.setData({ convertProgress: 40, convertStage: 'ѹ����ɣ�����?' + ratio + '%', compressedSize: compKB + ' KB' });
                that._doReadBase64(compressedPath, compKB);
              },
              fail() { that._doReadBase64(src, origKB); },
            });
          },
          fail() {
            // ѹ��ʧ�ܣ�����ԭͼ
            that.setData({ convertProgress: 30, convertStage: 'ѹ����֧�֣�ʹ��ԭͼ' });
            that._doReadBase64(src, origKB);
          },
        });
      },
      fail() {
        // �޷���ȡ�ļ���Ϣ��ֱ�Ӷ���?        that.setData({ convertProgress: 30, convertStage: '��ȡ��?..' });
        that._doReadBase64(src, '');
      },
    });
  },

  _doReadBase64(filePath, fileSizeKB) {
    let that = this;
    this.setData({ convertProgress: 55, convertStage: '��ȡ���ݴ�?..' });

    this._getFs().readFile({
      filePath: filePath, encoding: 'base64',
      success(res) {
        let ext = filePath.split('.').pop().toLowerCase();
        let mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));
        let b64 = 'data:' + mime + ';base64,' + res.data;
        let kb = fileSizeKB || (res.data.length * 0.75 / 1024).toFixed(1);
        that._fullCode = b64;
        let itemMeta = { id: Date.now(), type: 'image', path: that.data.imagePath, size: kb + ' KB', preview: '' };
        that._imageCache = [{ base64: b64 }].concat(that._imageCache).slice(0, 10);
        let list = [itemMeta].concat(that.data.images).slice(0, 20);

        // �ϲ����и��µ�һ��setData
        that.setData({
          convertProgress: 100,
          convertStage: '��ɴ�? + kb + ' KB',
          codeShow: b64.slice(0, 200) + '...',
          size: kb + ' KB',
          images: list,
        });
        that.saveImages(list);

        wx.hideNavigationBarLoading();
        // �ӳ�������ȴ�?        setTimeout(() => {
          that.setData({ converting: false, convertProgress: 0, convertStage: '' });
        }, 800);
      },
      fail() {
        wx.hideNavigationBarLoading();
        that.setData({ converting: false, convertProgress: 0, convertStage: '' });
        wx.showToast({ title: '��ȡʧ��', icon: 'none' });
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
      fail: () => wx.showToast({ title: 'д��ʧ��', icon: 'none' }),
    });
  },

  copyCode() {
    if (!this._fullCode) return;
    wx.setClipboardData({
      data: this._fullCode.slice(0, 80000),
      success: () => wx.showToast({ title: '�Ѹ���?, icon: 'success' }),
      fail: () => wx.showToast({ title: '̫����?, icon: 'none' }),
    });
  },

  previewImg() { this._previewImage(this.data.imagePath); },

  saveCodeFile() {
    let code = this._fullCode;
    if (!code) return;
    let that = this;
    wx.showModal({
      title: '��������ļ�',
      editable: true,
      placeholderText: '�����ļ���?,
      success: (res) => {
        if (!res.confirm) return;
        let name = (res.content || 'base64_text').replace(/[:"<>|?*\n\r\\/]/g, '-').slice(0, 50);
        let fname = wx.env.USER_DATA_PATH + '/' + name + '.txt';

        this._getFs().writeFile({
          filePath: fname,
          data: code,
          encoding: 'utf8',
          success: () => {
            wx.showToast({ title: '�ѱ���, icon: 'success' });
            wx.showActionSheet({
              itemList: ['������Ӧ�ô�', 'ת�������?, '�������Ŀ¼'],
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
          fail: (err) => wx.showToast({ title: 'д��ʧ��: ' + (err.errMsg || ''), icon: 'none' }),
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
    } catch (e) { b64 = '����ʧ��'; }
    this._fullText = b64;
    let itemMeta = { id: Date.now(), type: 'text', path: '', size: raw.length + ' ��?, preview: raw.slice(0, 30) };
    this._imageCache = [{ base64: b64, textContent: raw }].concat(this._imageCache).slice(0, 10);
    let list = [itemMeta].concat(this.data.images).slice(0, 20);
    // �ϲ�����
    this.setData({ textResult: b64.length > 300 ? b64.slice(0, 300) + '...' : b64, images: list });
    this.saveImages(list);
  },
  copyTextCode() {
    if (!this._fullText) return;
    wx.setClipboardData({
      data: this._fullText.slice(0, 80000),
      success: () => wx.showToast({ title: '�Ѹ���?, icon: 'success' }),
      fail: () => wx.showToast({ title: '̫����?, icon: 'none' }),
    });
  },

  onDecodeInput(e) { this.setData({ decodeInput: e.detail.value }); },
  decodeToText() {
    let b64 = this.data.decodeInput; let idx = b64.indexOf('base64,'); if (idx >= 0) b64 = b64.slice(idx + 7);
    b64 = b64.replace(/\s/g, '');
    try {
      let bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      let r = typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : String.fromCharCode.apply(null, bytes);
      let itemMeta = { id: Date.now(), type: 'text', path: '', size: r.length + ' ��?, preview: r.slice(0, 30) };
      this._imageCache = [{ base64: this.data.decodeInput, textContent: r }].concat(this._imageCache).slice(0, 10);
      let list = [itemMeta].concat(this.data.images).slice(0, 20);
      // �ϲ�����
      this.setData({ decodeResult: r.length > 500 ? r.slice(0, 500) + '...' : r, images: list });
      this.saveImages(list);
    } catch (e) { wx.showToast({ title: '��ʽ�����������?, icon: 'none' }); }
  },
  copyDecode() { wx.setClipboardData({ data: this.data.decodeResult, success: () => wx.showToast({ title: '�Ѹ���?, icon: 'success' }) }); },

  decodeToImage() {
    let b64 = this.data.decodeInput.trim();
    if (!b64) return;
    let idx = b64.indexOf('base64,');
    let raw = (idx >= 0 ? b64.slice(idx + 7) : b64).replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(raw)) {
      wx.showToast({ title: '������Ч��?Base64', icon: 'none' });
      return;
    }
    if (!b64.startsWith('data:image')) b64 = 'data:image/png;base64,' + raw;
    let mimeMatch = b64.match(/^data:(image\/\w+);/);
    let ext = mimeMatch ? (mimeMatch[1].split('/')[1] === 'jpeg' ? 'jpg' : mimeMatch[1].split('/')[1]) : 'png';
    let fname = wx.env.USER_DATA_PATH + '/dc' + Date.now() + '.' + ext;
    let that = this;
    this._getFs().writeFile({
      filePath: fname, data: raw, encoding: 'base64',
      success: () => {
        let itemMeta = { id: Date.now(), type: 'image', path: fname, size: '', preview: '' };
        that._imageCache = [{ base64: b64, path: fname }].concat(that._imageCache).slice(0, 10);
        let list = [itemMeta].concat(that.data.images).slice(0, 20);
        that.setData({ decodeImagePath: fname, images: list });
        that.saveImages(list);
        wx.showToast({ title: '���Դ�?, icon: 'success' });
      },
      fail: () => wx.showToast({ title: 'д��ʧ��', icon: 'none' }),
    });
  },
  previewDecodeImg() { this._previewImage(this.data.decodeImagePath); },

  _readUserFiles(callback) {
    this._getFs().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        let files = (res.files || []).filter(f => f.endsWith('.txt') || f.endsWith('.jpg') || f.endsWith('.png'));
        if (files.length === 0) { wx.showToast({ title: '�����ļ�', icon: 'none' }); return; }
        callback(files.map(f => ({ name: f, path: wx.env.USER_DATA_PATH + '/' + f })));
      },
      fail: () => wx.showToast({ title: '�޷���ȡĿ¼', icon: 'none' }),
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
    // ѡ���ļ�ģʽ����ȡ�������������
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
          wx.showToast({ title: '�Ѷ���?, icon: 'success' });
        },
        fail: () => wx.showToast({ title: '��ȡʧ��', icon: 'none' }),
      });
      return;
    }
    // ��ͨģʽ�������ļ�
    wx.showActionSheet({
      itemList: ['������Ӧ�ô�', 'ת�������?, 'ȡ��'],
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
    // ʹ�û��棬����Ƶ����ȡ���?    let ps = this._getPs();
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
