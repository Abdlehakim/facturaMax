// gestionFacture/InvoiceSealController.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  if (SEM.__invoiceSealControllerReady) return;
  SEM.__invoiceSealControllerReady = true;

  const state = () => SEM.state;
  const getEl =
    w.getEl ||
    ((id) => (typeof document === "undefined" ? null : document.getElementById(id)));

  function showDialog(message, options) {
    if (typeof w.showDialog === "function") return w.showDialog(message, options);
    if (typeof w.alert === "function") w.alert(message);
    return Promise.resolve();
  }

  SEM.toggleSealFields = function toggleSealFields(enabled) {
    const f = getEl("sealFields");
    if (f) f.style.display = enabled ? "" : "none";
  };

  SEM.refreshSealPreview = function refreshSealPreview() {
    const st = state();
    const wrap = getEl("sealPreviewWrap");
    const img = getEl("sealPreview");
    if (!wrap || !img) return;
    const seal = st.company?.seal || {};
    if (seal.enabled && seal.image) {
      img.src = seal.image;
      wrap.style.display = "";
    } else {
      img.src = "";
      wrap.style.display = "none";
    }
  };

  SEM.setSealImage = function setSealImage(dataUrl) {
    const st = state();
    st.company = st.company || {};
    st.company.seal = st.company.seal || {
      enabled: false,
      image: "",
      maxWidthMm: 38,
      maxHeightMm: 38,
      opacity: 0.88,
      rotateDeg: -2,
    };
    st.company.seal.image = dataUrl || "";
    if (st.company.seal.image) st.company.seal.enabled = true;
    SEM.refreshSealPreview();
  };

  SEM.loadSealFromFile = async function loadSealFromFile(file) {
    if (!file) return;
    if (file.type && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => SEM.setSealImage(String(reader.result || ""));
      reader.readAsDataURL(file);
      return;
    }

    if (file.type === "application/pdf") {
      if (!w.pdfjsLib) {
        await showDialog(
          "Impossible de lire le PDF sans pdf.js. Veuillez l'installer/charger localement, ou joignez une image.",
          { title: "Cachet PDF" }
        );
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const pdf = await w.pdfjsLib.getDocument({ data: buf }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        SEM.setSealImage(canvas.toDataURL("image/png", 0.92));
      } catch (error) {
        console.error(error);
        await showDialog(
          "Echec du chargement du PDF. Essayez un autre fichier ou convertissez-le en image.",
          { title: "Cachet PDF" }
        );
      }
      return;
    }

    await showDialog("Format de fichier non supporte. Joignez une image ou un PDF.", {
      title: "Cachet",
    });
  };
})(window);
