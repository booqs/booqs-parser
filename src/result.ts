export type Diagnostic = {
    diag: string,
    data?: object,
};
export type Success<T> = {
    value: T,
    diags?: Diagnostic[],
};
export type Failure = {
    value?: undefined,
    diags?: Diagnostic[],
};

export type Result<T> = Success<T> | Failure;
