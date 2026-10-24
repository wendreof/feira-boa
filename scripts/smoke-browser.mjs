import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";

/**
 * Smoke test em navegador headless: sobe o site estático, abre as páginas
 * principais no Chrome/Edge via DevTools e falha se houver exceção não
 * tratada no código do site ou se a página inicial não renderizar ofertas.
 *
 * Uso: node scripts/smoke-browser.mjs [--chrome "caminho do executável"]
 */

const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PORT = 8787;
const DEBUG_PORT = 9877;
const PAGES = [
  "index.html", "lojas.html", "login.html", "account.html", "account-alerts.html",
  "account-favorites.html", "account-stores.html", "suggestions.html", "termos.html",
];
const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon",
};

function startStaticServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const filePath = normalize(join(ROOT, relative));
    if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
      response.writeHead(403).end();
      return;
    }
    if (!existsSync(filePath)) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolveServer) => server.listen(PORT, "127.0.0.1", () => resolveServer(server)));
}

function findBrowser(explicit) {
  if (explicit) return explicit;
  const found = BROWSERS.find((path) => existsSync(path));
  if (!found) throw new Error("Nenhum Chrome/Edge encontrado. Use --chrome <caminho>.");
  return found;
}

async function waitForDebugger() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      const data = await response.json();
      return data.webSocketDebuggerUrl;
    } catch {
      await new Promise((done) => setTimeout(done, 250));
    }
  }
  throw new Error("Navegador não abriu a porta de depuração.");
}

function openSession(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  const ready = new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen);
    socket.addEventListener("error", rejectOpen);
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolveCall, rejectCall } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectCall(new Error(message.error.message));
      else resolveCall(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });
  return {
    ready,
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolveCall, rejectCall });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    onEvent(listener) { listeners.push(listener); },
    close() { socket.close(); },
  };
}

function isOwnCodeUrl(url) {
  return typeof url === "string" && url.startsWith(`http://127.0.0.1:${PORT}/`);
}

/** Interações básicas da página inicial: busca, filtro de setor, limpar e favoritos sem login. */
const INDEX_INTERACTIONS = `(async () => {
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const cards = () => document.querySelectorAll(".offer-card").length;
  const result = { initial: cards() };
  const search = document.querySelector("#search-input");
  search.value = "iogurte";
  search.dispatchEvent(new Event("input"));
  await wait(600);
  result.search = cards();
  search.value = "";
  search.dispatchEvent(new Event("input"));
  await wait(600);
  document.querySelector('[data-department]:not([disabled]):not([data-department=""])')?.click();
  await wait(300);
  result.department = cards();
  document.querySelector("#reset-filters").click();
  await wait(300);
  result.reset = cards();
  document.querySelector("#favorites-toggle").click();
  await wait(300);
  result.loginDialog = document.querySelector("#reaction-login-dialog")?.open ?? null;
  return result;
})()`;

async function checkPage(session, sessionId, page) {
  const problems = [];
  const handler = (message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      const url = details.url ?? "";
      if (isOwnCodeUrl(url) || !url) problems.push(`exception: ${details.exception?.description ?? details.text} (${url})`);
    }
  };
  session.onEvent(handler);

  const loaded = new Promise((resolveLoad) => {
    session.onEvent((message) => {
      if (message.sessionId === sessionId && message.method === "Page.loadEventFired") resolveLoad();
    });
  });
  await session.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${page}` }, sessionId);
  await Promise.race([loaded, new Promise((done) => setTimeout(done, 15000))]);
  await new Promise((done) => setTimeout(done, 4000));

  const evaluation = await session.send("Runtime.evaluate", {
    expression: `({
      title: document.title,
      offerCards: document.querySelectorAll(".offer-card").length,
      hasMain: !!document.querySelector("main, #app, body"),
    })`,
    returnByValue: true,
  }, sessionId);
  const state = evaluation.result.value ?? {};
  if (page === "index.html" && !(state.offerCards > 0)) {
    problems.push("index.html rendered no offer cards");
  }
  if (page === "index.html") {
    const interaction = await session.send("Runtime.evaluate", {
      expression: INDEX_INTERACTIONS,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const result = interaction.result.value ?? {};
    if (!(result.search > 0 && result.search < result.initial)) problems.push(`search did not filter cards: ${JSON.stringify(result)}`);
    if (!(result.department > 0 && result.department < result.initial)) problems.push(`sector filter did not filter cards: ${JSON.stringify(result)}`);
    if (result.reset !== result.initial) problems.push(`reset did not restore cards: ${JSON.stringify(result)}`);
    if (result.loginDialog !== true) problems.push("favorites toggle did not ask a signed-out user to log in");
    state.interaction = result;
  }
  return { page, state, problems };
}

async function navigate(session, sessionId, url) {
  const loaded = new Promise((resolveLoad) => {
    session.onEvent((message) => {
      if (message.sessionId === sessionId && message.method === "Page.loadEventFired") resolveLoad();
    });
  });
  await session.send("Page.navigate", { url: `http://127.0.0.1:${PORT}/${url}` }, sessionId);
  await Promise.race([loaded, new Promise((done) => setTimeout(done, 15000))]);
  await new Promise((done) => setTimeout(done, 3000));
}

async function evaluate(session, sessionId, expression) {
  const response = await session.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "evaluation failed");
  return response.result.value;
}

/**
 * Fluxo com conta de teste (SMOKE_EMAIL / SMOKE_PASSWORD): entra pelo formulário,
 * confere a página de conta, e alterna um favorito e uma curtida (desfazendo ao final).
 * As credenciais ficam só em variáveis de ambiente, nunca no repositório.
 */
async function checkSignedIn(session, sessionId, { email, password }) {
  const problems = [];
  const exceptions = [];
  session.onEvent((message) => {
    if (message.sessionId === sessionId && message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      if (isOwnCodeUrl(details.url ?? "")) exceptions.push(details.exception?.description ?? details.text);
    }
  });

  await navigate(session, sessionId, "login.html?returnTo=account.html");
  await evaluate(session, sessionId, `(() => {
    const emailInput = document.querySelector("#auth-email");
    const passwordInput = document.querySelector("#auth-password");
    emailInput.value = ${JSON.stringify(email)};
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    passwordInput.value = ${JSON.stringify(password)};
    passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#auth-submit").click();
    return true;
  })()`);
  // A página navega ao concluir o login; consultas separadas evitam perder a sessão de DevTools.
  let landed = "";
  for (let attempt = 0; attempt < 60 && !String(landed).endsWith("account.html"); attempt += 1) {
    await new Promise((done) => setTimeout(done, 500));
    landed = await evaluate(session, sessionId, "location.pathname").catch(() => "");
  }
  if (!String(landed).endsWith("account.html")) {
    problems.push(`sign-in did not reach account.html (ended at ${landed})`);
    return { page: "signed-in", state: { landed }, problems };
  }

  await new Promise((done) => setTimeout(done, 3000));
  const account = await evaluate(session, sessionId, `({
    email: document.querySelector("#account-email")?.textContent ?? "",
    status: document.querySelector("#account-status")?.textContent ?? "",
  })`);
  if (account.email !== email) problems.push(`account page shows "${account.email}" instead of the test email`);
  if (/Não foi possível verificar|Tente novamente/.test(account.status)) problems.push(`account status: ${account.status}`);

  await navigate(session, sessionId, "index.html");
  const toggled = await evaluate(session, sessionId, `(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const favorite = document.querySelector(".offer-card .favorite-toggle-art");
    const like = document.querySelector('.offer-card .offer-reaction-button[data-reaction="like"]');
    const favoriteBefore = favorite.getAttribute("aria-pressed");
    favorite.click();
    await wait(2000);
    const favoriteAfter = favorite.getAttribute("aria-pressed");
    favorite.click();
    await wait(2000);
    const favoriteRestored = favorite.getAttribute("aria-pressed");
    const likeBefore = like.getAttribute("aria-pressed");
    like.click();
    await wait(2000);
    const likeAfter = like.getAttribute("aria-pressed");
    like.click();
    await wait(2000);
    const likeRestored = like.getAttribute("aria-pressed");
    return { favoriteBefore, favoriteAfter, favoriteRestored, likeBefore, likeAfter, likeRestored };
  })()`);
  if (toggled.favoriteAfter === toggled.favoriteBefore) problems.push("favorite toggle did not change state");
  if (toggled.favoriteRestored !== toggled.favoriteBefore) problems.push("favorite was not restored after the test");
  if (toggled.likeAfter === toggled.likeBefore) problems.push("reaction did not change state");
  if (toggled.likeRestored !== toggled.likeBefore) problems.push("reaction was not restored after the test");
  if (exceptions.length > 0) problems.push(`exceptions while signed in: ${exceptions.join(" | ")}`);
  return { page: "signed-in", state: { email: account.email, ...toggled }, problems };
}

async function main() {
  const browserArg = process.argv.indexOf("--chrome");
  const browserPath = findBrowser(browserArg > 0 ? process.argv[browserArg + 1] : null);
  const server = await startStaticServer();
  const profile = await mkdtemp(join(tmpdir(), "feira-smoke-"));
  const browser = spawn(browserPath, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });

  const results = [];
  try {
    const webSocketUrl = await waitForDebugger();
    const session = openSession(webSocketUrl);
    await session.ready;
    const { targetId } = await session.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await session.send("Target.attachToTarget", { targetId, flatten: true });
    await session.send("Page.enable", {}, sessionId);
    await session.send("Runtime.enable", {}, sessionId);
    for (const page of PAGES) {
      results.push(await checkPage(session, sessionId, page));
    }
    if (process.env.SMOKE_EMAIL && process.env.SMOKE_PASSWORD) {
      results.push(await checkSignedIn(session, sessionId, {
        email: process.env.SMOKE_EMAIL,
        password: process.env.SMOKE_PASSWORD,
      }));
    }
    session.close();
  } finally {
    browser.kill();
    server.close();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }

  for (const result of results) {
    const status = result.problems.length === 0 ? "ok" : "FAIL";
    console.log(`${status} ${result.page} ${JSON.stringify(result.state)}`);
    for (const problem of result.problems) console.log(`    - ${problem}`);
  }
  const failed = results.some((result) => result.problems.length > 0);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
