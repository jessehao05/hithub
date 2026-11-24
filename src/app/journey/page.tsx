import { readFile } from 'node:fs/promises';
import path from 'node:path';
import GithubSlugger from 'github-slugger';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';
import Markdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';

/**
 * The table of contents is built from the same markdown the page renders.
 * rehype-slug ids each heading with github-slugger over its text, so slugging
 * the same text in the same order here gives ids that match.
 */
function headingsOf(markdown: string) {
  const slugger = new GithubSlugger();
  return fromMarkdown(markdown)
    .children.filter((node) => node.type === 'heading')
    .map((heading) => {
      const text = toString(heading);
      return { depth: heading.depth, text, id: slugger.slug(text) };
    });
}

export default async function Journey() {
  const markdown = await readFile(path.join(process.cwd(), 'src/content/journey.md'), 'utf8');
  const headings = headingsOf(markdown);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-8 py-16 md:flex-row">
      <nav className="shrink-0 text-sm md:sticky md:top-8 md:w-56 md:self-start">
        <ul className="flex flex-col gap-1">
          {headings.map((heading) => (
            <li key={heading.id} style={{ paddingLeft: `${(heading.depth - 1) * 12}px` }}>
              <a href={`#${heading.id}`} className="block py-0.5 text-muted hover:text-foreground">
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="markdown min-w-0 flex-1">
        <Markdown rehypePlugins={[rehypeSlug]}>{markdown}</Markdown>
      </article>
    </main>
  );
}
