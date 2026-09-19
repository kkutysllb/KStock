//#region src/index.ts
/**
* `@kstock/client-datasources` 的 node 半端。空 apply 让 Loader 挂一个宿主
* 侧行，浏览器半端经 `exports["./client"]` 随客户端模块系统下发。
*/
/** 宿主插件体 —— 本包只贡献浏览器呈现。 */
function apply() {}
//#endregion
export { apply };
