# -*- coding: utf-8 -*-
"""统计各类别构件数量。只读。演示：选择范围、FilteredElementCollector、结果弹窗。"""
from pyrevit import revit, DB, forms


def main():
    doc = revit.doc
    scope = forms.CommandSwitchWindow.show(["当前视图", "整个项目"], message="统计范围：")
    if not scope:
        return  # 用户取消

    if scope == "当前视图":
        collector = DB.FilteredElementCollector(doc, doc.ActiveView.Id)
    else:
        collector = DB.FilteredElementCollector(doc)

    counts = {}
    for e in collector.WhereElementIsNotElementType().ToElements():
        cat = e.Category
        if cat is None:
            continue
        counts[cat.Name] = counts.get(cat.Name, 0) + 1

    if not counts:
        forms.alert("没有找到任何构件。", title="按类别统计")
        return

    rows = sorted(counts.items(), key=lambda kv: -kv[1])
    lines = ["{}：{}".format(name, n) for name, n in rows[:30]]
    more = "\n……（还有 {} 个类别）".format(len(rows) - 30) if len(rows) > 30 else ""
    forms.alert(
        "范围：{}\n共 {} 个类别，{} 个构件\n\n{}{}".format(
            scope, len(rows), sum(counts.values()), "\n".join(lines), more),
        title="按类别统计")


if __name__ == "__main__":
    main()
