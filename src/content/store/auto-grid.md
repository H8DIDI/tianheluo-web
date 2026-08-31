---
title: "一键轴网 (AutoGrid)"
description: "极简轴网生成工具，无惧复杂标高，纯内存执行，抛弃繁琐设置。"
author: "Yu Xiaoyu"
compatibility: "Revit 2020 - 2024"
category: "建模辅助"
version: "0.1"
size: "5KB"
dll: "AutoGrid.dll"
gif: ""
download_url: "https://dl.tianheluo.com/plugins/AutoGrid_v0.1.dll"
source_code: "https://github.com/H8DIDI/tianheluo-core/tree/main/3_Plugins/AutoGrid"
bug_report: "https://github.com/H8DIDI/tianheluo-core/issues"
date: "2026-08-31"
---

在 Revit 中快速生成标准化轴网。无需繁琐的弹窗设置，纯内存执行。

## 🎬 操作演示
![AutoGrid 演示动图](/assets/gifs/autogrid-demo.gif)

## ⚡ 核心功能
* **智能生成:** 根据当前楼板轮廓自动计算包围盒并绘制轴网。
* **标高穿透:** 自动在所有关联标高中生成对应的视图可见性。
* **无痕撤销 (Ctrl+Z):** 完美接入 Revit 原生事务栈，操作失误可一键回退。

## 📥 挂载说明
1. 点击右上角 `获取 DLL` 下载插件本体。
2. 打开 Revit 顶部的 `天河落 (THL)` 控制台。
3. 点击"引入"，选择 AutoGrid.dll，即可直接使用。

## 🔄 版本历史
* **v0.1 (2026.08.31):** 首个测试包，支持正交视图一键轴网生成。