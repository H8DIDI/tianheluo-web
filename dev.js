document.getElementById("copyPrompt").addEventListener("click", function () {
  var t = document.getElementById("prompt").innerText;
  var b = this;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = "已复制"; setTimeout(function () { b.textContent = "复制提示词"; }, 1600); },
    function () { var r = document.createRange(); r.selectNode(document.getElementById("prompt")); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "已选中，请按 Ctrl+C"; });
});
