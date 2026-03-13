// pages/index/index.js
Page({
  data: {
    notes: [],
    loading: false,
    touchingIndex: -1,
    translateX: 0,
    startX: 0
  },

  onLoad() {
    this.loadNotes();
  },

  onShow() {
    this.loadNotes();
  },

  onPullDownRefresh() {
    this.loadNotes();
    wx.stopPullDownRefresh();
  },

  loadNotes() {
    const notes = wx.getStorageSync('notes') || [];
    this.setData({ notes });
  },

  goToEditor() {
    // 清除草稿，确保新编辑页面是空的
    wx.removeStorageSync('draft');
    wx.navigateTo({ url: '/pages/editor/editor' });
  },

  goToWeather() {
    wx.navigateTo({ url: '/pages/weather/weather' });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  // 滑动删除
  touchStart(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      startX: e.touches[0].clientX,
      touchingIndex: index,
      translateX: 0
    });
  },

  touchMove(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== this.data.touchingIndex) return;
    
    const currentX = e.touches[0].clientX;
    const diff = this.data.startX - currentX;
    // 向左滑是正值，最大80px
    const translateX = Math.min(Math.max(diff, 0), 80);
    this.setData({ translateX });
  },

  touchEnd(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== this.data.touchingIndex) return;
    
    // 滑动超过50px触发删除
    if (this.data.translateX > 50) {
      this.deleteNote(index);
    }
    
    this.setData({
      touchingIndex: -1,
      translateX: 0
    });
  },

  deleteNote(index) {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: (res) => {
        if (res.confirm) {
          const notes = wx.getStorageSync('notes') || [];
          notes.splice(index, 1);
          this.setData({ notes });
          wx.setStorageSync('notes', notes);
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }
});
