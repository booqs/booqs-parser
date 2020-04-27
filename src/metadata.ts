import { BooqMeta } from 'booqs-core';
import { EpubFile } from './epubFile';

export async function getMetadata(epub: EpubFile): Promise<BooqMeta> {
    return epub.metadata;
}
