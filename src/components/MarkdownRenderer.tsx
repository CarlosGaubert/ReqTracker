import React, { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean;
}

// Tokenize and parse inline formatting: bold, italic, strikethrough, inline code, and links
const parseInline = (text: string): React.ReactNode => {
  // Regex pattern matching:
  // 1: Inline code `...`
  // 2: Bold **...** or __...__
  // 3: Strikethrough ~~...~~
  // 4: Italic *...* or _..._
  // 5: Links [text](url)
  const regex = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(~~[^~]+~~)|(\*[^*]+\*|_[^_]+_)|(\[[^\]]+\]\([^)]+\))/g;
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  const handleLinkClick = async (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const matchedStr = match[0];

    // Inline Code: `...`
    if (matchedStr.startsWith('`') && matchedStr.endsWith('`')) {
      elements.push(
        <code
          key={keyIndex++}
          className="bg-neutral-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 font-mono text-[0.85em] px-1.5 py-0.5 rounded border border-neutral-200/80 dark:border-neutral-700/80 font-medium"
        >
          {matchedStr.slice(1, -1)}
        </code>
      );
    }
    // Bold: **...** or __...__
    else if ((matchedStr.startsWith('**') && matchedStr.endsWith('**')) || (matchedStr.startsWith('__') && matchedStr.endsWith('__'))) {
      elements.push(
        <strong key={keyIndex++} className="font-bold text-neutral-900 dark:text-neutral-50">
          {parseInline(matchedStr.slice(2, -2))}
        </strong>
      );
    }
    // Strikethrough: ~~...~~
    else if (matchedStr.startsWith('~~') && matchedStr.endsWith('~~')) {
      elements.push(
        <del key={keyIndex++} className="line-through text-neutral-400 dark:text-neutral-500">
          {parseInline(matchedStr.slice(2, -2))}
        </del>
      );
    }
    // Italic: *...* or _..._
    else if ((matchedStr.startsWith('*') && matchedStr.endsWith('*')) || (matchedStr.startsWith('_') && matchedStr.endsWith('_'))) {
      elements.push(
        <em key={keyIndex++} className="italic text-neutral-800 dark:text-neutral-200">
          {parseInline(matchedStr.slice(1, -1))}
        </em>
      );
    }
    // Links: [title](url)
    else if (matchedStr.startsWith('[') && matchedStr.includes('](') && matchedStr.endsWith(')')) {
      const closingBracket = matchedStr.indexOf('](');
      const linkText = matchedStr.slice(1, closingBracket);
      const linkUrl = matchedStr.slice(closingBracket + 2, -1);

      elements.push(
        <a
          key={keyIndex++}
          href={linkUrl}
          onClick={(e) => handleLinkClick(e, linkUrl)}
          className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium inline-flex items-center gap-0.5 group/link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>{linkText}</span>
          <ExternalLink className="h-3 w-3 opacity-60 group-hover/link:opacity-100 transition-opacity inline" />
        </a>
      );
    } else {
      elements.push(matchedStr);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length > 0 ? <>{elements}</> : text;
};

// Code block with copy button
const CodeBlockItem: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900 text-neutral-100 text-xs overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-neutral-950/80 border-b border-neutral-800 text-[11px] text-neutral-400 font-mono select-none">
        <span>{language || 'código'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-neutral-400 hover:text-neutral-200 transition-colors py-0.5 px-1.5 rounded hover:bg-neutral-800 cursor-pointer"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 text-[10px]">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="text-[10px]">Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto font-mono text-[12px] leading-relaxed text-neutral-200 selection:bg-emerald-500/30">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  compact = false,
}) => {
  if (!content || !content.trim()) {
    return (
      <div className={`text-neutral-400 dark:text-neutral-500 italic text-sm ${className}`}>
        Sin contenido
      </div>
    );
  }

  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block delimiters ```
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLanguage = trimmed.slice(3).trim();
        codeBlockLines = [];
        continue;
      } else {
        inCodeBlock = false;
        const fullCode = codeBlockLines.join('\n');
        renderedElements.push(
          <CodeBlockItem key={`code-${i}`} code={fullCode} language={codeBlockLanguage} />
        );
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      renderedElements.push(
        <hr key={`hr-${i}`} className="my-2.5 border-neutral-200 dark:border-neutral-800" />
      );
      continue;
    }

    // Headings: #, ##, ###
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h1
          key={`h1-${i}`}
          className={`font-black tracking-tight text-neutral-900 dark:text-neutral-50 ${
            compact ? 'text-sm mt-1 mb-0.5' : 'text-lg sm:text-xl mt-3 mb-1.5'
          }`}
        >
          {parseInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h2
          key={`h2-${i}`}
          className={`font-bold tracking-tight text-neutral-900 dark:text-neutral-100 ${
            compact ? 'text-xs mt-1 mb-0.5' : 'text-base sm:text-lg mt-2.5 mb-1'
          }`}
        >
          {parseInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h3
          key={`h3-${i}`}
          className={`font-semibold text-neutral-800 dark:text-neutral-200 ${
            compact ? 'text-xs mt-0.5 mb-0.5' : 'text-sm sm:text-base mt-2 mb-1'
          }`}
        >
          {parseInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    // Blockquote: > ...
    if (trimmed.startsWith('> ') || trimmed === '>') {
      renderedElements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-3 border-emerald-500/70 bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-1.5 my-1.5 rounded-r-lg text-neutral-700 dark:text-neutral-300 italic text-[0.92em]"
        >
          {parseInline(trimmed.startsWith('> ') ? trimmed.slice(2) : '')}
        </blockquote>
      );
      continue;
    }

    // Task list items / Checkboxes: - [ ] or - [x] or * [ ] or * [x] or [ ] or [x]
    const taskMatch = trimmed.match(/^([-*]\s+)?\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const isChecked = taskMatch[2].toLowerCase() === 'x';
      const taskText = taskMatch[3];

      renderedElements.push(
        <div
          key={`task-${i}`}
          className="flex items-start gap-2 py-0.5 text-neutral-700 dark:text-neutral-300 group/task"
        >
          <input
            type="checkbox"
            checked={isChecked}
            readOnly
            className="mt-1 h-3.5 w-3.5 rounded border-neutral-300 dark:border-neutral-700 text-emerald-600 focus:ring-emerald-500 accent-emerald-500 pointer-events-none"
          />
          <span className={`flex-1 ${isChecked ? 'line-through opacity-60 text-neutral-400 dark:text-neutral-500' : ''}`}>
            {parseInline(taskText)}
          </span>
        </div>
      );
      continue;
    }

    // Unordered List item: - or * or +
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      renderedElements.push(
        <li
          key={`li-${i}`}
          className="list-disc list-inside text-neutral-700 dark:text-neutral-300 py-0.5 pl-1 leading-relaxed"
        >
          {parseInline(bulletMatch[1])}
        </li>
      );
      continue;
    }

    // Ordered List item: 1. 2. etc.
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const num = orderedMatch[1];
      const itemText = orderedMatch[2];
      renderedElements.push(
        <div key={`ol-${i}`} className="flex items-start gap-1.5 py-0.5 text-neutral-700 dark:text-neutral-300 pl-1 leading-relaxed">
          <span className="font-semibold text-neutral-400 dark:text-neutral-500 text-xs mt-0.5 min-w-[1.2rem]">
            {num}.
          </span>
          <span className="flex-1">{parseInline(itemText)}</span>
        </div>
      );
      continue;
    }

    // Empty lines
    if (!trimmed) {
      renderedElements.push(
        <div key={`empty-${i}`} className={compact ? 'h-1' : 'h-2'} />
      );
      continue;
    }

    // Regular paragraph line
    renderedElements.push(
      <p key={`p-${i}`} className="min-h-[1.25rem] text-neutral-700 dark:text-neutral-300 leading-relaxed break-words">
        {parseInline(line)}
      </p>
    );
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    renderedElements.push(
      <CodeBlockItem
        key="code-unclosed"
        code={codeBlockLines.join('\n')}
        language={codeBlockLanguage}
      />
    );
  }

  return (
    <div className={`space-y-1 text-sm font-sans ${className}`}>
      {renderedElements}
    </div>
  );
};
