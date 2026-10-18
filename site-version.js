const versionElement = document.querySelector("#site-version");
const buildDetailsElement = document.querySelector("#site-build-details");

if (versionElement && buildDetailsElement) {
  fetch("build-info.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Build info unavailable");
      return response.json();
    })
    .then((build) => {
      versionElement.textContent = `v${build.version}`;
      const buildTime = new Date(build.builtAt).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
      buildDetailsElement.textContent = `Build ${build.commit} · ${buildTime}${build.dirty ? " · alterações locais" : ""}`;
    })
    .catch(() => {
      versionElement.textContent = "Versão indisponível";
      buildDetailsElement.textContent = "Informações da compilação não foram encontradas.";
    });
}
