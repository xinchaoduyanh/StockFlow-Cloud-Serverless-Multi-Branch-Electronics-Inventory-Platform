/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unsafe-function-type */
declare global {
  namespace JSX {
    type Element = string;
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

/**
 * Custom JSX Factory that transpiles TSX elements into standard, high-speed HTML string concatenations.
 * Runs entirely at build-time with 0% runtime React dependency, protecting serverless performance.
 */
export function jsx(tag: string | Function, attrs: any, ...children: any[]): string {
  // If tag is a component function, invoke it
  if (typeof tag === "function") {
    return tag({ ...attrs, children: children.flat() });
  }

  // Convert style object to CSS inline string
  let styleStr = "";
  if (attrs && attrs.style && typeof attrs.style === "object") {
    styleStr = Object.keys(attrs.style)
      .map((key) => {
        const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        return `${kebabKey}: ${attrs.style[key]}`;
      })
      .join("; ");
  }

  // Format HTML attributes
  const attrsString = attrs
    ? Object.keys(attrs)
        .map((key) => {
          if (key === "style") {
            return `style="${styleStr}"`;
          }
          if (key === "className") {
            return `class="${attrs[key]}"`;
          }
          // Boolean attributes
          if (attrs[key] === true) {
            return key;
          }
          if (attrs[key] === false || attrs[key] === null || attrs[key] === undefined) {
            return "";
          }
          return `${key}="${attrs[key]}"`;
        })
        .filter(Boolean)
        .join(" ")
    : "";

  // Flatten and join child strings
  const childrenString = children
    .flat()
    .filter((c) => c !== null && c !== undefined && c !== false)
    .join("");

  const selfClosingTags = ["img", "br", "hr", "input", "meta", "link"];
  if (selfClosingTags.includes(tag.toLowerCase())) {
    return `<${tag}${attrsString ? " " + attrsString : ""} />`;
  }

  return `<${tag}${attrsString ? " " + attrsString : ""}>${childrenString}</${tag}>`;
}

// React 17 automatic runtime compatibility mapping if needed
export const jsxs = jsx;
