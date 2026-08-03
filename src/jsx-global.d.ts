import type { JSX as ReactJSX } from "react";

// React 19 removed the global `JSX` namespace (it now lives under `React.JSX`).
// Re-expose it globally so existing `JSX.Element` references keep working.
declare global {
    namespace JSX {
        type Element = ReactJSX.Element;
        type ElementClass = ReactJSX.ElementClass;
        type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
        type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
        type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
        type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
        type IntrinsicElements = ReactJSX.IntrinsicElements;
    }
}

export {};
