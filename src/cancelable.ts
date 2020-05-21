export interface ICancelable {
    /**
     * Cancel operation
     */
    cancel(): void;
}

export abstract class Cancelable implements ICancelable {
    protected isCanceled: boolean = false;

    public cancel(): void {
        this.isCanceled = true;
    }

    /**
     * Ignore any other error if the `cancel` method has been called
     *
     * Error: EBADF: bad file descriptor, read
     * EBADF error may occur when calling the cancel method.
     * see https://travis-ci.org/fpsqdb/zip-lib/jobs/606040627#L124
     * @param error
     */
    protected wrapError(error: Error): Error {
        if (this.isCanceled) {
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