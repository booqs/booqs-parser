import { BooqNode, BooqImages, unique } from 'booqs-core';
import { EpubFile } from './epubFile';
import { Diagnostic } from './result';

export async function buildImages(nodes: BooqNode[], file: EpubFile) {
    const diags: Diagnostic[] = [];
    const srcs = collectImgSrcs(nodes);
    const cover = file.metadata.cover;
    const allSrcs = typeof cover === 'string'
        ? [cover, ...srcs]
        : srcs;
    const uniqueSrcs = unique(allSrcs);
    const images: BooqImages = {};
    for (const src of uniqueSrcs) {
        if (isExternal(src)) {
            continue;
        }
        const buffer = await file.imageResolver(src);
        if (buffer) {
            const image = Buffer.from(buffer).toString('base64');
            images[src] = image;
        } else {
            diags.push({
                diag: `Couldn't load image: ${src}`,
            });
        }
    }
    return {
        value: images,
        diags,
    };
}

function isExternal(src: string): boolean {
    return src.match(/^www\.[^.]+\.com/) ? true : false;
}

function collectImgSrcs(nodes: BooqNode[]): string[] {
    return nodes.reduce<string[]>(
        (srcs, node) => [...srcs, ...collectImgSrcsFromNode(node)],
        [],
    );
}

function collectImgSrcsFromNode(node: BooqNode): string[] {
    const fromChildren = collectImgSrcs(node.children ?? []);
    const src = node?.attrs?.src;
    return src ? [src, ...fromChildren] : fromChildren;
}