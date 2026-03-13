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
    temp: '',
    weatherText: '',
    weatherCode: 0,
    windSpeed: '',
    humidity: '',
    feelsLike: '',
    canvasWidth: 345,
    selectedTime: '',
    selectedTemp: '',
    selectedIndex: -1
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const w = sys.windowWidth || 345;
    const padding = Math.round(64 * (w / 750));
    this.setData({ canvasWidth: w - padding });
    this.loadWeather();
  },

  onPullDownRefresh() {
    this.loadWeather().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadWeather() {
    this.setData({ loading: true, error: '' });

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
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,apparent_temperature&daily=sunrise,sunset&timezone=auto`;

    return new Promise((resolve, reject) => {
      wx.request({
        url: weatherUrl,
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            const cur = res.data.current_weather || {};
            const hourly = res.data.hourly || {};
            const code = cur.weathercode || 0;

            // 从 hourly 中取当前小时的湿度和体感温度
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

            // 解析当天温度曲线、日出日落数据
            const todayData = this.parseTodayChartData(res.data, cur.time);

            this.setData({
              loading: false,
              temp: cur.temperature != null ? Math.round(cur.temperature) + '°' : '--',
              weatherText: WEATHER_MAP[code] || '未知',
              weatherCode: code,
              windSpeed: cur.windspeed != null ? cur.windspeed + ' km/h' : '--',
              humidity,
              feelsLike,
              location: '获取位置中...',
              chartData: todayData
            });

            // 逆地理编码获取地址
            this.fetchAddress(lat, lon);

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
    // zoom=18 获取更详细的地址，addressdetails=1 返回完整地址组件
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
          // 若地址组件不足，用 display_name 截取（去掉邮编等）
          if (!location || location === '当前位置') {
            location = this.parseDisplayName(data.display_name);
          }
          this.setData({ location: location || '当前位置' });
        } else {
          this.setData({ location: '当前位置' });
        }
      },
      fail: () => {
        this.setData({ location: '当前位置' });
      }
    });
  },

  // 按从具体到宏观的顺序拼接地址，尽可能详细到区/县/街道/社区
  buildDetailedAddress(addr) {
    const parts = [];
    const seen = new Set();

    // 按层级从细到粗依次添加：路/门牌 → 社区/小区 → 街道/镇 → 区/县 → 市 → 省 → 国家
    const keys = [
      'road', 'house_number',           // 路、门牌
      'neighbourhood', 'quarter',       // 小区、社区
      'suburb', 'city_district',        // 街道、片区
      'village', 'town', 'municipality', // 村、镇、市辖区
      'city', 'county',                 // 区、县
      'state',                           // 省/直辖市
      'country'                          // 国家
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

  // 解析当天图表数据：24小时温度、日出日落、当前时刻
  parseTodayChartData(data, currentTime) {
    const hourly = data.hourly || {};
    const daily = data.daily || {};
    const times = hourly.time || [];
    const temps = hourly.temperature_2m || [];

    const today = currentTime ? currentTime.substring(0, 10) : (daily.time && daily.time[0]) || '';
    let todayIndex = times.findIndex(t => t.startsWith(today));
    if (todayIndex < 0) todayIndex = 0;
    const todayCount = 24;

    const hourLabels = [];
    const tempData = [];
    for (let i = 0; i < todayCount; i++) {
      const idx = todayIndex + i;
      if (idx < times.length && times[idx]) {
        const t = times[idx];
        const h = parseInt(t.substring(11, 13), 10);
        hourLabels.push(String(h).padStart(2, '0') + ':00');
        tempData.push(temps[idx] != null ? temps[idx] : null);
      }
    }

    const sunrise = daily.sunrise && daily.sunrise[0] ? daily.sunrise[0] : null;
    const sunset = daily.sunset && daily.sunset[0] ? daily.sunset[0] : null;

    let currentHour = 12;
    if (currentTime) {
      const h = parseInt(currentTime.substring(11, 13), 10);
      const m = parseInt(currentTime.substring(14, 16), 10);
      currentHour = h + m / 60;
    }

    let sunriseHour = 6, sunsetHour = 18;
    if (sunrise) sunriseHour = parseInt(sunrise.substring(11, 13), 10) + parseInt(sunrise.substring(14, 16), 10) / 60;
    if (sunset) sunsetHour = parseInt(sunset.substring(11, 13), 10) + parseInt(sunset.substring(14, 16), 10) / 60;

    const firstLightHour = sunriseHour - 24 / 60;
    const lastLightHour = sunsetHour + 24 / 60;
    const totalDaylightMin = Math.round((sunsetHour - sunriseHour) * 60);
    let remainingDaylightMin = 0;
    if (currentHour >= sunriseHour && currentHour < sunsetHour) {
      remainingDaylightMin = Math.round((sunsetHour - currentHour) * 60);
    }

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
      firstLightHour,
      lastLightHour,
      firstLight: fmtTime(firstLightHour),
      lastLight: fmtTime(lastLightHour),
      sunriseTime: fmtTime(sunriseHour),
      sunsetTime: fmtTime(sunsetHour),
      totalDaylightMin,
      totalDaylight: `${Math.floor(totalDaylightMin / 60)}小时${totalDaylightMin % 60}分钟`,
      remainingDaylightMin,
      remainingDaylight: remainingDaylightMin > 0 ? `${Math.floor(remainingDaylightMin / 60)}小时${remainingDaylightMin % 60}分钟` : (currentHour < sunriseHour ? '未日出' : '已日落'),
      currentTime: fmtTime(currentHour)
    };
  },

  onTempChartTouch(e) {
    const touch = (e.detail && e.detail.touches && e.detail.touches[0]) || (e.touches && e.touches[0]);
    if (!touch) return;
    const clientX = touch.clientX || touch.x;
    const clientY = touch.clientY || touch.y;
    const chartData = this.data.chartData;
    if (!chartData || !chartData.tempData || chartData.tempData.length === 0) return;

    const query = wx.createSelectorQuery().in(this);
    query.select('.temp-chart-area').boundingClientRect();
    query.exec((res) => {
      if (!res || !res[0]) return;
      const rect = res[0];
      const touchX = clientX - rect.left;
      const touchY = clientY - rect.top;

      const w = this.data.canvasWidth || 345;
      const padding = { left: 44, right: 24 };
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

    // 背景
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.setStrokeStyle('#f1f5f9');
    ctx.setLineWidth(1);
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
    }

    // Y轴标签
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

    // 渐变填充
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

    // 曲线
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

    // 绘制点
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

    // 选中指示线
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

    // X轴标签
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

    // 背景
    ctx.setFillStyle('#1e293b');
    ctx.fillRect(0, 0, w, h);

    const hourToX = (hour) => padding.left + (chartW * hour) / 23;

    // 地平线
    const horizonY = padding.top + chartH * 0.7;
    ctx.setStrokeStyle('rgba(255,255,255,0.3)');
    ctx.setLineWidth(1);
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, horizonY);
    ctx.lineTo(w - padding.right, horizonY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 太阳轨迹（抛物线）
    const sunYAt = (hour) => {
      if (hour < sunriseHour || hour > sunsetHour) return horizonY;
      const t = (hour - sunriseHour) / (sunsetHour - sunriseHour);
      const s = Math.sin(t * Math.PI);
      return horizonY - s * chartH * 0.85;
    };

    // 白天渐变区域
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

    // 太阳轨迹线
    ctx.setStrokeStyle('rgba(251, 191, 36, 0.8)');
    ctx.setLineWidth(2);
    ctx.setLineCap('round');
    ctx.beginPath();
    ctx.moveTo(hourToX(sunriseHour), horizonY);
    for (let hr = sunriseHour; hr <= sunsetHour; hr += 0.2) {
      ctx.lineTo(hourToX(hr), sunYAt(hr));
    }
    ctx.stroke();

    // 日出/日落点
    [sunriseHour, sunsetHour].forEach((hr) => {
      const x = hourToX(hr);
      ctx.setFillStyle('rgba(251, 191, 36, 0.6)');
      ctx.beginPath();
      ctx.arc(x, horizonY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 当前太阳位置
    const currX = hourToX(currentHour);
    const currY = sunYAt(currentHour);
    
    // 太阳光晕
    const glow = ctx.createRadialGradient(currX, currY, 0, currX, currY, 16);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
    glow.addColorStop(0.5, 'rgba(251, 191, 36, 0.3)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.setFillStyle(glow);
    ctx.beginPath();
    ctx.arc(currX, currY, 16, 0, Math.PI * 2);
    ctx.fill();

    // 太阳本体
    ctx.setFillStyle('#fbbf24');
    ctx.beginPath();
    ctx.arc(currX, currY, 6, 0, Math.PI * 2);
    ctx.fill();

    // 时间刻度
    ctx.setFontSize(9);
    ctx.setFillStyle('rgba(255,255,255,0.5)');
    [0, 6, 12, 18, 23].forEach((i) => {
      const x = hourToX(i) - 8;
      ctx.fillText(i + 'h', x, h - 4);
    });

    ctx.draw();
  }
});
