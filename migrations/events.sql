-- 匿名使用统计表（tianheluo-stats，绑定名 DB）。幂等，可重复执行。
-- 由 functions/api/event.js 写入：只记录事件名、页面路径、数值、遮盖后的短文字；不记录 IP、Cookie 或任何用户标识。
-- 保留约 180 天（函数里每约 100 次写入顺手清理一次）。

CREATE TABLE IF NOT EXISTS events (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    INTEGER NOT NULL,        -- Unix 秒
  day   TEXT    NOT NULL,        -- UTC 日期 YYYY-MM-DD
  name  TEXT    NOT NULL,        -- 事件名，见 functions/api/event.js 的白名单
  path  TEXT,                    -- 页面路径（不含查询参数）
  value REAL,                    -- 数值（如性能指标毫秒数、结果条数）
  prop  TEXT                     -- 一小段文字（如搜索词、插件路径），已遮盖疑似电话和邮箱
);

CREATE INDEX IF NOT EXISTS idx_events_day_name ON events (day, name);

-- 站长查看（不要放进网站页面）：
--   今日各事件次数：      SELECT name, COUNT(*) AS n FROM events WHERE day = date('now') GROUP BY name ORDER BY n DESC;
--   热门搜索词（无结果）： SELECT prop, COUNT(*) AS n FROM events WHERE name = 'hud_query' AND value = 0 GROUP BY prop ORDER BY n DESC LIMIT 30;
--   404 路径：            SELECT path, prop AS from_page, COUNT(*) AS n FROM events WHERE name = 'hit_404' GROUP BY path, prop ORDER BY n DESC LIMIT 30;
--   页面性能 P50（LCP）：  SELECT path, COUNT(*) AS n, AVG(value) AS avg_ms FROM events WHERE name = 'vital_lcp' GROUP BY path ORDER BY n DESC;
