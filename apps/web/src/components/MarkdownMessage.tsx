"use client";

import { useState } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { CSSProperties } from "react";

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const codeStyle: CSSProperties = {
    margin: 0,
    borderRadius: 0,
    fontSize: "0.8125rem",
    border: "none",
    background: "transparent",
  };

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-white/[0.09]">
      {/* Language header + copy button */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-zinc-800/70 px-4 py-2">
        <span className="text-xs font-medium text-zinc-400">
          {lang || "plaintext"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200"
        >
          {copied ? (
            <>
              <CheckIcon />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon />
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code body */}
      <div className="bg-[#1a1b26]">
        <SyntaxHighlighter
          style={oneDark}
          language={lang || "text"}
          PreTag="div"
          customStyle={codeStyle}
          wrapLongLines
          showLineNumbers={false}
        >
          {text}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const text = String(children).replace(/\n$/, "");
    const match = /language-(\w+)/.exec(className || "");
    const lang = match?.[1] ?? "";
    if (lang || text.includes("\n")) {
      return <CodeBlock lang={lang} text={text} />;
    }
    return (
      <code className="rounded-md border border-white/[0.1] bg-zinc-900/80 px-1.5 py-0.5 font-mono text-[0.8125rem] text-zinc-200">
        {children}
      </code>
    );
  },
  p({ children }) {
    return <p className="mb-4 last:mb-0 leading-7 text-zinc-200">{children}</p>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        className="font-medium text-blue-400 underline decoration-blue-400/40 underline-offset-2 transition hover:text-blue-300"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
  ul({ children }) {
    return (
      <ul className="mb-4 list-disc space-y-1.5 pl-5 text-zinc-200 marker:text-zinc-500">
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-zinc-200">
        {children}
      </ol>
    );
  },
  li({ children }) {
    return <li className="leading-7">{children}</li>;
  },
  h1({ children }) {
    return <h1 className="mb-3 mt-6 text-xl font-bold text-white first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-2.5 mt-5 text-lg font-semibold text-white first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-2 mt-4 text-base font-semibold text-zinc-100 first:mt-0">{children}</h3>;
  },
  h4({ children }) {
    return <h4 className="mb-1.5 mt-3 text-sm font-semibold text-zinc-200 first:mt-0">{children}</h4>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="mb-4 border-l-[3px] border-zinc-600 pl-4 italic text-zinc-400">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-6 border-white/[0.08]" />;
  },
  img({ src, alt }) {
    let u = typeof src === "string" ? src.trim() : "";
    if (!u) return null;
    if (u.startsWith("//")) u = `https:${u}`;
    if (!u.startsWith("http") && !u.startsWith("https") && !u.startsWith("data:")) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={u}
        alt={typeof alt === "string" ? alt : "Image"}
        className="my-3 max-h-[min(420px,70vh)] max-w-full rounded-lg border border-white/[0.08] bg-black/25 object-contain shadow-sm"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  },
  table({ children }) {
    return (
      <div className="mb-4 max-w-full overflow-x-auto rounded-xl border border-white/[0.1]">
        <table className="min-w-full border-collapse text-left text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return (
      <thead className="border-b border-white/[0.1] bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {children}
      </thead>
    );
  },
  tbody({ children }) {
    return <tbody className="divide-y divide-white/[0.05]">{children}</tbody>;
  },
  th({ children }) {
    return <th className="px-4 py-3">{children}</th>;
  },
  td({ children }) {
    return <td className="px-4 py-3 text-zinc-300">{children}</td>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-white">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic text-zinc-300">{children}</em>;
  },
};

function markdownUrlTransform(url: string) {
  const trimmed = url.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  return defaultUrlTransform(trimmed);
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="max-w-none break-words text-[15px] leading-7 text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={markdownUrlTransform}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
