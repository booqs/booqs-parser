import { regex, project, Parser, choice, sequence, oneOrMore } from './stringParser';
import { Result } from './result';
import { assertNever } from 'booqs-core';
import { Xml } from './xmlTree';

type UniversalSelector = {
    selector: 'universal',
};
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
    | UniversalSelector | ElementSelector | ClassSelector | IdSelector;

type DescendantSelector = {
    selector: 'descendant',
    ancestor: Selector,
    descendant: Selector,
};
type OrSelector = {
    selector: 'or',
    selectors: Selector[],
};
type AndSelector = {
    selector: 'and',
    selectors: Selector[],
};

type CompositeSelector =
    | DescendantSelector | OrSelector | AndSelector;

export type Selector = SimpleSelector | CompositeSelector;

export function selectXml(xml: Xml, selector: Selector): boolean {
    switch (selector.selector) {
        case 'universal':
            return true;
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
        case 'or':
            return selector.selectors
                .some(sel => selectXml(xml, sel));
        case 'and':
            return selector.selectors
                .every(sel => selectXml(xml, sel));
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
const universalSel: SelectorParser = project(
    regex(/\*/),
    () => ({ selector: 'universal' }),
);
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
const atomSel = choice(
    universalSel, elementSel, classSel, idSel,
);

const andSel: SelectorParser = project(
    oneOrMore(atomSel),
    selectors => ({
        selector: 'and',
        selectors,
    }),
);

const descendantSel: SelectorParser = project(
    sequence(andSel, regex(/ /), andSel),
    ([ancestor, , descendant]) => ({
        selector: 'descendant',
        ancestor, descendant,
    }),
);
const compositeSel = choice(descendantSel, andSel);

const selectorParser = compositeSel;
