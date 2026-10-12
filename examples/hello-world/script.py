# -*- coding: utf-8 -*-
"""最小示例：弹出当前项目名称和选中构件数量。只读。"""
from pyrevit import revit, forms


def main():
    doc = revit.doc
    n = len(list(revit.uidoc.Selection.GetElementIds()))
    forms.alert("项目：{}\n当前选中构件：{} 个".format(doc.Title, n), title="你好天河落")


if __name__ == "__main__":
    main()
