// 旧的插件详情网址 /plugin?id=xxx（也包括 /plugin.html?id=xxx）永久跳转到独立网址 /plugins/xxx，
// 这样搜索引擎和已经分享出去的链接会把权重转移到新网址。
export function onRequest({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const target = /^[a-z0-9-]+$/.test(id) ? `/plugins/${id}` : "/store";
  return Response.redirect(url.origin + target, 301);
}
