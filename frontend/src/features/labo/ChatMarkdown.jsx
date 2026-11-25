const bullet = /^\s*[-*+]\s+(.*)$/;
const emphasis = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*|(?<!\w)__[^_\n]+__(?!\w)|(?<!\w)_[^_\n]+_(?!\w))/g;

function inline(text) {
  return text.split(emphasis).map((part, index) => {
    if (index % 2 === 0) {
      const plain = part.replace(/\*{2,}/g, '').replace(/\n([ \t]*)\*/g, '\n$1');
      return index === 0 ? plain.replace(/^([ \t]*)\*/, '$1') : plain;
    }
    if (part.startsWith('***')) return <strong key={index}><em>{part.slice(3, -3)}</em></strong>;
    if (part.startsWith('**') || part.startsWith('__')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return <em key={index}>{part.slice(1, -1)}</em>;
  });
}

export default function ChatMarkdown({ text }) {
  const blocks = [];
  for (const line of text.split(/\r?\n/)) {
    const item = bullet.exec(line);
    const list = Boolean(item);
    if (blocks.at(-1)?.list !== list) blocks.push({ list, lines: [] });
    blocks.at(-1).lines.push(item ? item[1] : line);
  }
  // Only React elements and text nodes are emitted, including for raw HTML in a reply.
  return <div className="labo-markdown">
    {blocks.map(({ list, lines }, index) => list
      ? <ul key={index}>{lines.map((line, item) => <li key={item}>{inline(line)}</li>)}</ul>
      : <div key={index}>{inline(lines.join('\n'))}</div>)}
  </div>;
}
