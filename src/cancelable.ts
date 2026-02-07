export interface ICancelable {
    /**
     * Cancel operation
     */
    cancel(): void;
}

export class CancellationToken {
    private _isCancelled: boolean = false;
    private _callbacks: Set<() => void> = new Set<() => void>();

    /**
     * A flag signalling is cancellation has been requested.
     */
    public get isCancelled(): boolean {
        return this._isCancelled;
    }

    /**
     * Subscribe a callback when cancellation is requested. The callback
     * only ever fires `once` as cancellation can only happen once.
     * @param cb A function will be called when cancellation is requested.
     * @returns A function that Unsubscribe the cancellation callback.
     */
    public onCancelled(cb: () => void): () => void {
        if (this.isCancelled) {
            cb();
            return () => {
                // noop
            };
        }

        this._callbacks.add(cb);
        return () => this._callbacks.delete(cb);
    }

    public cancel(): void {
        if (this._isCancelled) {
            return;
        }
        this._isCancelled = true;
        this._callbacks.forEach((cb) => {
            cb();
        });
        this._callbacks.clear();
    }
}

export abstract class Cancelable implements ICancelable {
    public abstract cancel(): void;

    /**
     * Ignore any other error if the `cancel` method has been called
     *
     * Error: EBADF: bad file descriptor, read
     * EBADF error may occur when calling the cancel method.
     * see https://travis-ci.org/fpsqdb/zip-lib/jobs/606040627#L124
     * @param error
     */
    protected wrapError(error: Error, isCanceled: boolean): Error {
        if (isCanceled) {
            return this.canceledError();
        }
        return error;
    }

    /**
     * Returns an error that signals cancellation.
     */
    protected canceledError(): Error {
        const error = new Error("Canceled");
        error.name = error.message;
        return error;
    }
}
