import { EPub } from 'epub2';
import { Result } from 'booqs-core';

export type EpubSection = {
    filePath: string,
    id: string,
    content: string,
};
export type EpubMetadata = {
    [key: string]: string | string[] | undefined,
};
export type EpubFile = {
    rawMetadata: any,
    metadata: EpubMetadata,
    itemResolver(id: string): Promise<Buffer | undefined>,
    sections(): AsyncGenerator<EpubSection>,
};

export async function epubFileParser({ filePath }: {
    filePath: string,
}): Promise<Result<EpubFile>> {
    try {
        const epub = await FixedEpub.createAsync(filePath) as FixedEpub;

        const book: EpubFile = {
            rawMetadata: getRawData(epub.metadata),
            metadata: extractMetadata(epub),
            itemResolver: async href => {
                const items = listItems(epub);
                const idItem = items
                    .find(item => item.href && item.href.endsWith(href));
                if (!idItem || !idItem.id) {
                    return undefined;
                }
                const [buffer] = await epub.getImageAsync(idItem.id);
                return buffer;
            },
            sections: async function* () {
                for (const el of epub.flow) {
                    if (el.id && el.href) {
                        // NOTE: couldn't find better solution
                        const comps = el.href.split('/');
                        const href = comps[comps.length - 1];
                        const chapter = await epub.chapterForId(el.id);
                        const section: EpubSection = {
                            id: el.id,
                            filePath: href,
                            content: chapter,
                        };
                        yield section;
                    }
                }
            },
        };

        return { value: book };
    } catch (e) {
        return {
            diags: [{
                diag: 'exception on epub open',
                data: e,
            }],
        };
    }
}

class FixedEpub extends EPub {
    static libPromise = Promise;

    // This is workaround for epub2 bug. Remove it once fixed
    walkNavMap(branch: any, path: any, idList: any, level: number, pe?: any, parentNcx?: any, ncxIdx?: any) {
        if (Array.isArray(branch)) {
            branch.forEach(b => {
                if (b.navLabel && b.navLabel.text === '') {
                    b.navLabel.text = ' ';
                }
            });
        }
        return super.walkNavMap(branch, path, idList, level, pe, parentNcx, ncxIdx);
    }

    chapterForId(id: string): Promise<string> {
        return this.getChapterRawAsync(id);
    }
}

function extractMetadata(epub: EPub): EpubMetadata {
    const metadata = { ...epub.metadata } as any;
    const coverId = metadata.cover;
    if (coverId) {
        const items = listItems(epub);
        const coverItem = items
            .find(item => item.id === coverId);
        metadata.cover = coverItem !== undefined
            ? coverItem.href
            : undefined;
    }
    const raw = getRawData(epub.metadata);
    metadata['dc:rights'] = raw['dc:rights'];
    metadata['dc:identifier'] = raw['dc:identifier'];

    return metadata;
}

function getRawData(object: any): any {
    const symbol = EPub.SYMBOL_RAW_DATA;
    return object[symbol];
}

function listItems(epub: EPub) {
    return epub.listImage();
}
