import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPackageVersion } from "./read-package-version.mjs";

const packageVersion = await readPackageVersion(new URL("../package.json", import.meta.url));

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const supabaseShim = path.join(rootDir, "src/supabase-js-browser.ts");

const shared = {
  bundle: true,
  minify: true,
  target: "es2020",
  legalComments: "none",
};

/** @type {import("esbuild").Plugin} */
const supabaseShimPlugin = {
  name: "supabase-vendor-shim",
  setup(build) {
    build.onResolve({ filter: /^@supabase\/supabase-js$/ }, (args) => {
      if (args.importer.replace(/\\/g, "/").includes("supabase-vendor-entry")) {
        return null;
      }
      return { path: supabaseShim };
    });
  },
};

const pageEntries = [
  { in: "src/app.ts", out: "app" },
  { in: "src/stores-page.ts", out: "stores" },
  { in: "src/login-page.ts", out: "login" },
  { in: "src/account-page.ts", out: "account" },
  { in: "src/suggestions-page.ts", out: "suggestions" },
  { in: "src/admin-page.ts", out: "admin" },
  { in: "src/alerts-page.ts", out: "alerts" },
  { in: "src/messages-page.ts", out: "messages" },
  { in: "src/shared/site-footer.ts", out: "site-footer" },
  { in: "src/shared/login-gate.ts", out: "login-gate" },
  { in: "src/notification-badge-page.ts", out: "notification-badge" },
  { in: "src/christmas-bootstrap.ts", out: "christmas-bootstrap" },
];

await esbuild.build({
  ...shared,
  entryPoints: [{ in: "src/supabase-vendor-entry.ts", out: "supabase-vendor" }],
  outdir: rootDir,
});

await esbuild.build({
  ...shared,
  entryPoints: pageEntries,
  outdir: rootDir,
  plugins: [supabaseShimPlugin],
  define: {
    __SITE_PACKAGE_VERSION__: JSON.stringify(packageVersion),
  },
});

console.log(`Built supabase-vendor.js and ${pageEntries.length} page bundles.`);