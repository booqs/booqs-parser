import { Result } from 'booqs-core';

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
