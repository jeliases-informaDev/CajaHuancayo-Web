// El tema se decide antes de pintar para que no parpadee entre claro y oscuro.
// Vive en un archivo propio (y no dentro de index.html) para que la politica de seguridad del panel no necesite permitir scripts en linea.
(function () {
  try {
    var pref = localStorage.getItem("ch_theme") || "light";
    var dark = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themePref = pref;
    // La barra lateral compacta es la del diseño: sale así salvo que la persona ya haya elegido expandirla (ch_rail = 0).
    var rail = localStorage.getItem("ch_rail");
    if (rail === null || rail === "1") document.documentElement.dataset.rail = "1";
  } catch (e) { document.documentElement.dataset.theme = "light"; document.documentElement.dataset.rail = "1"; }
})();
