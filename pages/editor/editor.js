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
      { name: '恋爱', icon: '💕' },
      { name: '工作', icon: '💼' },
      { name: '学习', icon: '📚' },
      { name: '旅行', icon: '✈️' },
      { name: '美食', icon: '🍜' },
      { name: '运动', icon: '🏃' },
      { name: '心情', icon: '😊' },
      { name: '其他', icon: '📌' }
    ],
    customTags: [],
    pickerTags: [],
    selectedTag: '',
    selectedTagIndex: -1,
    showCustomInput: false,
    customTagName: ''
  },

  onLoad(options) {
    // 加载自定义标签
    const customTags = wx.getStorageSync('customTags') || [];
    
    // 为每个标签添加显示名称
    const formatTags = (tags) => tags.map(t => ({
      ...t,
      displayName: t.icon + ' ' + t.name
    }));
    
    const defaultTags = formatTags(this.data.tags);
    const customTagFormatted = formatTags(customTags);
    const pickerTags = [...defaultTags, { name: '+ 添加自定义', icon: '➕', displayName: '➕ 添加自定义' }, ...customTagFormatted];
    
    this.setData({ customTags, pickerTags });

    // 处理编辑模式或草稿
    this.loadInitialData(options);
  },

  loadInitialData(options) {
    const getTagWithIcon = (tagName) => {
      if (!tagName) return '';
      const tag = this.data.pickerTags.find(t => t.name === tagName);
      return tag ? tag.displayName : '';
    };

    const editNote = wx.getStorageSync('editNote');
    if (editNote && options.edit === '1') {
      this.setData({
        content: editNote.content || '',
        images: editNote.images || [],
        isEdit: true,
        editId: editNote.id,
        selectedTag: getTagWithIcon(editNote.tag),
        selectedTagIndex: this.data.pickerTags.findIndex(t => t.name === editNote.tag)
      });
      wx.removeStorageSync('editNote');
      return;
    }

    const draft = wx.getStorageSync('draft');
    if (draft) {
      this.setData({
        content: draft.content || '',
        images: draft.images || [],
        selectedTag: getTagWithIcon(draft.tag),
        selectedTagIndex: this.data.pickerTags.findIndex(t => t.name === draft.tag)
      });
      wx.removeStorageSync('draft');
    }
  },

  onTagChange(e) {
    const index = e.detail.value;
    const tag = this.data.pickerTags[index];
    
    if (!tag) return;
    
    if (tag.name === '+ 添加自定义') {
      this.setData({ showCustomInput: true });
    } else {
      this.setData({
        selectedTag: tag.displayName,
        selectedTagIndex: index
      });
    }
  },

  onCustomTagInput(e) {
    this.setData({ customTagName: e.detail.value });
  },

  confirmCustomTag() {
    const name = this.data.customTagName.trim();
    if (!name) {
      wx.showToast({ title: '请输入标签名', icon: 'none' });
      return;
    }
    
    const icon = '📌';
    const newTag = { name, icon, displayName: icon + ' ' + name };
    const customTags = [...this.data.customTags, newTag];
    
    // 重新构建pickerTags
    const defaultTags = this.data.pickerTags.filter(t => !t.isCustom);
    const customTagFormatted = customTags.map(t => ({ ...t, displayName: t.icon + ' ' + t.name }));
    const pickerTags = [...defaultTags, ...customTagFormatted];
    
    this.setData({
      customTags,
      pickerTags,
      selectedTag: newTag.displayName,
      selectedTagIndex: pickerTags.length - 1,
      showCustomInput: false,
      customTagName: ''
    });
    
    wx.setStorageSync('customTags', customTags);
  },

  cancelCustomTag() {
    this.setData({
      showCustomInput: false,
      customTagName: ''
    });
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

    // 获取纯标签名（去掉图标）
    const tagName = this.data.selectedTag ? this.data.selectedTag.replace(/^\S\s/, '') : '';

    const notes = wx.getStorageSync('notes') || [];

    if (this.data.isEdit) {
      const index = notes.findIndex(n => n.id === this.data.editId);
      if (index !== -1) {
        notes[index] = {
          ...notes[index],
          content: this.data.content.trim(),
          images: this.data.images,
          tag: tagName,
          formattedDate: this.formatDate(Date.now())
        };
      }
    } else {
      const note = {
        id: this.generateId(),
        content: this.data.content.trim(),
        images: this.data.images,
        tag: tagName,
        createdAt: Date.now(),
        formattedDate: this.formatDate(Date.now())
      };
      notes.unshift(note);
    }

    wx.setStorageSync('notes', notes);
    wx.removeStorageSync('draft');
    
    this.setData({
      content: '',
      images: [],
      selectedTag: ''
    });

    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1500);
  },

  onUnload() {
    if (this.data.content || this.data.images.length > 0 || this.data.selectedTag) {
      const tagName = this.data.selectedTag ? this.data.selectedTag.replace(/^\S\s/, '') : '';
      wx.setStorageSync('draft', {
        content: this.data.content,
        images: this.data.images,
        tag: tagName
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
