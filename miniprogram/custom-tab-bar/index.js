Component({
  data: {
    selected: 0,
    dark: false,
    list: [
      { pagePath: 'pages/index/index', text: '项目', iconPath: '/images/icons/home.png', selectedIconPath: '/images/icons/home-active.png' },
      { pagePath: 'pages/project/project', text: '历史', iconPath: '/images/icons/star.png', selectedIconPath: '/images/icons/star-active.png' },
    ],
  },

  methods: {
    switchTab(e) {
      let idx = Number(e.currentTarget.dataset.index);
      let url = '/' + e.currentTarget.dataset.path;
      if (this.data.selected === idx) return;
      this.setData({ selected: idx });
      wx.switchTab({ url });
    },
  },
});
