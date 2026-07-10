/**
 * why-did-you-render — tracks unnecessary re-renders in development.
 *
 * Import this file BEFORE any other React-using modules to ensure the
 * monkey-patch is applied before React debuts.
 *
 * @see https://github.com/welldone-software/why-did-you-render
 */

import React from "react";

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const whyDidYouRender = require("@welldone-software/why-did-you-render");

  whyDidYouRender(React, {
    // Do NOT auto-track all memoized/PureComponent components. Next.js 15
    // internally wraps page components and passes `params`/`searchParams` as
    // Promises. Auto-tracking would enumerate these Promise props, triggering
    // Next.js's sync-dynamic-apis warnings.
    trackAllPureComponents: false,

    // Same for hook changes — disabled to avoid unintended prop enumeration
    // on Next.js internal components.
    trackHooks: false,

    // Only log when props/state actually change *and* the component still
    // re-renders (i.e. it didn't bail out). Set to false to log ALL renders.
    logOnDifferentValues: true,

    // Log to console.groupCollapsed for cleaner output
    collapseGroups: true,

    // Include the full diff of what changed between renders
    logOwnerReasons: true,
  });

  // To track a specific component, set its `whyDidYouRender` property:
  //   MyComponent.whyDidYouRender = true;
}
