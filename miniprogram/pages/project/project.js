const app = getApp();

Page({
  data: { list: [], darkMode: false, filesShow: false, filesList: [] },
  _projectsCache: null, // 缓存项目数据
  _lastLoadTime: 0, // 上次加载时间戳

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
    wx.setStorageSync('openProjectId', id);
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 删除 - 使用局部setData避免全量重载
  delProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除', content: '确定删除？(可在历史页恢复)',
      success: (res) => {
        if (res.confirm) {
          // 使用缓存，避免频繁读取存储
          let ps = this._projectsCache || wx.getStorageSync('projects') || [];
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) {
            ps[i].deleted = true;
            this._projectsCache = ps; // 更新缓存
            try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
            // 局部更新，避免全量重载
            this.setData({ ['list[' + i + '].deleted']: true });
          }
        }
      },
    });
  },

  browseFiles() {
    let that = this;
    wx.getFileSystemManager().readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        let files = (res.files || []).filter(f => f.endsWith('.txt') || f.endsWith('.jpg') || f.endsWith('.png'));
        if (files.length === 0) {
          that.setData({ filesList: [], filesShow: true });
          wx.showToast({ title: '暂无文件', icon: 'none' });
          return;
        }
        that.setData({ filesList: files.map(f => ({ name: f, path: wx.env.USER_DATA_PATH + '/' + f })), filesShow: true });
      },
      fail: () => wx.showToast({ title: '无法读取目录', icon: 'none' }),
    });
  },
  openFile(e) {
    let f = this.data.filesList[e.currentTarget.dataset.index];
    if (!f) return;
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
  closeFiles() { this.setData({ filesShow: false }); },

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
            ps.splice(i, 1);
            this._projectsCache = ps; // 更新缓存
            try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
            // 局部更新：从列表中移除
            let newList = this.data.list.filter(item => item.id !== id);
            this.setData({ list: newList });
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
      ps[i].deleted = false;
      this._projectsCache = ps; // 更新缓存
      try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
      // 局部更新
      this.setData({ ['list[' + i + '].deleted']: false });
      wx.showToast({ title: '已恢复', icon: 'success' });
    }
  },
});
