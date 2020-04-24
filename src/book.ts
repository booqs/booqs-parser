import {
    BooqNode, Booq,
} from 'booqs-core';
import { xmlStringParser, xml2string, XmlElement } from './xmlTree';
import { EpubSection, EpubFile } from './epubFile';
import { processXmls } from './node';
import { parseCss, Stylesheet, StyleRule } from './css';
import { Result, Diagnostic } from './result';

export async function processEpub(epub: EpubFile): Promise<Result<Booq>> {
    const diags: Diagnostic[] = [];
    const nodes: BooqNode[] = [];
    for await (const section of epub.sections()) {
        const { value, diags: sectionDiags } = await parseSection(section, epub);
        if (value) {
            nodes.push(...value);
        }
        diags.push(...sectionDiags);
    }

    return {
        value: {
            nodes,
            meta: epub.metadata,
            toc: {
                title: undefined,
                items: [],
                length: 0,
            },
            images: {},
        },
        diags,
    };
}

async function parseSection(section: EpubSection, file: EpubFile): Promise<Result<BooqNode[]>> {
    const diags: Diagnostic[] = [];
    const { value: bodyResult, diags: bodyDiags } = await getBody(section, file);
    diags.push(...bodyDiags);
    if (!bodyResult) {
        return { diags };
    }

    const { body, stylesheet } = bodyResult;
    const nodes = await processXmls(body.children, {
        filePath: section.filePath,
        stylesheet,
        report: diag => diags.push(diag),
    });
    return {
        value: nodes,
        diags,
    };
}

async function getBody(section: EpubSection, file: EpubFile) {
    const diags: Diagnostic[] = [];
    const { value: document, diags: xmlDiags } = xmlStringParser({
        xmlString: section.content,
        removeTrailingWhitespaces: false,
    });
    diags.push(...xmlDiags);
    if (!document) {
        return { diags };
    }
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        diags.push({
            diag: 'no-html',
            data: { xml: xml2string(document) },
        });
        return { diags };
    }

    let stylesheet: Stylesheet = { rules: [] };
    const head = html.children
        .find(n => n.name === 'head');
    if (head?.name !== undefined) {
        const { value: loaded, diags: cssDiags } = await loadCss(head, file.itemResolver);
        diags.push(...cssDiags);
        stylesheet = loaded ?? stylesheet;
    }
    const body = html.children
        .find(n => n.name === 'body');
    if (body === undefined || body.type !== 'element') {
        diags.push({
            diag: 'no-body',
            data: { xml: xml2string(html) },
        });
        return { diags };
    }

    return {
        value: { body, stylesheet },
        diags,
    };
}

async function loadCss(head: XmlElement, itemResolver: (id: string) => Promise<Buffer | undefined>) {
    const diags: Diagnostic[] = [];
    const rules: StyleRule[] = [];
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
                        rules.push(...result.value.rules);
                    }
                    diags.push(...result.diags);
                }
            }
        }
    }
    return {
        value: { rules },
        diags,
    };
}
