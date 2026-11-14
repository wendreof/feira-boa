const versionElement = document.querySelector("#site-version");
const buildDetailsElement = document.querySelector("#site-build-details");
const buildVersionRoot = versionElement?.closest(".build-version");

function normalizeSemver(version) {
  const trimmed = String(version ?? "").trim();
  return trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
}

function formatFooterVersionSummary(build) {
  const core = normalizeSemver(build.version);
  const base = core ? `v${core}` : "";
  if (!base) return "Versão";
  const buildNumber = Number(build.build);
  if (Number.isFinite(buildNumber) && buildNumber > 0) {
    return `${base} (build ${buildNumber})`;
  }
  return base;
}

function applyBuildVersion(build) {
  versionElement.textContent = formatFooterVersionSummary(build);
  const buildTime = new Date(build.builtAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
  buildDetailsElement.textContent = `Build ${build.commit} · ${buildTime}${build.dirty ? " · alterações locais" : ""}`;
  if (buildVersionRoot && build.version) {
    buildVersionRoot.dataset.siteVersion = normalizeSemver(build.version);
  }
}

if (versionElement && buildDetailsElement) {
  fetch("build-info.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Build info unavailable");
      return response.json();
    })
    .then(applyBuildVersion)
    .catch(() => {
      buildDetailsElement.textContent = "Informações da compilação não foram encontradas.";
    });
}