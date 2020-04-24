import { BooqNode, flatten, BooqNodeStyle } from 'booqs-core';
import {
    xmlStringParser, xml2string, XmlElement, XmlDocument, Xml, isWhitespaces,
} from './xmlTree';
import { EpubSection, EpubFile } from './epubFile';
import { parseCss, Stylesheet, StyleRule, parseInlineStyle } from './css';
import { Result, Diagnostic } from './result';
import { selectXml } from './selectors';

export async function parseSection(section: EpubSection, file: EpubFile): Promise<Result<BooqNode[]>> {
    const diags: Diagnostic[] = [];
    const nodes = await processSectionContent(section.content, {
        fileName: section.fileName,
        stylesheet: { rules: [] },
        report: d => diags.push(d),
        resolveTextFile: async href => {
            const buffer = await file.itemResolver(href);
            return buffer
                ? Buffer.from(buffer).toString('utf8')
                : undefined;
        },
    });
    return {
        value: nodes,
        diags,
    };
}

type Env = {
    fileName: string,
    stylesheet: Stylesheet,
    report: (diag: Diagnostic) => void,
    resolveTextFile: (href: string) => Promise<string | undefined>,
};

async function processSectionContent(content: string, env: Env) {
    const { value, diags } = xmlStringParser({
        xmlString: content,
        removeTrailingWhitespaces: false,
    });
    diags.forEach(d => env.report(d));
    return value && processDocument(value, env);
}

async function processDocument(document: XmlDocument, env: Env) {
    let html: XmlElement | undefined = undefined;
    for (const ch of document.children) {
        if (ch.name === 'html') {
            html = ch;
        } else {
            env.report({
                diag: 'unexpected root element',
                data: { xml: xml2string(ch) },
            });
        }
    }
    if (html === undefined) {
        env.report({
            diag: 'no html element',
            data: { xml: xml2string(document) },
        });
        return undefined;
    } else {
        return processHtml(html, env);
    }
}


async function processHtml(html: XmlElement, env: Env) {
    let body: XmlElement | undefined = undefined;
    let head: XmlElement | undefined = undefined;
    for (const ch of html.children) {
        switch (ch.name) {
            case 'body':
                body = ch;
                break;
            case 'head':
                head = ch;
                break;
            default:
                if (!isEmptyText(ch)) {
                    env.report({
                        diag: 'unexpected node in <html>',
                        data: { xml: xml2string(ch) },
                    });
                }
        }
    }
    if (!body) {
        env.report({
            diag: 'missing body node',
            data: { xml: xml2string(html) },
        });
        return undefined;
    } else {
        const stylesheet = head && await processHead(head, env);
        return processBody(body, {
            ...env,
            stylesheet: stylesheet ?? env.stylesheet,
        });
    }
}

async function processHead(head: XmlElement, env: Env) {
    const rules: StyleRule[] = [];
    for (const ch of head.children) {
        switch (ch.name) {
            case 'link': {
                const fromLink = await processLink(ch, env);
                rules.push(...fromLink);
                break;
            }
            case 'style': {
                const fromStyle = await processStyle(ch, env);
                rules.push(...fromStyle);
                break;
            }
            case 'title':
            case 'meta':
                // TODO: handle ?
                break;
            default:
                if (!isEmptyText(ch)) {
                    env.report({
                        diag: 'unexpected head node',
                        data: { xml: xml2string(ch) },
                    });
                }
        }
    }
    return { rules };
}

async function processLink(link: XmlElement, env: Env) {
    const { rel, href, type } = link.attributes;
    switch (rel?.toLowerCase()) {
        case 'stylesheet':
            break;
        case 'coverpage':
            return [];
        default:
            env.report({
                diag: `unexpected link rel: ${rel}`,
                data: { xml: xml2string(link) },
            });
            return [];
    }
    switch (type?.toLowerCase()) {
        case 'text/css':
            break;
        // Note: known unsupported
        case 'application/vnd.adobe-page-template+xml':
            return [];
        // Note: unknown unsupported
        default:
            env.report({
                diag: `unexpected link type: ${type}`,
            });
            return [];
    }
    if (href === undefined) {
        env.report({
            diag: 'missing href on link',
            data: { xml: xml2string(link) },
        });
        return [];
    }
    const content = await env.resolveTextFile(href);
    if (content === undefined) {
        env.report({
            diag: `couldn't load css: ${href}`,
        });
        return [];
    } else {
        const { value, diags } = parseCss(content, href);
        diags.forEach(d => env.report(d));
        return value?.rules ?? [];
    }
}

async function processStyle(style: XmlElement, env: Env) {
    const content = style.children[0];
    if (style.attributes.type !== 'text/css' || style.children.length !== 1 || content.type !== 'text') {
        env.report({
            diag: 'unsupported style tag',
            data: { xml: xml2string(style) },
        });
        return [];
    }
    const { value, diags } = parseCss(content.text, `${env.fileName}: <style>`);
    diags.forEach(d => env.report(d));
    return value?.rules ?? [];
}

async function processBody(body: XmlElement, env: Env) {
    const nodes = await processBodyXmls(body.children, env);
    const head = sectionNode(env.fileName);
    return [head, ...nodes];
}

function sectionNode(fileName: string): BooqNode {
    return {
        id: fileName,
    };
}

async function processBodyXmls(xmls: Xml[], env: Env) {
    return Promise.all(
        xmls.map(n => processBodyXml(n, env)),
    );
}

async function processBodyXml(xml: Xml, env: Env): Promise<BooqNode> {
    switch (xml.type) {
        case 'text':
            return {
                content: xml.text,
            };
        case 'element':
            return processXmlElement(xml, env);
        default:
            env.report({
                diag: 'unexpected node',
                data: { xml: xml2string(xml) },
            });
            return {};
    }
}

async function processXmlElement(element: XmlElement, env: Env): Promise<BooqNode> {
    const result: BooqNode = {};
    const { id, class: _, ...rest } = element.attributes;
    if (id !== undefined) {
        result.id = fullId(id, env.fileName);
    }
    const style = getStyle(element, env);
    if (style) {
        result.style = style;
    }
    if (Object.keys(rest).length > 0) {
        result.attrs = rest;
        if (result.attrs.href) {
            result.attrs.href = fixHref(result.attrs.href);
        }
    }
    if (element.children) {
        const children = await processBodyXmls(element.children, env);
        result.children = children;
    }
    return result;
}

function fullId(id: string, fileName: string) {
    // return `${fileName}/${id}`;
    return `${fileName}#${id}`;
}

function fixHref(href: string) {
    // return href.replace('#', '/');
    return href;
}

function getStyle(xml: Xml, env: Env) {
    const rules = getRules(xml, env);
    const declarations = flatten(rules.map(r => r.content));
    if (declarations.length === 0) {
        return undefined;
    }
    const style: BooqNodeStyle = {};
    for (const decl of declarations) {
        style[decl.property] = decl.value;
    }
    return style;
}

function getRules(xml: Xml, env: Env) {
    const cssRules = env.stylesheet.rules.filter(
        rule => selectXml(xml, rule.selector),
    );
    const inline = xml.attributes?.style;
    if (inline) {
        const { value, diags } = parseInlineStyle(inline, `${env.fileName}: <${xml.name} style>`);
        diags.forEach(d => env.report(d));
        const inlineRules = value ?? [];
        return [...cssRules, ...inlineRules];
    } else {
        return cssRules;
    }
}

function isEmptyText(xml: Xml) {
    return xml.type === 'text' && isWhitespaces(xml.text);
}
