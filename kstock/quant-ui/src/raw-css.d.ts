/** `?raw` 导入（quant.css 内联进客户端 bundle）的类型面。 */
declare module '*.css?raw' {
  const text: string
  export default text
}
