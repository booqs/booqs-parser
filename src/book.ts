import {
    BooqNode, Booq,
} from 'booqs-core';
import { EpubFile } from './epubFile';
import { Result, Diagnostic } from './result';
import { parseSection } from './section';
import { buildImages } from './images';
import { buildToc } from './toc';
import { getMetadata } from './metadata';

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

    const { value: toc, diags: tocDiags } = await buildToc(nodes, epub);
    diags.push(...tocDiags);

    return {
        value: {
            nodes,
            meta: await getMetadata(epub),
            toc: toc ?? {
                title: undefined,
                items: [],
                length: 0,
            },
            images: images ?? {},
        },
        diags,
    };
}
