/**
 * Defines the return type for undo and redo actions.
 */
export type UndoRedoReturnType<T> = (T | void) | (Promise<T> | Promise<void>);

export interface EditorAction {
    /**
     * Describes the undo/redo-able action that has been performed.
     */
    description?: string;
    /**
     * Callback called when an undo or redo action has been performed.
     * Typically used to perform an action in both cases (undo and redo).
     */
    common?: (actionType: "push" | "undo" | "redo") => UndoRedoReturnType<unknown>;
    /**
     * Callback executed when an action should be applied/undone.
     */
    undo: () => UndoRedoReturnType<unknown>;
    /**
     * Callback called when an action should be redone.
     * Calling undoRedo.push(...) will automatically invoke this callback.
     */
    redo: () => UndoRedoReturnType<unknown>;
}

export class UndoRedoManager {
    private currentIndex: number = -1;
    private actionStack: EditorAction[] = [];

    /**
     * Gets the reference to the current stack of actions.
     */
    public get stack(): ReadonlyArray<EditorAction> {
        return this.actionStack;
    }

    /**
     * Pushes the given action to the undo/redo stack. If the current action index
     * is less than the stack size, the stack will be truncated.
     * @param action - The action to push onto the undo/redo stack.
     */
    public push<T>(action: EditorAction): UndoRedoReturnType<T> {
        // Truncate stack if necessary
        if (this.currentIndex < this.actionStack.length - 1) {
            this.actionStack.splice(this.currentIndex + 1);
        }

        // Push action and invoke redo function
        this.actionStack.push(action);
        return this.applyAction("push");
    }

    /**
     * Undoes the action at the current index of the stack.
     * If the action is asynchronous, its promise is returned.
     */
    public undo<T>(): UndoRedoReturnType<T> {
        return this.performUndo();
    }

    /**
     * Redoes the current action at the current index of the stack.
     * If the action is asynchronous, its promise is returned.
     */
    public redo<T>(): UndoRedoReturnType<T> {
        return this.applyAction("redo");
    }

    /**
     * Called when an undo action should be performed.
     */
    private performUndo<T>(): UndoRedoReturnType<T> {
        if (this.currentIndex < 0) {
            return (() => {
                console.log("can't undo.");
            }) as UndoRedoReturnType<T>;
        }

        const action = this.actionStack[this.currentIndex];
        const possiblePromise = action.undo();

        if (possiblePromise instanceof Promise) {
            possiblePromise.then(() => {
                action.common?.("undo");
            });
        } else {
            action.common?.("undo");
        }

        this.currentIndex--;
        return possiblePromise as UndoRedoReturnType<T>;
    }

    /**
     * Called when a redo action should be performed.
     */
    private applyAction<T>(actionType: "push" | "redo"): UndoRedoReturnType<T> {
        if (this.currentIndex >= this.actionStack.length - 1) {
            return (() => {
                console.log("can't do action");
            }) as UndoRedoReturnType<T>;
        }

        this.currentIndex++;

        const action = this.actionStack[this.currentIndex];
        const possiblePromise = action.redo();

        if (possiblePromise instanceof Promise) {
            possiblePromise.then(() => {
                action.common?.(actionType);
            });
        } else {
            action.common?.(actionType);
        }

        return possiblePromise as UndoRedoReturnType<T>;
    }

    /**
     * Clears the current undo/redo stack.
     */
    public clear(): void {
        this.actionStack = [];
        this.currentIndex = -1;
    }
}

/**
 * Shared instance of the undo/redo stack manager.
 */
export const undoRedoManager = new UndoRedoManager();
