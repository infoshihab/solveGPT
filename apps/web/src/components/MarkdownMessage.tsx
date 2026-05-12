"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import type { CSSProperties } from "react";

const codeBlockShell: CSSProperties = {
  margin: "0 0 0.75rem 0",
  borderRadius: "0.5rem",
  fontSize: "0.8125rem",
  border: "1px solid rgb(39 39 42)",
};

const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const text = String(children).replace(/\n$/, "");
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1];
    if (lang || text.includes("\n")) {
      return (
        <SyntaxHighlighter
          style={oneDark}
          language={lang ?? "text"}
          PreTag="div"
          customStyle={codeBlockShell}
          wrapLongLines
          showLineNumbers={false}
        >
          {text}
        </SyntaxHighlighter>
      );
    }
    return (
      <code className="rounded-md bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[0.8125rem] text-amber-100/95">
        {children}
      </code>
    );
  },
  p({ children }) {
    return <p className="mb-3 last:mb-0 leading-relaxed text-zinc-200">{children}</p>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        className="font-medium text-blue-400 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-300"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  ul({ children }) {
    return <ul className="mb-3 list-disc space-y-1 pl-5 text-zinc-200">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-3 list-decimal space-y-1 pl-5 text-zinc-200">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed">{children}</li>;
  },
  h1({ children }) {
    return <h1 className="mb-2 mt-4 text-lg font-semibold text-white first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-2 mt-4 text-base font-semibold text-white first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-3 text-sm font-semibold text-zinc-100 first:mt-0">{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="mb-3 border-l-2 border-zinc-500 pl-3 text-sm italic text-zinc-400">{children}</blockquote>
    );
  },
  hr() {
    return <hr className="my-4 border-surface-border" />;
  },
  img({ src, alt }) {
    if (!src || typeof src !== "string") return null;
    if (!src.startsWith("http") && !src.startsWith("https") && !src.startsWith("data:")) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={typeof alt === "string" ? alt : "Image"}
        className="my-2 max-h-[min(420px,70vh)] max-w-full rounded-lg border border-surface-border bg-black/20 object-contain shadow-md"
        loading="lazy"
      />
    );
  },
  table({ children }) {
    return (
      <div className="mb-3 max-w-full overflow-x-auto rounded-lg border border-surface-border bg-black/20">
        <table className="min-w-full border-collapse text-left text-xs">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-zinc-900/80 text-zinc-300">{children}</thead>;
  },
  th({ children }) {
    return <th className="border-b border-surface-border px-3 py-2 font-medium">{children}</th>;
  },
  td({ children }) {
    return <td className="border-b border-surface-border/80 px-3 py-2 text-zinc-300">{children}</td>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-zinc-50">{children}</strong>;
  },
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-body max-w-none break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
