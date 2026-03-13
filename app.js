// app.js
App({
  onLaunch() {
    // 初始化存储
    const notes = wx.getStorageSync('notes') || [];
    wx.setStorageSync('notes', notes);
  }
})
