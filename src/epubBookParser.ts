import {
    BooqNode, Result, Diagnostic, Booq, flatten,
} from 'booqs-core';
import { xmlStringParser, xml2string, XmlElement } from './xmlTree';
import { epubFileParser, EpubSection, EpubFile } from './epubFileParser';
import { processXmls } from './node';
import { parseCss, Stylesheet } from './css';

export async function parseEpub({ filePath }: {
    filePath: string,
}): Promise<Result<Booq>> {
    const { value: epub, ...rest } = await epubFileParser({ filePath });
    if (!epub) {
        return rest;
    }

    const nodes: BooqNode[] = [];
    const diags: Diagnostic[] = [];
    for await (const section of epub.sections()) {
        const result = await parseSection(section, epub);
        if (result.value) {
            nodes.push(...result.value);
        }
        if (result.diags) {
            diags.push(...result.diags);
        }
    }

    return {
        value: {
            nodes,
            meta: {},
            toc: {
                title: undefined,
                items: [],
                length: 0,
            },
        },
        diags,
    };
}

async function parseSection(section: EpubSection, file: EpubFile): Promise<Result<BooqNode[]>> {
    const bodyResult = await getBody(section, file);
    if (!bodyResult.value) {
        return bodyResult;
    }

    const { value: { body } } = bodyResult;
    const results = await processXmls(body.children, {
        filePath: section.filePath,
        imageResolver: file.itemResolver,
    });

    return {
        value: results.map(r => r.value),
        diags: [...bodyResult.diags ?? [], ...flatten(results.map(r => r.diags ?? []))],
    };
}

async function getBody(section: EpubSection, file: EpubFile) {
    const { value: document, diags } = xmlStringParser({
        xmlString: section.content,
        removeTrailingWhitespaces: false,
    });
    if (!document) {
        return { diags };
    }
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        return {
            value: undefined,
            diags: [{
                diag: 'no-html',
                data: { xml: xml2string(document) },
            }],
        };
    }

    let styles: Stylesheet[] = [];
    const head = html.children
        .find(n => n.name === 'head');
    if (head?.name !== undefined) {
        const cssResult = await loadCss(head, file.itemResolver);
        styles = cssResult.value ?? [];
        diags?.push(...cssResult.diags ?? []);
    }
    const body = html.children
        .find(n => n.name === 'body');
    if (body === undefined || body.type !== 'element') {
        return {
            value: undefined,
            diags: [{
                diag: 'no-body',
                data: { xml: xml2string(html) },
            }],
        };
    }

    return { value: { body, styles } };
}

async function loadCss(head: XmlElement, itemResolver: (id: string) => Promise<Buffer | undefined>) {
    const results: Stylesheet[] = [];
    const diags: Diagnostic[] = [];
    for (const el of head.children) {
        if (el.name === 'link' && el.attributes.rel === 'stylesheet') {
            if (el.attributes.href === undefined) {
                diags.push({
                    diag: 'missing href on link',
                    data: el,
                });
            } else {
                const buffer = await itemResolver(el.attributes.href);
                if (buffer === undefined) {
                    diags.push({
                        diag: `couldn't load css: ${el.attributes.href}`,
                    });
                } else {
                    const content = buffer.toString('utf8');
                    const result = parseCss(content);
                    if (result.value) {
                        results.push(result.value);
                    }
                    diags.push(...result.diags ?? []);
                }
            }
        }
    }

    return {
        value: results,
        diags,
    };
}
