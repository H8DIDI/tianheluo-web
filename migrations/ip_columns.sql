-- 2026-10-18：站长分析需要，events 与 download_geo 增加访问者 IP 与地区列。
-- ALTER TABLE ADD COLUMN 不能重复执行；已在线上数据库执行过一次（tools/d1.ps1）。新建数据库时才需要再跑。
-- 保留期统一 180 天，到期由 functions 里的顺手清理删除整行（含 IP）。

ALTER TABLE events ADD COLUMN ip TEXT;
ALTER TABLE events ADD COLUMN country TEXT;
ALTER TABLE events ADD COLUMN region TEXT;
ALTER TABLE events ADD COLUMN city TEXT;
ALTER TABLE events ADD COLUMN lat REAL;
ALTER TABLE events ADD COLUMN lon REAL;
ALTER TABLE download_geo ADD COLUMN ip TEXT;
