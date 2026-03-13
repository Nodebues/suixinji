// pages/weather/weather.js
const WEATHER_MAP = {
  0: '晴',
  1: '大部晴朗',
  2: '局部多云',
  3: '多云',
  45: '雾',
  48: '雾凇',
  51: '毛毛雨',
  53: '毛毛雨',
  55: '毛毛雨',
  56: '冻毛毛雨',
  57: '冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '小阵雨',
  81: '阵雨',
  82: '大阵雨',
  85: '小阵雪',
  86: '大阵雪',
  95: '雷暴',
  96: '雷暴伴小冰雹',
  99: '雷暴伴大冰雹'
};

Page({
  data: {
    loading: true,
    error: '',
    location: '',
    locationName: '',
    temp: '',
    weatherText: '',
    weatherCode: 0,
    windSpeed: '',
    humidity: '',
    feelsLike: '',
    canvasWidth: 345,
    selectedTime: '',
    selectedTemp: '',
    selectedIndex: -1,
    showAddressPicker: false,
    searchResults: [],
    searchKeyword: '',
    savedLocations: [],
    currentLat: '',
    currentLon: ''
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const w = sys.windowWidth || 345;
    const padding = Math.round(64 * (w / 750));
    this.setData({ canvasWidth: w - padding });
    this.loadSavedLocations();
  },

  onShow() {
    this.loadWeather();
    // 启动定时器每秒更新剩余时间
    this.startTimer();
  },

  onHide() {
    // 页面隐藏时停止定时器
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
  },

  startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.updateRemainingDaylight();
    }, 1000);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  updateRemainingDaylight() {
    const chartData = this.data.chartData;
    if (!chartData || !chartData.sunriseHour || !chartData.sunsetHour) return;

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const { sunriseHour, sunsetHour } = chartData;

    let remainingText = '';
    let remainingSeconds = 0;

    if (currentHour < sunriseHour) {
      // 未日出
      remainingText = '未日出';
    } else if (currentHour >= sunsetHour) {
      // 已日落
      remainingText = '0';
    } else {
      // 日出日落之间
      const remainingHours = sunsetHour - currentHour;
      remainingSeconds = Math.floor(remainingHours * 3600);
      
      if (remainingSeconds >= 3600) {
        // 大于等于1小时
        const hours = Math.floor(remainingSeconds / 3600);
        const mins = Math.floor((remainingSeconds % 3600) / 60);
        remainingText = `${hours}小时${mins}分钟`;
      } else if (remainingSeconds >= 60) {
        // 大于等于1分钟
        remainingText = `${Math.floor(remainingSeconds / 60)}分钟`;
      } else {
        // 小于1分钟，显示倒计时
        remainingText = `${remainingSeconds}秒`;
      }
    }

    this.setData({
      'chartData.remainingDaylight': remainingText
    });
  },

  onPullDownRefresh() {
    this.loadWeather().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadSavedLocations() {
    const saved = wx.getStorageSync('savedLocations') || [];
    this.setData({ savedLocations: saved });
  },

  loadWeather() {
    this.setData({ loading: true, error: '' });

    // 检查是否有选中的固定地址
    const currentLocation = wx.getStorageSync('currentLocation');
    if (currentLocation) {
      return this.fetchWeather(currentLocation.lat, currentLocation.lon)
        .then(() => {
          this.setData({
            location: currentLocation.name,
            locationName: currentLocation.name
          });
        });
    }

    return new Promise((resolve) => {
      wx.getLocation({
        type: 'wgs84',
        success: (loc) => {
          this.fetchWeather(loc.latitude, loc.longitude)
            .then(resolve)
            .catch(() => resolve());
        },
        fail: () => {
          // 默认北京坐标
          this.fetchWeather(39.9042, 116.4074)
            .then(resolve)
            .catch(() => resolve());
        }
      });
    });
  },

  fetchWeather(lat, lon) {
    this.setData({ currentLat: lat, currentLon: lon });
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,apparent_temperature&daily=sunrise,sunset&timezone=auto`;

    return new Promise((resolve, reject) => {
      wx.request({
        url: weatherUrl,
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            const cur = res.data.current_weather || {};
            const hourly = res.data.hourly || {};
            const code = cur.weathercode || 0;

            let humidity = '--';
            let feelsLike = '--';
            if (cur.time && hourly.time && hourly.relative_humidity_2m && hourly.apparent_temperature) {
              const hourPrefix = cur.time.substring(0, 13);
              const idx = hourly.time.findIndex(t => t.startsWith(hourPrefix));
              if (idx >= 0) {
                const h = hourly.relative_humidity_2m[idx];
                const f = hourly.apparent_temperature[idx];
                humidity = h != null ? Math.round(h) + '%' : '--';
                feelsLike = f != null ? Math.round(f) + '°' : '--';
              }
            }

            const todayData = this.parseTodayChartData(res.data, cur.time);

            this.setData({
              loading: false,
              temp: cur.temperature != null ? Math.round(cur.temperature) + '°' : '--',
              weatherText: WEATHER_MAP[code] || '未知',
              weatherCode: code,
              windSpeed: cur.windspeed != null ? cur.windspeed + ' km/h' : '--',
              humidity,
              feelsLike,
              chartData: todayData
            });

            // 立即更新剩余日照时间
            this.updateRemainingDaylight();

            // 获取地址名称
            if (!wx.getStorageSync('currentLocation')) {
              this.fetchAddress(lat, lon);
            }

            setTimeout(() => {
              this.drawTempChart(todayData, -1);
              this.queryAndDrawSunChart(todayData);
            }, 300);
          } else {
            this.setData({ loading: false, error: '获取天气失败' });
          }
          resolve();
        },
        fail: () => {
          this.setData({ loading: false, error: '网络请求失败，请检查网络' });
          reject();
        }
      });
    });
  },

  fetchAddress(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18&addressdetails=1`;

    wx.request({
      url,
      header: {
        'User-Agent': 'SuiXinJi-MiniProgram/1.0'
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const data = res.data;
          let location = data.address ? this.buildDetailedAddress(data.address) : '';
          if (!location || location === '当前位置') {
            location = this.parseDisplayName(data.display_name);
          }
          this.setData({ 
            location: location || '当前位置',
            locationName: location || '当前位置'
          });
        }
      }
    });
  },

  buildDetailedAddress(addr) {
    const parts = [];
    const seen = new Set();
    const keys = [
      'road', 'house_number',
      'neighbourhood', 'quarter',
      'suburb', 'city_district',
      'village', 'town', 'municipality',
      'city', 'county',
      'state',
      'country'
    ];

    for (const key of keys) {
      const val = addr[key];
      if (val && typeof val === 'string' && !seen.has(val)) {
        seen.add(val);
        parts.push(val.trim());
      }
    }

    return parts.length > 0 ? parts.join(' · ') : '当前位置';
  },

  parseDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') return '';
    const parts = displayName.split(',').map(s => s.trim()).filter(Boolean);
    const filtered = parts.filter(p => !/^\d{5,6}$/.test(p) && p !== 'China' && p !== '中国');
    return filtered.slice(0, 4).join(' · ') || '当前位置';
  },

  // 地址选择相关
  onLocationTap() {
    this.setData({ showAddressPicker: true, searchResults: [], searchKeyword: '' });
    this.loadSavedLocations();
  },

  closeAddressPicker() {
    this.setData({ showAddressPicker: false });
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    if (keyword.length >= 2) {
      this.searchLocation(keyword);
    } else {
      this.setData({ searchResults: [] });
    }
  },

  searchLocation(keyword) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(keyword)}&limit=5`;

    wx.request({
      url,
      header: {
        'User-Agent': 'SuiXinJi-MiniProgram/1.0'
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const results = res.data.map(item => ({
            name: item.display_name.split(',').slice(0, 4).join(','),
            lat: item.lat,
            lon: item.lon
          }));
          this.setData({ searchResults: results });
        }
      }
    });
  },

  selectLocation(e) {
    const { lat, lon, name } = e.currentTarget.dataset;
    this.setData({ showAddressPicker: false });
    
    // 保存为当前地址
    wx.setStorageSync('currentLocation', { lat, lon, name });
    this.setData({ location: name, locationName: name });
    this.fetchWeather(lat, lon);
  },

  useCurrentLocation() {
    this.setData({ showAddressPicker: false });
    wx.removeStorageSync('currentLocation');
    this.loadWeather();
  },

  saveLocation(e) {
    const { lat, lon, name } = e.currentTarget.dataset;
    const saved = this.data.savedLocations || [];
    
    // 检查是否已存在
    const exists = saved.some(l => l.lat === lat && l.lon === lon);
    if (exists) {
      wx.showToast({ title: '已存在', icon: 'none' });
      return;
    }

    saved.push({ lat, lon, name });
    this.setData({ savedLocations: saved });
    wx.setStorageSync('savedLocations', saved);
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  deleteSavedLocation(e) {
    const index = e.currentTarget.dataset.index;
    const saved = this.data.savedLocations;
    saved.splice(index, 1);
    this.setData({ savedLocations: saved });
    wx.setStorageSync('savedLocations', saved);
  },

  selectSavedLocation(e) {
    const { lat, lon, name } = e.currentTarget.dataset;
    this.setData({ showAddressPicker: false });
    wx.setStorageSync('currentLocation', { lat, lon, name });
    this.setData({ location: name, locationName: name });
    this.fetchWeather(lat, lon);
  },

  // 图表相关方法
  parseTodayChartData(data, currentTime) {
    const hourly = data.hourly || {};
    const daily = data.daily || {};
    const times = hourly.time || [];
    const temps = hourly.temperature_2m || [];

    const today = currentTime ? currentTime.substring(0, 10) : (daily.time && daily.time[0]) || '';
    let todayIndex = times.findIndex(t => t.startsWith(today));
    if (todayIndex < 0) todayIndex = 0;

    const hourLabels = [];
    const tempData = [];
    for (let i = 0; i < 24; i++) {
      const idx = todayIndex + i;
      if (idx < times.length && temps[idx] != null) {
        const t = times[idx];
        hourLabels.push(String(parseInt(t.substring(11, 13))).padStart(2, '0') + ':00');
        tempData.push(temps[idx]);
      }
    }

    const sunrise = daily.sunrise && daily.sunrise[0] ? daily.sunrise[0] : null;
    const sunset = daily.sunset && daily.sunset[0] ? daily.sunset[0] : null;

    let currentHour = 12;
    if (currentTime) {
      currentHour = parseInt(currentTime.substring(11, 13)) + parseInt(currentTime.substring(14, 16)) / 60;
    }

    let sunriseHour = 6, sunsetHour = 18;
    if (sunrise) sunriseHour = parseInt(sunrise.substring(11, 13)) + parseInt(sunrise.substring(14, 16)) / 60;
    if (sunset) sunsetHour = parseInt(sunset.substring(11, 13)) + parseInt(sunset.substring(14, 16)) / 60;

    const fmtTime = (h) => {
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    return {
      hourLabels,
      tempData,
      sunriseHour,
      sunsetHour,
      currentHour,
      sunrise,
      sunset,
      firstLight: fmtTime(sunriseHour - 0.4),
      lastLight: fmtTime(sunsetHour + 0.4),
      sunriseTime: fmtTime(sunriseHour),
      sunsetTime: fmtTime(sunsetHour),
      totalDaylight: `${Math.round((sunsetHour - sunriseHour) * 60 / 60)}小时`,
      remainingDaylight: '--'
    };
  },

  onTempChartTouch(e) {
    const touch = (e.detail && e.detail.touches && e.detail.touches[0]) || (e.touches && e.touches[0]);
    if (!touch) return;
    
    const chartData = this.data.chartData;
    if (!chartData || !chartData.tempData || chartData.tempData.length === 0) return;

    const query = wx.createSelectorQuery().in(this);
    query.select('.temp-chart-area').boundingClientRect();
    query.exec((res) => {
      if (!res || !res[0]) return;
      const rect = res[0];
      const touchX = touch.clientX - rect.left;

      const w = this.data.canvasWidth || 345;
      const padding = { left: 36, right: 16 };
      const chartW = w - padding.left - padding.right;

      if (touchX < padding.left || touchX > w - padding.right) return;

      const ratio = (touchX - padding.left) / chartW;
      const index = Math.round(ratio * 23);
      const idx = Math.max(0, Math.min(23, index));

      if (chartData.tempData[idx] == null) return;

      const time = chartData.hourLabels[idx] || '';
      const temp = chartData.tempData[idx];
      const tempStr = temp != null ? Math.round(temp) + '°' : '--';

      this.setData({
        selectedTime: time,
        selectedTemp: tempStr,
        selectedIndex: idx
      });
      this.drawTempChart(chartData, idx);
    });
  },

  drawTempChart(chartData, selectedIndex) {
    if (!chartData || !chartData.tempData || chartData.tempData.length === 0) return;
    const validTemps = chartData.tempData.filter(t => t != null);
    if (validTemps.length === 0) return;

    const idx = selectedIndex != null ? selectedIndex : this.data.selectedIndex;

    const ctx = wx.createCanvasContext('tempChart', this);
    const w = this.data.canvasWidth || 345;
    const h = 200;
    const padding = { left: 36, right: 16, top: 20, bottom: 36 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const temps = chartData.tempData.filter(t => t != null);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    const range = maxT - minT || 1;
    const padRange = range * 0.2;
    const baseT = minT - padRange;
    const topT = maxT + padRange;

    const tempToY = (t) => padding.top + chartH - ((t - baseT) / (topT - baseT)) * chartH;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, w, h);

    ctx.setStrokeStyle('#f1f5f9');
    ctx.setLineWidth(1);
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    ctx.setFontSize(10);
    ctx.setFillStyle('#94a3b8');
    for (let i = 0; i <= 4; i++) {
      const t = (topT - (range * i) / 4).toFixed(0);
      ctx.fillText(t + '°', 4, padding.top + (chartH * i) / 4 + 3);
    }

    const points = [];
    chartData.tempData.forEach((t, i) => {
      if (t != null) {
        const x = padding.left + (chartW * i) / 23;
        const y = tempToY(t);
        points.push({ x, y, t, dataIndex: i });
      }
    });

    if (points.length < 2) return;

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(91, 143, 249, 0.25)');
    gradient.addColorStop(0.5, 'rgba(91, 143, 249, 0.08)');
    gradient.addColorStop(1, 'rgba(91, 143, 249, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpx = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpx, p0.y, cpx, p1.y, p1.x, p1.y);
    }
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.setFillStyle(gradient);
    ctx.fill();

    ctx.setStrokeStyle('#5B8FF9');
    ctx.setLineWidth(2.5);
    ctx.setLineCap('round');
    ctx.setLineJoin('round');
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpx = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpx, p0.y, cpx, p1.y, p1.x, p1.y);
    }
    ctx.stroke();

    points.forEach((p, i) => {
      const isSelected = idx >= 0 && p.dataIndex === idx;
      const isHourPoint = i % 3 === 0 || i === points.length - 1;
      
      if (isSelected || isHourPoint) {
        ctx.setFillStyle(isSelected ? '#5B8FF9' : '#ffffff');
        ctx.setStrokeStyle('#5B8FF9');
        ctx.setLineWidth(isSelected ? 2.5 : 1.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, isSelected ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    if (idx >= 0 && chartData.tempData[idx] != null) {
      const selPoint = points.find(p => p.dataIndex === idx);
      if (selPoint) {
        ctx.setStrokeStyle('rgba(91, 143, 249, 0.4)');
        ctx.setLineWidth(1);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(selPoint.x, padding.top);
        ctx.lineTo(selPoint.x, padding.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    ctx.setFontSize(9);
    ctx.setFillStyle('#94a3b8');
    chartData.hourLabels.forEach((label, i) => {
      if (i % 6 === 0) {
        const x = padding.left + (chartW * i) / 23 - 10;
        ctx.fillText(label, x, h - 10);
      }
    });

    ctx.draw();
  },

  queryAndDrawSunChart(chartData) {
    const query = wx.createSelectorQuery().in(this);
    query.select('.sun-chart-wrap').boundingClientRect();
    query.exec((res) => {
      const rect = res && res[0];
      const w = (rect && rect.width) ? rect.width : (this.data.canvasWidth || 345);
      this.drawSunChart(chartData, w);
    });
  },

  drawSunChart(chartData, canvasWidth) {
    if (!chartData) return;

    const ctx = wx.createCanvasContext('sunChart', this);
    const w = canvasWidth || this.data.canvasWidth || 345;
    const h = 120;
    const padding = { left: 20, right: 20, top: 20, bottom: 20 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const sunriseHour = chartData.sunriseHour;
    const sunsetHour = chartData.sunsetHour;
    const currentHour = chartData.currentHour;

    ctx.setFillStyle('#1e293b');
    ctx.fillRect(0, 0, w, h);

    const hourToX = (hour) => padding.left + (chartW * hour) / 23;

    const horizonY = padding.top + chartH * 0.7;
    ctx.setStrokeStyle('rgba(255,255,255,0.3)');
    ctx.setLineWidth(1);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, horizonY);
    ctx.lineTo(w - padding.right, horizonY);
    ctx.stroke();
    ctx.setLineDash([]);

    const sunYAt = (hour) => {
      if (hour < sunriseHour || hour > sunsetHour) return horizonY;
      const t = (hour - sunriseHour) / (sunsetHour - sunriseHour);
      const s = Math.sin(t * Math.PI);
      return horizonY - s * chartH * 0.85;
    };

    ctx.beginPath();
    ctx.moveTo(hourToX(sunriseHour), horizonY);
    for (let hr = sunriseHour; hr <= sunsetHour; hr += 0.2) {
      ctx.lineTo(hourToX(hr), sunYAt(hr));
    }
    ctx.lineTo(hourToX(sunsetHour), horizonY);
    ctx.closePath();
    
    const dayGradient = ctx.createLinearGradient(0, padding.top, 0, horizonY);
    dayGradient.addColorStop(0, 'rgba(251, 191, 36, 0.3)');
    dayGradient.addColorStop(1, 'rgba(251, 191, 36, 0.05)');
    ctx.setFillStyle(dayGradient);
    ctx.fill();

    ctx.setStrokeStyle('rgba(251, 191, 36, 0.8)');
    ctx.setLineWidth(2);
    ctx.setLineCap('round');
    ctx.beginPath();
    ctx.moveTo(hourToX(sunriseHour), horizonY);
    for (let hr = sunriseHour; hr <= sunsetHour; hr += 0.2) {
      ctx.lineTo(hourToX(hr), sunYAt(hr));
    }
    ctx.stroke();

    [sunriseHour, sunsetHour].forEach((hr) => {
      const x = hourToX(hr);
      ctx.setFillStyle('rgba(251, 191, 36, 0.6)');
      ctx.beginPath();
      ctx.arc(x, horizonY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const currX = hourToX(currentHour);
    const currY = sunYAt(currentHour);
    
    const glow = ctx.createRadialGradient(currX, currY, 0, currX, currY, 16);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
    glow.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.setFillStyle(glow);
    ctx.beginPath();
    ctx.arc(currX, currY, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.setFillStyle('#fbbf24');
    ctx.beginPath();
    ctx.arc(currX, currY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.setFontSize(9);
    ctx.setFillStyle('rgba(255,255,255,0.5)');
    [0, 6, 12, 18, 23].forEach((i) => {
      const x = hourToX(i) - 8;
      ctx.fillText(i + 'h', x, h - 4);
    });

    ctx.draw();
  }
});
