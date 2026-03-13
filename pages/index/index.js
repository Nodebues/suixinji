// pages/index/index.js
Page({
  data: {
    notes: [],
    filteredNotes: [],
    loading: false,
    touchingIndex: -1,
    translateX: 0,
    startX: 0,
    selectedFilter: '',
    selectedFilterIndex: 0,
    selectedFilterDisplay: '📋 全部',
    filterTags: [
      { name: '全部', icon: '📋', display: '📋 全部' },
      { name: '生活', icon: '🏠', display: '🏠 生活' },
      { name: '恋爱', icon: '💕', display: '💕 恋爱' },
      { name: '工作', icon: '💼', display: '💼 工作' },
      { name: '学习', icon: '📚', display: '📚 学习' },
      { name: '旅行', icon: '✈️', display: '✈️ 旅行' },
      { name: '美食', icon: '🍜', display: '🍜 美食' },
      { name: '运动', icon: '🏃', display: '🏃 运动' },
      { name: '心情', icon: '😊', display: '😊 心情' },
      { name: '其他', icon: '📌', display: '📌 其他' }
    ]
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
    this.setData({ 
      notes,
      filteredNotes: this.filterNotes(notes, this.data.selectedFilter)
    });
  },

  filterNotes(notes, tag) {
    if (!tag) return notes;
    return notes.filter(note => note.tag && note.tag.includes(tag));
  },

  onFilterChange(e) {
    const index = e.detail.value;
    const tag = this.data.filterTags[index];
    const selectedTag = tag.name === '全部' ? '' : tag.name;
    this.setData({
      selectedFilter: selectedTag,
      selectedFilterIndex: index,
      selectedFilterDisplay: tag.display,
      filteredNotes: this.filterNotes(this.data.notes, selectedTag)
    });
  },

  goToEditor() {
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
    const translateX = Math.min(Math.max(diff, 0), 80);
    this.setData({ translateX });
  },

  touchEnd(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== this.data.touchingIndex) return;
    
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
          this.setData({ 
            notes,
            filteredNotes: this.filterNotes(notes, this.data.selectedFilter)
          });
          wx.setStorageSync('notes', notes);
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }
});
