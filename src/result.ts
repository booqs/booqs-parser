import { flatten } from 'booqs-core';

export type Diagnostic = {
    diag: string,
    severity?: 'error' | 'warning' | 'info',
    data?: object,
};
export type Diagnoser = (diag: Diagnostic) => void;
export type Success<T> = {
    value: T,
    diags: Diagnostic[],
};
export type Failure = {
    value?: undefined,
    diags: Diagnostic[],
};

export type Result<T> = Success<T> | Failure;

export function combineResults<T>(results: Array<Result<T>>): Result<Array<T | undefined>> {
    return {
        value: results.map(r => r.value),
        diags: flatten(results.map(r => r.diags)),
    };
}
