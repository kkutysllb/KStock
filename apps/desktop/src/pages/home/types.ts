/** pages/home 下各页面组件共享的小型类型。 */

export type AuthMode = "login" | "register";

export type ArtifactPreview =
  | { kind: "html"; name: string; downloadHref: string; htmlContent: string }
  | { kind: "markdown" | "text"; name: string; downloadHref: string; text: string };
