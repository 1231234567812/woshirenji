const app = getApp();

Page({
  data: {
    view: 'list',
    projects: [],
    darkMode: false,
    mode: '', menuShow: false,
    imagePath: '', codeShow: '', size: '',
    converting: false,
    textContent: '', textResult: '',
    decodeInput: '', decodeResult: '', decodeImagePath: '',
    curId: '', curName: '',
    images: [],
    filesShow: false,
    filesList: [],
    fileMode: '',
  },

  _fullCode: '',
  _fullText: '',
  _imageCache: [],

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
    this._fullCode = ''; this._fullText = ''; this._imageCache = [];
    this.setData({ menuShow: false, mode: m, imagePath: '', codeShow: '', size: '', textContent: '', textResult: '', decodeInput: '', decodeResult: '', decodeImagePath: '' });
  },
  startImg2Code() { this.reset('img2code'); },
  startText2Code() { this.reset('text2code'); },
  startCode2Text() { this.reset('code2text'); },
  startCode2Img() { this.reset('code2img'); },

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

  convertImage() {
    let that = this;
    this.setData({ converting: true });
    wx.showNavigationBarLoading();
    wx.getFileSystemManager().readFile({
      filePath: this.data.imagePath, encoding: 'base64',
      success: (res) => {
        wx.hideNavigationBarLoading();
        let b64 = 'data:image/jpeg;base64,' + res.data;
        let kb = (res.data.length * 0.75 / 1024).toFixed(1);
        that._fullCode = b64;
        let itemMeta = { id: Date.now(), type: 'image', path: that.data.imagePath, size: kb + ' KB', preview: '' };
        that._imageCache = [{ base64: b64 }].concat(that._imageCache).slice(0, 10);
        let list = [itemMeta].concat(that.data.images).slice(0, 20);
        that.setData({ codeShow: b64.slice(0, 200) + '...', size: kb + ' KB', images: list, converting: false });
        that.saveImages(list);
      },
      fail: () => { wx.hideNavigationBarLoading(); that.setData({ converting: false }); wx.showToast({ title: '失败', icon: 'none' }); },
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
