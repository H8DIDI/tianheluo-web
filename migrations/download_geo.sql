-- 下载地区明细（tianheluo-stats 数据库，绑定名 DB）。只执行一次，可重复执行（IF NOT EXISTS）。
--
-- 每次计入总数的下载，functions/api/dl/[id].js 写一行：时间、插件 id（宿主为 host）、
-- Cloudflare 按 IP 估算的国家 / 省州 / 城市 / 大致经纬度（两位小数，约 1 公里）。
-- 另有 ip 列（见 ip_columns.sql）。仅供站长分析，不对外展示；保留 180 天（函数里每约 50 次下载顺手清理一次）。
--
-- 执行方式（二选一）：
--   1. Cloudflare 控制台 → Workers & Pages → D1 → tianheluo-stats → Console，粘贴本文件内容执行。
--   2. npx wrangler d1 execute tianheluo-stats --remote --file migrations/download_geo.sql

CREATE TABLE IF NOT EXISTS download_geo (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,        -- Unix 秒
  plugin_id TEXT    NOT NULL,        -- 插件 id；宿主更新包记为 host
  country   TEXT,                    -- 如 CN
  region    TEXT,                    -- 省 / 州
  city      TEXT,
  lat       REAL,
  lon       REAL
);

CREATE INDEX IF NOT EXISTS idx_download_geo_ts ON download_geo (ts);
CREATE INDEX IF NOT EXISTS idx_download_geo_plugin_ts ON download_geo (plugin_id, ts);

-- 站长自己查看（不要放进网站页面）：
--   SELECT country, region, city, COUNT(*) AS n FROM download_geo GROUP BY country, region, city ORDER BY n DESC LIMIT 50;
