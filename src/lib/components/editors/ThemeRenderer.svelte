<script lang="ts">
  import type { Message } from '$lib/types';

  let {
    messages = [],
    htmlTemplate = defaultHtml(),
    cssTemplate = defaultCss(),
    charName = 'Character',
  }: {
    messages: Message[];
    htmlTemplate: string;
    cssTemplate: string;
    charName: string;
  } = $props();

  function defaultHtml(): string {
    return `<div class="message {{role}} {{type}}">
  <div class="name">{{name}}</div>
  <div class="content">{{content}}</div>
</div>`;
  }

  function defaultCss(): string {
    return `.message { padding: 8px 12px; margin: 4px 0; border-radius: 8px; }
.message.user { background: #313244; }
.message.assistant { background: #1e1e2e; }
.name { font-weight: bold; margin-bottom: 2px; }
.content { white-space: pre-wrap; }`;
  }

  /**
   * Sanitize HTML to prevent script execution.
   * Removes <script> tags and on* event handler attributes.
   */
  function sanitizeHtml(html: string): string {
    // Remove <script> tags and their contents
    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove on* event handler attributes (e.g. onclick, onload, onerror)
    clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    // Remove javascript: in href/src attributes
    clean = clean.replace(/(href|src)\s*=\s*["']?\s*javascript:/gi, '$1="');
    return clean;
  }

  /**
   * Sanitize CSS to prevent injection attacks.
   * Removes expressions, url(javascript:), and import statements.
   */
  function sanitizeCss(css: string): string {
    let clean = css;
    // Remove CSS expressions
    clean = clean.replace(/expression\s*\(/gi, '');
    // Remove url(javascript:)
    clean = clean.replace(/url\s*\(\s*["']?\s*javascript:/gi, 'url(');
    // Remove @import
    clean = clean.replace(/@import\b/gi, '/* removed-import */');
    // Remove behavior property (IE-specific)
    clean = clean.replace(/behavior\s*:/gi, '/* removed-behavior */:');
    // Remove -moz-binding (old Firefox)
    clean = clean.replace(/-moz-binding\s*:/gi, '/* removed-binding */:');
    return clean;
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleTimeString();
  }

  function substituteTemplate(template: string, msg: Message): string {
    const name = msg.role === 'user' ? 'You' : charName;
    return template
      .replace(/\{\{name\}\}/g, name)
      .replace(/\{\{content\}\}/g, msg.content)
      .replace(/\{\{type\}\}/g, msg.type)
      .replace(/\{\{role\}\}/g, msg.role)
      .replace(/\{\{timestamp\}\}/g, formatTimestamp(msg.timestamp))
      .replace(/\{\{charName\}\}/g, charName);
  }

  let renderedOutput = $derived(() => {
    const safeCss = sanitizeCss(cssTemplate);
    const renderedMessages = messages
      .map((msg) => sanitizeHtml(substituteTemplate(htmlTemplate, msg)))
      .join('\n');
    return `<style>${safeCss}</style>${renderedMessages}`;
  });
</script>

<div class="theme-renderer-container overflow-y-auto">
  {@html renderedOutput()}
</div>
