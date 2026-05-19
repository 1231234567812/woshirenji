App({
  globalData: {
    darkMode: false,
  },

  onLaunch() {
    let dm = wx.getStorageSync('darkMode');
    this.globalData.darkMode = !!dm;
  },
});
