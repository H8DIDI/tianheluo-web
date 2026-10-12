# -*- coding: utf-8 -*-
"""给选中构件的「注释」参数批量写入文字。演示：写模型的标准流程——
选择对象 → 输入 → 预览确认 → 单个事务写入 → 统计成功/失败 → 一步 Ctrl+Z 可撤销。"""
from pyrevit import revit, DB, forms


def main():
    doc = revit.doc
    ids = list(revit.uidoc.Selection.GetElementIds())
    if not ids:
        forms.alert("请先在 Revit 里选中要写入注释的构件，再运行。", title="批量写注释")
        return

    text = forms.ask_for_string(default="", prompt="要写入「注释」的内容（留空表示清空）：", title="批量写注释")
    if text is None:
        return  # 取消

    targets, skipped = [], 0
    for eid in ids:
        elem = doc.GetElement(eid)
        p = elem.get_Parameter(DB.BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS) if elem is not None else None
        if p is None or p.IsReadOnly:
            skipped += 1
        else:
            targets.append(p)

    if not targets:
        forms.alert("选中的构件都没有可写的「注释」参数。", title="批量写注释")
        return

    # 预览确认：会改多少个，让用户决定
    msg = "将把 {} 个构件的「注释」设为：\n「{}」\n\n（有 {} 个构件没有可写的注释参数，会跳过。写入后可按 Ctrl+Z 撤销。）".format(
        len(targets), text, skipped)
    if not forms.alert(msg, title="确认写入", yes=True, no=True):
        return

    ok, failed = 0, 0
    with revit.Transaction("批量写注释"):  # 只开一个事务：一次 Ctrl+Z 撤销全部
        for p in targets:
            try:
                p.Set(text)
                ok += 1
            except Exception:
                failed += 1
    forms.alert("完成：成功 {}，失败 {}，跳过 {}。".format(ok, failed, skipped), title="批量写注释")


if __name__ == "__main__":
    main()
