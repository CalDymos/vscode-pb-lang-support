/**
 * Generic utility types
 */

/** Cancellation token for async operations */
export interface CancellationToken {
    readonly isCancellationRequested: boolean;
    onCancellationRequested: (listener: () => void) => Disposable;
}

/** Base disposable resource */
export interface BaseDisposable {
    dispose(): void;
}

/** Alias for BaseDisposable */
export type Disposable = BaseDisposable;