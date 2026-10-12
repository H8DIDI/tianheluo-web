# 批量写注释

给选中构件的「注释」参数批量写入文字。**会修改模型**，所以按规范做了：

1. 先选中构件，再运行
2. 输入内容 → **预览确认**（会改几个）
3. **单个事务**写入，成功/失败/跳过都统计
4. 一次 `Ctrl+Z` 即可撤销全部

演示：`forms.ask_for_string`、`forms.alert(yes=True, no=True)`、`revit.Transaction`。
