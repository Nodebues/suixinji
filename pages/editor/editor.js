// pages/editor/editor.js
Page({
  data: {
    content: '',
    images: [],
    maxImages: 9,
    isEdit: false,
    editId: null,
    tags: [
      { name: '生活', icon: '🏠' },
      { name: '工作', icon: '💼' },
      { name: '学习', icon: '📚' },
      { name: '旅行', icon: '✈️' },
      { name: '美食', icon: '🍜' },
      { name: '运动', icon: '🏃' },
      { name: '心情', icon: '😊' },
      { name: '其他', icon: '📌' }
    ],
    selectedTag: ''
  },

  onLoad(options) {
    // 检查是否是编辑模式
    const editNote = wx.getStorageSync('editNote');
    if (editNote && options.edit === '1') {
      this.setData({
        content: editNote.content || '',
        images: editNote.images || [],
        isEdit: true,
        editId: editNote.id,
        selectedTag: editNote.tag || ''
      });
      wx.removeStorageSync('editNote');
      return;
    }

    // 检查是否有草稿
    const draft = wx.getStorageSync('draft');
    if (draft) {
      this.setData({
        content: draft.content || '',
        images: draft.images || [],
        selectedTag: draft.tag || ''
      });
      wx.removeStorageSync('draft');
    }
  },

  selectTag(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({
      selectedTag: this.data.selectedTag === tag ? '' : tag
    });
  },

  onInput(e) {
    this.setData({ content: e.detail.value });
  },

  chooseImage() {
    const remaining = this.data.maxImages - this.data.images.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多9张图', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(f => f.tempFilePath);
        this.setData({
          images: [...this.data.images, ...newImages].slice(0, 9)
        });
      }
    });
  },

  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.images.filter((_, i) => i !== index);
    this.setData({ images });
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.images[index],
      urls: this.data.images
    });
  },

  save() {
    if (!this.data.content.trim() && this.data.images.length === 0) {
      wx.showToast({ title: '内容和图片至少填写一个', icon: 'none' });
      return;
    }

    const notes = wx.getStorageSync('notes') || [];

    if (this.data.isEdit) {
      // 编辑模式：更新笔记
      const index = notes.findIndex(n => n.id === this.data.editId);
      if (index !== -1) {
        notes[index] = {
          ...notes[index],
          content: this.data.content.trim(),
          images: this.data.images,
          tag: this.data.selectedTag,
          formattedDate: this.formatDate(Date.now())
        };
      }
    } else {
      // 新增模式
      const note = {
        id: this.generateId(),
        content: this.data.content.trim(),
        images: this.data.images,
        tag: this.data.selectedTag,
        createdAt: Date.now(),
        formattedDate: this.formatDate(Date.now())
      };
      notes.unshift(note);
    }

    wx.setStorageSync('notes', notes);

    // 清除草稿
    wx.removeStorageSync('draft');
    
    // 重置表单
    this.setData({
      content: '',
      images: [],
      selectedTag: ''
    });

    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1500);
  },

  onUnload() {
    // 自动保存草稿
    if (this.data.content || this.data.images.length > 0 || this.data.selectedTag) {
      wx.setStorageSync('draft', {
        content: this.data.content,
        images: this.data.images,
        tag: this.data.selectedTag
      });
    }
  },

  generateId() {
    return 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hour}:${minute}`;
  }
});
