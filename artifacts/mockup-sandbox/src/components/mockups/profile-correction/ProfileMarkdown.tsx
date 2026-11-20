import { createElement, type ComponentType, type ReactNode } from "react";

type MarkdownComponentProps = { children?: ReactNode; href?: string };

/**
 * Small local story renderer for the extracted page. It preserves paragraph
 * layout and the app-provided element renderers without bringing API/runtime
 * dependencies into the sandbox.
 */
export default function ProfileMarkdown({
  children,
  components = {},
}: {
  children: string;
  skipHtml?: boolean;
  components?: Record<string, ComponentType<MarkdownComponentProps>>;
}) {
  const Paragraph = components.p ?? "p";
  const Strong = components.strong;
  const blocks = children.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  return blocks.map((block, index) => {
    const content = block.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => {
      if (part.startsWith("**") && part.endsWith("**") && Strong) {
        return createElement(Strong, { key: partIndex }, part.slice(2, -2));
      }
      return part.replace(/<[^>]*>/g, "");
    });
    return createElement(Paragraph, { key: index }, content);
  });
}
