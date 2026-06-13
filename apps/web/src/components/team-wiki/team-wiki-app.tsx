"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  Hash,
  Search,
  Star,
  Tag,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import {
  WIKI_PAGES,
  WIKI_SPACES,
  buildPageTree,
  extractHeadings,
  getPageById,
  pageBreadcrumb,
  pagesForSpace,
  type WikiPage,
} from "@/lib/team-wiki/mock-data";
import { cn } from "@/lib/utils";

function formatDaDate(iso: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function renderMarkdownBody(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = content.split("\n");
  let listItems: string[] = [];
  let blockquote: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`list-${key++}`} className="team-wiki__list">
        {listItems.map((item) => (
          <li key={item}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  const flushQuote = () => {
    if (blockquote.length === 0) return;
    nodes.push(
      <blockquote key={`quote-${key++}`} className="team-wiki__quote">
        {blockquote.map((line) => (
          <p key={line}>{renderInline(line.replace(/^>\s?/, ""))}</p>
        ))}
      </blockquote>,
    );
    blockquote = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith(">")) {
      flushList();
      blockquote.push(line);
      continue;
    }
    flushQuote();

    if (/^[-*]\s/.test(line.trim())) {
      listItems.push(line.trim().replace(/^[-*]\s+/, ""));
      continue;
    }
    flushList();

    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9æøå]+/gi, "-")
        .replace(/^-|-$/g, "");
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      nodes.push(
        <Tag key={`h-${key++}`} id={id} className={`team-wiki__h${level}`}>
          {renderInline(text)}
        </Tag>,
      );
      continue;
    }

    if (line.trim() === "") {
      continue;
    }

    nodes.push(
      <p key={`p-${key++}`} className="team-wiki__paragraph">
        {renderInline(line)}
      </p>,
    );
  }

  flushList();
  flushQuote();
  return nodes;
}

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="team-wiki__code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function PageTreeNode({
  node,
  depth,
  activePageId,
  expandedIds,
  onToggle,
  onSelect,
}: {
  node: { page: WikiPage; children: ReturnType<typeof buildPageTree> };
  depth: number;
  activePageId: string;
  expandedIds: Set<string>;
  onToggle: (pageId: string) => void;
  onSelect: (pageId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.page.id);
  const active = node.page.id === activePageId;

  return (
    <li className="team-wiki__tree-item">
      <div
        className={cn("team-wiki__tree-row", active && "team-wiki__tree-row--active")}
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="team-wiki__tree-toggle"
            aria-label={expanded ? "Fold sammen" : "Fold ud"}
            onClick={() => onToggle(node.page.id)}
          >
            {expanded ? (
              <ChevronDown className="size-3.5" aria-hidden />
            ) : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <span className="team-wiki__tree-spacer" aria-hidden />
        )}
        <button
          type="button"
          className="team-wiki__tree-link"
          onClick={() => onSelect(node.page.id)}
        >
          <FileText className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{node.page.title}</span>
        </button>
      </div>
      {hasChildren && expanded ? (
        <ul className="team-wiki__tree-children">
          {node.children.map((child) => (
            <PageTreeNode
              key={child.page.id}
              node={child}
              depth={depth + 1}
              activePageId={activePageId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TeamWikiApp() {
  const [spaceId, setSpaceId] = useState(WIKI_SPACES[0].id);
  const [activePageId, setActivePageId] = useState(WIKI_SPACES[0].homePageId);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(WIKI_PAGES.map((page) => page.id)),
  );

  const space = WIKI_SPACES.find((item) => item.id === spaceId) ?? WIKI_SPACES[0];
  const spacePages = useMemo(() => pagesForSpace(space), [space]);
  const activePage = getPageById(activePageId) ?? getPageById(space.homePageId)!;
  const breadcrumb = pageBreadcrumb(activePage.id, spacePages);
  const tree = buildPageTree(spacePages);
  const headings = extractHeadings(activePage.content);

  const filteredTree = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return tree;

    const matchingIds = new Set(
      spacePages
        .filter(
          (page) =>
            page.title.toLowerCase().includes(needle) ||
            page.labels.some((label) => label.toLowerCase().includes(needle)),
        )
        .map((page) => page.id),
    );

    function filterNodes(nodes: typeof tree): typeof tree {
      return nodes
        .map((node) => ({
          ...node,
          children: filterNodes(node.children),
        }))
        .filter((node) => matchingIds.has(node.page.id) || node.children.length > 0);
    }

    return filterNodes(tree);
  }, [searchQuery, spacePages, tree]);

  const handleSpaceChange = (nextSpaceId: string) => {
    const nextSpace = WIKI_SPACES.find((item) => item.id === nextSpaceId);
    if (!nextSpace) return;
    setSpaceId(nextSpaceId);
    setActivePageId(nextSpace.homePageId);
    setSearchQuery("");
  };

  const handleToggle = (pageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  return (
    <div className="team-wiki">
      <header className="team-wiki__header">
        <div className="team-wiki__header-main">
          <div className="team-wiki__space-badge">
            <BookOpen className="size-4" aria-hidden />
            <span className="font-semibold">{space.name}</span>
            <span className="team-wiki__prototype-pill">Prototype</span>
          </div>
          <nav className="team-wiki__breadcrumb" aria-label="Brødkrumme">
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.id} className="team-wiki__breadcrumb-item">
                {index > 0 ? <span aria-hidden>/</span> : null}
                <button
                  type="button"
                  className={cn(index === breadcrumb.length - 1 && "team-wiki__breadcrumb-current")}
                  onClick={() => setActivePageId(crumb.id)}
                >
                  {crumb.title}
                </button>
              </span>
            ))}
          </nav>
        </div>
        <div className="team-wiki__header-actions">
          <label className="team-wiki__search">
            <Search className="size-4 shrink-0 opacity-70" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Søg i sider og mærkater…"
              aria-label="Søg i wiki"
            />
          </label>
          <button type="button" className="team-wiki__action-btn" disabled title="Kommer senere">
            <Edit3 className="size-4" aria-hidden />
            Rediger
          </button>
        </div>
      </header>

      <div className="team-wiki__body">
        <aside className="team-wiki__sidebar" aria-label="Sidetræ">
          <div className="team-wiki__sidebar-section">
            <label className="team-wiki__sidebar-label" htmlFor="team-wiki-space">
              Rum
            </label>
            <select
              id="team-wiki-space"
              className="team-wiki__space-select"
              value={spaceId}
              onChange={(event) => handleSpaceChange(event.target.value)}
            >
              {WIKI_SPACES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.key} — {item.name}
                </option>
              ))}
            </select>
            <p className="team-wiki__space-desc">{space.description}</p>
          </div>

          <p className="team-wiki__sidebar-heading">Sider</p>
          <ul className="team-wiki__tree">
            {filteredTree.map((node) => (
              <PageTreeNode
                key={node.page.id}
                node={node}
                depth={0}
                activePageId={activePage.id}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onSelect={setActivePageId}
              />
            ))}
          </ul>
        </aside>

        <article className="team-wiki__content">
          <div className="team-wiki__content-inner">
            <h1 className="team-wiki__page-title">{activePage.title}</h1>
            <div className="team-wiki__meta">
              <span className="team-wiki__meta-item">
                <Clock className="size-3.5" aria-hidden />
                Opdateret {formatDaDate(activePage.updatedAt)} af {activePage.updatedBy}
              </span>
              {activePage.labels.length > 0 ? (
                <span className="team-wiki__meta-item">
                  <Tag className="size-3.5" aria-hidden />
                  {activePage.labels.map((label) => (
                    <span key={label} className="team-wiki__label">
                      {label}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            <div className="team-wiki__markdown">{renderMarkdownBody(activePage.content)}</div>
            <footer className="team-wiki__footer-note">
              <Star className="size-3.5" aria-hidden />
              Teamwiki — demo-indhold. Fremtidig integration med vidensartikler eller dedikeret wiki-API.
            </footer>
          </div>
        </article>

        {headings.length > 0 ? (
          <aside className="team-wiki__toc" aria-label="Indholdsfortegnelse">
            <p className="team-wiki__sidebar-heading">
              <Hash className="inline size-3.5 opacity-70" aria-hidden /> Indhold
            </p>
            <ul className="team-wiki__toc-list">
              {headings.map((heading) => (
                <li
                  key={heading.id}
                  className={cn(
                    "team-wiki__toc-item",
                    `team-wiki__toc-item--level-${heading.level}`,
                  )}
                >
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
