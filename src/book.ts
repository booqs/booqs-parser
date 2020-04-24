import {
    BooqNode, Booq,
} from 'booqs-core';
import { EpubFile } from './epubFile';
import { Result, Diagnostic } from './result';
import { parseSection } from './section';
import { buildImages } from './images';

export async function processEpub(epub: EpubFile): Promise<Result<Booq>> {
    const diags: Diagnostic[] = [];
    const nodes: BooqNode[] = [];
    for await (const section of epub.sections()) {
        const { value, diags: sectionDiags } = await parseSection(section, epub);
        diags.push(...sectionDiags);
        if (!value) {
            return { diags };
        }
        nodes.push(...value);
    }

    const { value: images, diags: imagesDiags } = await buildImages(nodes, epub);
    diags.push(...imagesDiags);

    return {
        value: {
            nodes,
            meta: epub.metadata,
            toc: {
                title: undefined,
                items: [],
                length: 0,
            },
            images: images ?? {},
        },
        diags,
    };
}
