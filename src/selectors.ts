import { regex, project, Parser, choice, sequence } from './stringParser';
import { Result } from './result';
import { assertNever } from 'booqs-core';
import { Xml } from './xmlTree';

type ElementSelector = {
    selector: 'element',
    name: string,
};
type ClassSelector = {
    selector: 'class',
    class: string,
};
type IdSelector = {
    selector: 'id',
    id: string,
}

type SimpleSelector =
    | ElementSelector | ClassSelector | IdSelector;

type DescendantSelector = {
    selector: 'descendant',
    ancestor: Selector,
    descendant: Selector,
};

type CompositeSelector = DescendantSelector;

export type Selector = SimpleSelector | CompositeSelector;

export function selectXml(xml: Xml, selector: Selector) {
    switch (selector.selector) {
        case 'class':
            return hasClass(xml, selector.class);
        case 'id':
            return xml.attributes?.id === selector.id;
        case 'element':
            return xml.name === selector.name;
        case 'descendant': {
            if (selectXml(xml, selector.descendant)) {
                while (xml.parent) {
                    if (selectXml(xml.parent, selector.ancestor)) {
                        return true;
                    }
                    xml = xml.parent;
                }
            }
            return false;
        }
        default:
            assertNever(selector);
            return false;
    }
}

function hasClass(xml: Xml, cls: string) {
    const classes = xml.attributes?.class;
    if (!classes) {
        return false;
    } else {
        cls = cls.toLowerCase();
        return classes
            .toLowerCase()
            .split(' ')
            .some(c => c === cls);
    }
}

export function parseSelector(sel: string): Result<Selector> {
    const result = selectorParser(sel);
    if (result.success) {
        // TODO: assert empty next
        return { value: result.value, diags: [] };
    } else {
        return {
            diags: [{
                diag: `Unsupported selector: ${sel}`,
            }],
        };
    }
}

type SelectorParser = Parser<Selector>;
const elementSel: SelectorParser = project(
    regex(/[a-z]+/),
    name => ({
        selector: 'element',
        name,
    }),
);
const classSel: SelectorParser = project(
    regex(/\.[a-z]+/),
    cls => ({
        selector: 'class',
        class: cls,
    }),
);
const idSel: SelectorParser = project(
    regex(/#[a-z]+/),
    id => ({
        selector: 'id',
        id,
    }),
);
const simpleSel = choice(elementSel, classSel, idSel);

const descendantSel: SelectorParser = project(
    sequence(simpleSel, regex(/ /), simpleSel),
    ([ancestor, , descendant]) => ({
        selector: 'descendant',
        ancestor, descendant,
    }),
);
const compositeSel = choice(descendantSel);

const selectorParser = choice(compositeSel, simpleSel);
