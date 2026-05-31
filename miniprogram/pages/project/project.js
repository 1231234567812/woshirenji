const app = getApp();

Page({
  data: { list: [], darkMode: false, filesShow: false, filesList: [], filesLoading: false },
  _projectsCache: null, // 缓存项目数据
  _lastLoadTime: 0, // 上次加载时间戳
  _fs: null,

  _getFs() {
    if (!this._fs) this._fs = wx.getFileSystemManager();
    return this._fs;
  },

  onLoad() {
    let dm = app.globalData.darkMode;
    this.setData({ darkMode: dm });
    if (dm) this.applyDark(true);
  },

  onShow() {
    const tabBar = this.getTabBar();
    let dm = app.globalData.darkMode;
    if (tabBar) tabBar.setData({ selected: 1, dark: dm });
    if (dm !== this.data.darkMode) {
      this.setData({ darkMode: dm });
      this.applyDark(dm);
    }

    let now = Date.now();
    if (now - this._lastLoadTime < 500) return; // 防抖

    let projects = wx.getStorageSync('projects') || [];
    this._projectsCache = projects;

    // 用for循环替代map，减少函数调用开销
    let mapped = [];
    for (let i = 0; i < projects.length; i++) {
      let p = projects[i];
      let items = p.items || [];
      let imgs = [];
      for (let j = 0; j < items.length; j++) {
        let img = items[j];
        imgs.push({ id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview });
      }
      mapped.push({ id: p.id, name: p.name, date: p.date, deleted: p.deleted, items: imgs });
    }
    this.setData({ list: mapped });
    this._lastLoadTime = now;
  },

  // 点开项目 → 跳回首页并传项目ID
  openProject(e) {
    let id = e.currentTarget.dataset.id;
    let ps = this._projectsCache || wx.getStorageSync('projects') || [];
    let p = ps.find(x => x.id === id);
    if (!p) return;
    if (p.deleted) {
      wx.showToast({ title: '项目已删除，请先恢复', icon: 'none' });
      return;
    }
    wx.setStorageSync('openProjectId', id);
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 删除 - 使用局部setData避免全量重载
  delProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除', content: '确定删除？(删除后可在本页恢复)',
      success: (res) => {
        if (res.confirm) {
          // 使用缓存，避免频繁读取存储
          let ps = this._projectsCache || wx.getStorageSync('projects') || [];
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) {
            // 拷贝数组，避免存储失败时污染缓存
            let psCopy = ps.slice();
            psCopy[i] = { ...ps[i], deleted: true };
            try { wx.setStorageSync('projects', psCopy); } catch (err) { wx.showToast({ title: '存储空间不足', icon: 'none' }); return; }
            this._projectsCache = psCopy;
            // 局部更新，避免全量重载
            this.setData({ ['list[' + i + '].deleted']: true });
          }
        }
      },
    });
  },

  browseFiles() {
    let that = this;
    this.setData({ filesShow: true, filesList: [], filesLoading: true });
    this._getFs().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        let files = (res.files || []).filter(f => f.endsWith('.txt') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.gif'));
        if (files.length === 0) {
          that.setData({ filesList: [], filesLoading: false });
          wx.showToast({ title: '暂无文件', icon: 'none' });
          return;
        }
        that.setData({ filesList: files.map(f => ({ name: f, path: wx.env.USER_DATA_PATH + '/' + f })), filesLoading: false });
      },
      fail: () => {
        that.setData({ filesList: [], filesLoading: false });
        wx.showToast({ title: '无法读取目录', icon: 'none' });
      },
    });
  },
  openFile(e) {
    let f = this.data.filesList[e.currentTarget.dataset.index];
    if (!f) return;
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
  closeFiles() { this.setData({ filesShow: false, filesLoading: false }); },

  applyDark(dark) {
    let bg = dark ? '#000000' : '#F5F5F7';
    let fc = dark ? '#ffffff' : '#000000';
    wx.setNavigationBarColor({ frontColor: fc, backgroundColor: bg });
    wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg });
  },

  // 彻底删除 - 使用局部setData避免全量重载
  permaDelProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '彻底删除', content: '此操作不可恢复，确定删除？',
      success: (res) => {
        if (res.confirm) {
          // 使用缓存，避免频繁读取存储
          let ps = this._projectsCache || wx.getStorageSync('projects') || [];
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) {
            // splice cache + filter list 会导致索引错位，用 filter 保持一致
            let filtered = ps.filter(p => p.id !== id);
            try { wx.setStorageSync('projects', filtered); } catch (err) { wx.showToast({ title: '存储空间不足', icon: 'none' }); return; }
            this._projectsCache = filtered; // 存储成功后才更新缓存
            this.setData({ list: this.data.list.filter(item => item.id !== id) });
            wx.showToast({ title: '已删除', icon: 'success' });
          }
        }
      },
    });
  },

  // 恢复 - 使用局部setData避免全量重载
  restoreProject(e) {
    let id = e.currentTarget.dataset.id;
    // 使用缓存，避免频繁读取存储
    let ps = this._projectsCache || wx.getStorageSync('projects') || [];
    let i = ps.findIndex(p => p.id === id);
    if (i >= 0) {
      // 拷贝数组，避免存储失败时污染缓存
      let psCopy = ps.slice();
      psCopy[i] = { ...ps[i], deleted: false };
      try { wx.setStorageSync('projects', psCopy); } catch (err) { wx.showToast({ title: '存储空间不足', icon: 'none' }); return; }
      this._projectsCache = psCopy;
      // 局部更新
      this.setData({ ['list[' + i + '].deleted']: false });
      wx.showToast({ title: '已恢复', icon: 'success' });
    }
  },
});
