// pages/detail/detail.js
Page({
  data: {
    note: null
  },

  onLoad(options) {
    const id = options.id;
    const notes = wx.getStorageSync('notes') || [];
    const note = notes.find(n => n.id === id);
    if (note) {
      this.setData({ note });
    } else {
      wx.showToast({ title: '笔记不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.note.images[index],
      urls: this.data.note.images
    });
  },

  goToEdit() {
    const note = this.data.note;
    // 保存当前笔记到编辑器的初始数据
    wx.setStorageSync('editNote', {
      id: note.id,
      content: note.content,
      images: note.images
    });
    wx.navigateTo({ url: '/pages/editor/editor?edit=1' });
  }
});
