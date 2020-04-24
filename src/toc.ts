import { BooqNode, TableOfContentsItem, iterateNodes, TableOfContents } from 'booqs-core';
import { EpubFile } from './epubFile';
import { Diagnostic, Result } from './result';

export async function buildToc(nodes: BooqNode[], file: EpubFile): Promise<Result<TableOfContents>> {
    const diags: Diagnostic[] = [];
    const items: TableOfContentsItem[] = [];
    let epubToc = Array.from(file.toc());
    const iter = iterateNodes(nodes);
    let next = iter.next();
    while (!next.done) {
        const { node, path, position } = next.value;
        const epubItem = epubToc.find(i => i.href === node.id);
        if (epubItem) {
            items.push({
                title: epubItem.title,
                level: epubItem.level ?? 0,
                position,
                path,
            });
            epubToc = epubToc.filter(i => i !== epubItem);
        }
        next = iter.next();
    }
    if (epubToc.length) {
        diags.push({
            diag: 'Unresolved toc items',
            data: { epubToc },
        });
    }
    const length = next.value;
    const title = typeof file.metadata.title === 'string'
        ? file.metadata.title
        : undefined;

    return {
        value: {
            title,
            items,
            length,
        },
        diags,
    };
}