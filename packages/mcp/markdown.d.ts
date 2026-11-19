declare module "*.md" {
  const content: string;
  export default content;
}

declare module "*.gz" {
  const data: Uint8Array;
  export default data;
}
