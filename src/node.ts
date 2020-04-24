import { BooqNode, BooqNodeStyle, flatten } from 'booqs-core';
import { Xml, XmlElement, xml2string } from './xmlTree';
import { Diagnostic } from './result';
import { Stylesheet } from './css';
import { selectXml } from './selectors';

type Env = {
    filePath: string,
    stylesheet: Stylesheet,
    report: (diag: Diagnostic) => void,
};
export async function processXmls(xmls: Xml[], env: Env) {
    return Promise.all(
        xmls.map(n => processXml(n, env)),
    );
}

async function processXml(xml: Xml, env: Env): Promise<BooqNode> {
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
        result.id = fullId(id, env.filePath);
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
        const children = await processXmls(element.children, env);
        result.children = children;
    }
    return result;
}

function fullId(id: string, filePath: string) {
    return `${filePath}/${id}`;
}

function fixHref(href: string) {
    return href.replace('#', '/');
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
    return env.stylesheet.rules.filter(
        rule => selectXml(xml, rule.selector),
    );
}
