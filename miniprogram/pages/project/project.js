const app = getApp();

Page({
  data: { list: [], darkMode: false, filesShow: false, filesList: [] },

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
    let projects = wx.getStorageSync('projects') || [];
    projects = projects.map(p => ({
      id: p.id, name: p.name, date: p.date, deleted: p.deleted,
      items: (p.items || []).map(img => ({
        id: img.id, type: img.type, path: img.path, size: img.size, preview: img.preview,
      })),
    }));
    this.setData({ list: projects });
  },

  // 点开项目 → 跳回首页并传项目ID
  openProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.setStorageSync('openProjectId', id);
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 删除
  delProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除', content: '确定删除？(可在历史页恢复)',
      success: (res) => {
        if (res.confirm) {
          let ps = wx.getStorageSync('projects') || [];
          let i = ps.findIndex(p => p.id === id);
          if (i >= 0) { ps[i].deleted = true; try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); } }
          this.onShow();
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
    let bg = dark ? '#0d0d1a' : '#f0f4f8';
    let fc = dark ? '#ffffff' : '#000000';
    wx.setNavigationBarColor({ frontColor: fc, backgroundColor: bg });
    wx.setBackgroundColor({ backgroundColor: bg, backgroundColorTop: bg, backgroundColorBottom: bg });
  },

  // 彻底删除
  permaDelProject(e) {
    let id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '彻底删除', content: '此操作不可恢复，确定删除？',
      success: (res) => {
        if (res.confirm) {
          let ps = wx.getStorageSync('projects') || [];
          ps = ps.filter(p => p.id !== id);
          try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); }
          this.onShow();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      },
    });
  },

  // 恢复
  restoreProject(e) {
    let id = e.currentTarget.dataset.id;
    let ps = wx.getStorageSync('projects') || [];
    let i = ps.findIndex(p => p.id === id);
    if (i >= 0) { ps[i].deleted = false; try { wx.setStorageSync('projects', ps); } catch (e) { wx.showToast({ title: '存储空间不足', icon: 'none' }); } }
    this.onShow();
    wx.showToast({ title: '已恢复', icon: 'success' });
  },
});
