import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Link } from "react-router-dom";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const components: Components = {
  a({ href, children }) {
    if (href?.startsWith("#") && href.length > 1) {
      return <Link to={`/pojem/${href.slice(1)}`}>{children}</Link>;
    }
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
};

const katexOptions = { throwOnError: false, strict: "ignore" as const, trust: false };

function MarkdownImpl({ children, className = "" }: { children?: string | null; className?: string }) {
  if (!children) return null;
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, katexOptions]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);

/** Inline variant (no paragraph margins), for short texts such as quiz options. */
export function InlineMarkdown({ children }: { children: string }) {
  return <Markdown className="[&_p]:my-0 inline-block">{children}</Markdown>;
}
