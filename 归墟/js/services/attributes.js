/**
 * 归墟 - 属性计算服务
 * 纯函数：根据 stat_data 与装备/天赋/灵根加成计算当前值与上限
 * 挂载到 window.GuixuAttributes
 *
 * 使用：
 * const result = GuixuAttributes.calculate(stat_data, equippedItems);
 * result = {
 *   max: { fali, shenhai, daoxin, kongsu, qiyun },
 *   current: { fali, shenhai, daoxin, kongsu },
 *   ages: { shengli, shengliMax, xinli, xinliMax }
 * }
 */
(function (global) {
  'use strict';

  var Log = global.GuixuLog ? global.GuixuLog.withScope('Attributes') : console;
  var Safe = global.GuixuSafeGet ? global.GuixuSafeGet.SafeGetValue : function (o, p, d) {
    try { return p.split('.').reduce(function (c, k) { return (c && c[k] != null) ? c[k] : undefined; }, o) ?? d; } catch (e) { return d; }
  };
  var _ = global._;

  var attributeMapping = { '法力': 'fali', '神海': 'shenhai', '道心': 'daoxin', '空速': 'kongsu', '气运': 'qiyun' };

  function parseListMaybeJSON(raw) {
    if (!raw || raw === '$__META_EXTENSIBLE__$') return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function collectBonusesFromItem(item, totals) {
    if (!item || typeof item !== 'object') return;
    var flat = item.attributes_bonus;
    if (flat && typeof flat === 'object') {
      Object.keys(flat).forEach(function (k) {
        var key = attributeMapping[k];
        if (key) totals.flat[key] += parseInt(flat[k], 10) || 0;
      });
    }
    var percent = item['百分比加成'];
    if (percent && typeof percent === 'object') {
      Object.keys(percent).forEach(function (k) {
        var key = attributeMapping[k];
        if (key) {
          var v = String(percent[k]).replace('%', '');
          totals.percent[key] += (parseFloat(v) || 0) / 100.0;
        }
      });
    }
  }

  function calculate(stat_data, equippedItems) {
    if (!stat_data) return {
      max: { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 },
      current: { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0 },
      ages: { shengli: '0 / 0', shengliMax: '0', xinli: '0 / 0', xinliMax: '0' }
    };

    var base = {
      fali: parseInt(Safe(stat_data, '基础法力', 0), 10),
      shenhai: parseInt(Safe(stat_data, '基础神海', 0), 10),
      daoxin: parseInt(Safe(stat_data, '基础道心', 0), 10),
      kongsu: parseInt(Safe(stat_data, '基础空速', 0), 10),
      qiyun: parseInt(Safe(stat_data, '基础气运', 0), 10)
    };

    var totals = {
      flat: { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 },
      percent: { fali: 0, shenhai: 0, daoxin: 0, kongsu: 0, qiyun: 0 }
    };

    // 装备
    if (equippedItems && typeof equippedItems === 'object') {
      Object.keys(equippedItems).forEach(function (k) {
        collectBonusesFromItem(equippedItems[k], totals);
      });
    }

    // 天赋列表
    var tianfuList = _.get(stat_data, '天赋列表.0', []);
    if (Array.isArray(tianfuList)) {
      tianfuList.forEach(function (tf) {
        if (tf && typeof tf === 'object') collectBonusesFromItem(tf, totals);
      });
    }

    // 灵根列表
    var linggenRaw = _.get(stat_data, '灵根列表.0', []);
    var linggens = parseListMaybeJSON(linggenRaw);
    linggens.forEach(function (lg) {
      if (!lg || lg === '$__META_EXTENSIBLE__$') return;
      if (typeof lg === 'string') {
        try { lg = JSON.parse(lg); } catch (e) { lg = null; }
      }
      if (lg && typeof lg === 'object') collectBonusesFromItem(lg, totals);
    });

    // 上限 = (基础 + Σ固定) * (1 + Σ百分比)
    var max = {
      fali: Math.floor((base.fali + totals.flat.fali) * (1 + totals.percent.fali)),
      shenhai: Math.floor((base.shenhai + totals.flat.shenhai) * (1 + totals.percent.shenhai)),
      daoxin: Math.floor((base.daoxin + totals.flat.daoxin) * (1 + totals.percent.daoxin)),
      kongsu: Math.floor((base.kongsu + totals.flat.kongsu) * (1 + totals.percent.kongsu)),
      qiyun: Math.floor((base.qiyun + totals.flat.qiyun) * (1 + totals.percent.qiyun))
    };

    // 当前值不得超过上限
    var current = {
      fali: Math.min(parseInt(Safe(stat_data, '当前法力', 0), 10), max.fali),
      shenhai: Math.min(parseInt(Safe(stat_data, '当前神海', 0), 10), max.shenhai),
      daoxin: Math.min(parseInt(Safe(stat_data, '当前道心', 0), 10), max.daoxin),
      kongsu: Math.min(parseInt(Safe(stat_data, '当前空速', 0), 10), max.kongsu)
    };

    var ages = {
      shengli: Safe(stat_data, '生理年龄'),
      shengliMax: Safe(stat_data, '生理年龄上限'),
      xinli: Safe(stat_data, '心理年龄'),
      xinliMax: Safe(stat_data, '心理年龄上限')
    };

    return { max: max, current: current, ages: ages };
  }

  var api = { calculate: calculate };
  try { Object.freeze(api); } catch (e) {}

  global.GuixuAttributes = api;
})(window);
