import {
    BooqNode, Booq,
} from 'booqs-core';
import { xmlStringParser, xml2string, XmlElement } from './xmlTree';
import { epubFileParser, EpubSection, EpubFile } from './epubFileParser';
import { processXmls } from './node';
import { parseCss, Stylesheet, StyleRule } from './css';
import { Result, genAsyncResult } from './result';

export async function parseEpub({ filePath }: {
    filePath: string,
}): Promise<Result<Booq>> {
    return genAsyncResult(async function* () {
        const { value: epub, diags } = await epubFileParser({ filePath });
        yield* diags;
        if (!epub) {
            return;
        }

        const nodes: BooqNode[] = [];
        for await (const section of epub.sections()) {
            const result = await parseSection(section, epub);
            if (result.value) {
                nodes.push(...result.value);
            }
            yield* result.diags;
        }

        return {
            nodes,
            meta: {},
            toc: {
                title: undefined,
                items: [],
                length: 0,
            },
            images: {},
        };
    });
}

async function parseSection(section: EpubSection, file: EpubFile): Promise<Result<BooqNode[]>> {
    return genAsyncResult(async function* () {
        const { value: bodyResult, diags: bodyDiags } = await getBody(section, file);
        yield* bodyDiags;
        if (!bodyResult) {
            return;
        }

        const { body, stylesheet } = bodyResult;
        const results = await processXmls(body.children, {
            filePath: section.filePath,
            imageResolver: file.itemResolver,
            stylesheet,
        });
        for (const r of results) {
            yield* r.diags;
        }
        return results.map(r => r.value);
    });
}

async function getBody(section: EpubSection, file: EpubFile) {
    return genAsyncResult(async function* () {
        const { value: document, diags: xmlDiags } = xmlStringParser({
            xmlString: section.content,
            removeTrailingWhitespaces: false,
        });
        yield* xmlDiags;
        if (!document) {
            return;
        }
        const html = document.children
            .find(n => n.name === 'html');
        if (html === undefined || html.type !== 'element') {
            yield {
                diag: 'no-html',
                data: { xml: xml2string(document) },
            };
            return;
        }

        let stylesheet: Stylesheet = { rules: [] };
        const head = html.children
            .find(n => n.name === 'head');
        if (head?.name !== undefined) {
            const cssResult = await loadCss(head, file.itemResolver);
            yield* cssResult.diags;
            stylesheet = cssResult.value ?? stylesheet;
        }
        const body = html.children
            .find(n => n.name === 'body');
        if (body === undefined || body.type !== 'element') {
            yield {
                diag: 'no-body',
                data: { xml: xml2string(html) },
            };
            return;
        }

        return { body, stylesheet };
    });
}

async function loadCss(head: XmlElement, itemResolver: (id: string) => Promise<Buffer | undefined>) {
    return genAsyncResult(async function* () {
        const rules: StyleRule[] = [];
        for (const el of head.children) {
            if (el.name === 'link' && el.attributes.rel === 'stylesheet') {
                if (el.attributes.href === undefined) {
                    yield {
                        diag: 'missing href on link',
                        data: el,
                    };
                } else {
                    const buffer = await itemResolver(el.attributes.href);
                    if (buffer === undefined) {
                        yield {
                            diag: `couldn't load css: ${el.attributes.href}`,
                        };
                    } else {
                        const content = buffer.toString('utf8');
                        const result = parseCss(content);
                        if (result.value) {
                            rules.push(...result.value.rules);
                        }
                        yield* result.diags;
                    }
                }
            }
        }
        return { rules };
    });
}
