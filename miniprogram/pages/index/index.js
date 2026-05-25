const app = getApp();

Page({
  data: {
    view: 'list',
    projects: [],
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
  },

  _fullCode: '',
  _fullText: '',
  _imageCache: [],
  _batchCodes: [],

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
    this._batchConvertNext(valid, 0);
  },

  _batchConvertNext(paths, idx) {
    if (idx >= paths.length) {
      this.setData({ batchConverting: false, batchProgress: '全部完成' });
      wx.showToast({ title: '转换完成', icon: 'success' });
      return;
    }
    let that = this;
    this.setData({ batchProgress: (idx + 1) + '/' + paths.length });
    wx.getFileSystemManager().readFile({
      filePath: paths[idx], encoding: 'base64',
      success(res) {
        let b64 = 'data:image/jpeg;base64,' + res.data;
        let kb = (res.data.length * 0.75 / 1024).toFixed(1);
        that._batchCodes.push(b64);
        let item = { id: Date.now() + idx, path: paths[idx], size: kb + ' KB', code: b64.slice(0, 80) + '...', fullCode: b64 };
        let items = that.data.batchItems.concat([item]);
        that.setData({ batchItems: items });
        // 同时记录到项目历史
        let itemMeta = { id: item.id, type: 'image', path: paths[idx], size: kb + ' KB', preview: '' };
        that._imageCache = [{ base64: b64 }].concat(that._imageCache).slice(0, 20);
        let list = [itemMeta].concat(that.data.images).slice(0, 30);
        that.setData({ images: list });
        that.saveImages(list);
        that._batchConvertNext(paths, idx + 1);
      },
      fail() {
        let item = { id: Date.now() + idx, path: paths[idx], size: '失败', code: '读取失败', fullCode: '' };
        that.setData({ batchItems: that.data.batchItems.concat([item]) });
        that._batchConvertNext(paths, idx + 1);
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

  // ========== 一键复制（历史记录中的单条） ==========
  copyHistoryCode(e) {
    let idx = e.currentTarget.dataset.index;
    let item = this.data.images[idx];
    if (!item) return;
    let ps = wx.getStorageSync('projects') || [];
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
    this.load();
    let dm = app.globalData.darkMode;
    if (dm !== this.data.darkMode) {
      this.setData({ darkMode: dm });
      this.applyDark(dm);
    }
    let pendingId = wx.getStorageSync('openProjectId');
    if (pendingId) {
      wx.removeStorageSync('openProjectId');
      let ps = wx.getStorageSync('projects') || [];
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
    let ps = wx.getStorageSync('projects') || [];
    ps = ps.filter(p => !p.deleted).map(p => ({
      id: p.id, name: p.name, date: p.date,
      items: (p.items || []).map(img => ({ id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview })),
    }));
    this.setData({ projects: ps });
  },

  applyDark(dark) {
    let bg = dark ? '#1a1a2e' : '#f1faee';
    let fc = dark ? '#ffffff' : '#000000';
    wx.setNavigationBarColor({ frontColor: fc, backgroundColor: bg });
    wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg });
  },

  createProject() {
    wx.showModal({
      title: '新建项目', editable: true, placeholderText: '输入项目名称',
      success: (res) => {
        if (res.confirm && res.content) {
          let ps = wx.getStorageSync('projects') || [];
          ps.unshift({ id: 'p_' + Date.now(), name: res.content, date: new Date().toLocaleString(), items: [] });
          try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
          this.load();
        }
      },
    });
  },

  openProject(e) {
    let id = e.currentTarget.dataset.id;
    let ps = wx.getStorageSync('projects') || [];
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
          let ps = wx.getStorageSync('projects') || [];
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) { ps[i].deleted = true; try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '操作失败', icon: 'none' }); } }
          this.load();
        }
      },
    });
  },

  goBack() {
    wx.setNavigationBarTitle({ title: '图片转代码' });
    this.setData({ view: 'list' });
    this.load();
  },

  saveImages(list) {
    let ps = wx.getStorageSync('projects') || [];
    let i = ps.findIndex(p => p.id === this.data.curId);
    if (i >= 0) {
      let target = list || this.data.images;
      ps[i].items = (target || []).map((img, idx) => {
        let full = (this._imageCache && this._imageCache[idx]) ? this._imageCache[idx] : {};
        return { ...img, base64: full.base64 || '', textContent: full.textContent || '' };
      });
      try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
    }
  },

  showMenu() { this.setData({ menuShow: true }); },
  hideMenu() { this.setData({ menuShow: false }); },
  reset(m) {
    this._fullCode = ''; this._fullText = ''; this._imageCache = []; this._batchCodes = [];
    this.setData({ menuShow: false, mode: m, imagePath: '', codeShow: '', size: '', textContent: '', textResult: '', decodeInput: '', decodeResult: '', decodeImagePath: '', converting: false, convertProgress: 0, convertStage: '', compressedSize: '', batchItems: [], batchConverting: false, batchProgress: '', batchTotal: 0 });
  },
  startImg2Code() { this.reset('img2code'); },
  startText2Code() { this.reset('text2code'); },
  startCode2Text() { this.reset('code2text'); },
  startCode2Img() { this.reset('code2img'); },
  startBatchImg() { this.reset('batch'); },

  quickAction(e) {
    let mode = e.currentTarget.dataset.mode;
    if (!this.data.curId) {
      let ps = wx.getStorageSync('projects') || [];
      let p = { id: 'p_' + Date.now(), name: '快速项目', date: new Date().toLocaleString(), items: [] };
      ps.unshift(p);
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

    this.setData({ converting: true, convertProgress: 5, convertStage: '准备中...', compressedSize: '' });
    wx.showNavigationBarLoading();

    // Step 1: 检查原始文件大小
    wx.getFileInfo({
      filePath: src,
      success(info) {
        let origKB = (info.size / 1024).toFixed(1);
        that.setData({ convertProgress: 15, convertStage: '原始大小 ' + origKB + ' KB' });

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
                that.setData({
                  convertProgress: 40,
                  convertStage: '压缩完成，减小 ' + ratio + '%',
                  compressedSize: compKB + ' KB',
                });
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
        that.setData({ convertProgress: 85, convertStage: '处理中...' });

        let b64 = 'data:image/jpeg;base64,' + res.data;
        let kb = fileSizeKB || (res.data.length * 0.75 / 1024).toFixed(1);
        that._fullCode = b64;
        let itemMeta = { id: Date.now(), type: 'image', path: that.data.imagePath, size: kb + ' KB', preview: '' };
        that._imageCache = [{ base64: b64 }].concat(that._imageCache).slice(0, 10);
        let list = [itemMeta].concat(that.data.images).slice(0, 20);

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
    let b64 = ''; try { b64 = btoa(String.fromCharCode(...new TextEncoder().encode(raw))); } catch (e) { b64 = '编码失败'; }
    this._fullText = b64;
    let itemMeta = { id: Date.now(), type: 'text', path: '', size: raw.length + ' 字', preview: raw.slice(0, 30) };
    this._imageCache = [{ base64: b64, textContent: raw }].concat(this._imageCache).slice(0, 10);
    let list = [itemMeta].concat(this.data.images).slice(0, 20);
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

  browseFiles() {
    let that = this;
    wx.getFileSystemManager().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        let files = (res.files || []).filter(f => f.endsWith('.txt') || f.endsWith('.jpg') || f.endsWith('.png'));
        if (files.length === 0) {
          wx.showToast({ title: '暂无文件', icon: 'none' });
          return;
        }
        let list = files.map(f => ({
          name: f,
          path: wx.env.USER_DATA_PATH + '/' + f,
        }));
        that.setData({ filesList: list, filesShow: true, fileMode: '' });
      },
      fail: () => wx.showToast({ title: '无法读取目录', icon: 'none' }),
    });
  },
  pickFileForMode(e) {
    let mode = e.currentTarget.dataset.mode;
    this.setData({ fileMode: mode });
    let that = this;
    wx.getFileSystemManager().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        let files = (res.files || []).filter(f => f.endsWith('.txt') || f.endsWith('.jpg') || f.endsWith('.png'));
        if (files.length === 0) {
          wx.showToast({ title: '暂无文件，请先在图片转代码中保存', icon: 'none' });
          return;
        }
        let list = files.map(f => ({
          name: f,
          path: wx.env.USER_DATA_PATH + '/' + f,
        }));
        that.setData({ filesList: list, filesShow: true });
      },
      fail: () => wx.showToast({ title: '无法读取目录', icon: 'none' }),
    });
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
    let ps = wx.getStorageSync('projects') || [];
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
