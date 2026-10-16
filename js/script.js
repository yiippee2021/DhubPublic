// D-HUB Group — shared behaviour

// Relative path works because the whole site (including php/send-mail.php)
// is hosted together on Hostinger — same origin, no CORS needed.
var CONTACT_FORM_ENDPOINT = "/php/send-mail.php";

function goBack(event, fallbackUrl) {
  event.preventDefault();
  var cameFromSameSite = document.referrer && document.referrer.indexOf(location.origin) === 0;
  if (cameFromSameSite && window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = fallbackUrl || "index.html";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
      });
    });
  }

  var year = document.querySelector("#current-year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  var form = document.querySelector("#contact-form");
  if (form) {
    var submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = document.querySelector("#form-status");
      var name = form.querySelector("#name").value.trim();
      var email = form.querySelector("#email").value.trim();
      var message = form.querySelector("#message").value.trim();

      if (!name || !email || !message) {
        status.className = "form-status error";
        status.textContent = "Please complete all required fields before submitting.";
        return;
      }

      var payload = {
        name: name,
        email: email,
        phone: form.querySelector("#phone").value.trim(),
        service: form.querySelector("#service").value,
        society: form.querySelector("#society").value.trim(),
        message: message,
        website: form.querySelector("#website") ? form.querySelector("#website").value : ""
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }
      status.className = "form-status";
      status.textContent = "";

      fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            status.className = "form-status success";
            status.textContent = result.data.message || "Thank you. Your enquiry has been sent — we will be in touch shortly.";
            form.reset();
          } else {
            status.className = "form-status error";
            status.textContent = result.data.message || "Sorry, something went wrong while sending your enquiry. Please try again or contact us by phone.";
          }
        })
        .catch(function () {
          status.className = "form-status error";
          status.textContent = "Sorry, we could not reach the server. Please try again or contact us by phone.";
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Enquiry";
          }
        });
    });
  }

  // Soft scroll-reveal for cards and sections as they enter the viewport.
  if ("IntersectionObserver" in window) {
    var revealTargets = document.querySelectorAll(
      ".card, .team-card, .entity-card, .tool-card, .service-detail, .badge, .resource-section, .hero-card"
    );
    revealTargets.forEach(function (el) {
      el.classList.add("reveal-init");
    });
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  // PDF viewer modal: renders the document in-page with PDF.js from cdnjs. If it cannot load, shows a message and a download link. Nothing opens in a new window.
  var pdfTriggers = document.querySelectorAll(".js-pdf-modal");
  if (pdfTriggers.length) {
    var PDFJS_BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
    var overlay = document.createElement("div");
    overlay.className = "pdf-modal-overlay";
    overlay.innerHTML =
      '<div class="pdf-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-modal-title">' +
      '<div class="pdf-modal-bar">' +
      '<span id="pdf-modal-title" class="pdf-modal-title">Government Resolution (PDF)</span>' +
      '<a class="pdf-modal-download" download>Download</a>' +
      '<button type="button" class="pdf-modal-close" aria-label="Close document">&times;</button>' +
      "</div>" +
      '<div class="pdf-modal-body"></div>' +
      "</div>";
    document.body.appendChild(overlay);
    var modalBody = overlay.querySelector(".pdf-modal-body");
    var downloadLink = overlay.querySelector(".pdf-modal-download");
    var closeBtn = overlay.querySelector(".pdf-modal-close");
    var returnFocus = null;
    var session = 0;

    function setStatus(text) {
      modalBody.innerHTML = "";
      var p = document.createElement("p");
      p.className = "pdf-modal-status";
      p.textContent = text;
      modalBody.appendChild(p);
    }

    function loadPdfJs(callback) {
      if (window.pdfjsLib) {
        callback(true);
        return;
      }
      var script = document.createElement("script");
      script.src = PDFJS_BASE + "pdf.min.js";
      script.onload = function () {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + "pdf.worker.min.js";
          callback(true);
        } else {
          callback(false);
        }
      };
      script.onerror = function () { callback(false); };
      document.head.appendChild(script);
    }

    function showFallback(id) {
      if (id !== session) return;
      setStatus("This preview could not be shown on this device. Use Download above to save the Government Resolution (PDF).");
    }

    function drawPage(pdf, number, width, id) {
      return function () {
        return pdf.getPage(number).then(function (page) {
          if (id !== session) return;
          var ratio = window.devicePixelRatio || 1;
          var base = page.getViewport({ scale: 1 });
          var viewport = page.getViewport({ scale: (width / base.width) * ratio });
          var canvas = document.createElement("canvas");
          canvas.className = "pdf-modal-page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = Math.floor(viewport.width / ratio) + "px";
          modalBody.appendChild(canvas);
          return page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
        });
      };
    }

    function renderPdf(url, id) {
      loadPdfJs(function (loaded) {
        if (id !== session) return;
        if (!loaded) {
          showFallback(id);
          return;
        }
        window.pdfjsLib.getDocument(url).promise.then(function (pdf) {
          if (id !== session) return;
          modalBody.innerHTML = "";
          var width = Math.max(240, Math.min(modalBody.clientWidth - 24, 900));
          var chain = Promise.resolve();
          for (var n = 1; n <= pdf.numPages; n++) {
            chain = chain.then(drawPage(pdf, n, width, id));
          }
          return chain;
        }).catch(function () {
          showFallback(id);
        });
      });
    }

    function openPdfModal(href, trigger) {
      session += 1;
      var id = session;
      returnFocus = trigger || null;
      downloadLink.href = href;
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
      setStatus("Loading document…");
      closeBtn.focus();
      renderPdf(href, id);
    }

    function closePdfModal() {
      session += 1;
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      modalBody.innerHTML = "";
      if (returnFocus && returnFocus.focus) returnFocus.focus();
      returnFocus = null;
    }

    pdfTriggers.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        openPdfModal(link.getAttribute("href"), link);
      });
    });
    closeBtn.addEventListener("click", closePdfModal);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closePdfModal();
    });
    document.addEventListener("keydown", function (event) {
      if (!overlay.classList.contains("open")) return;
      if (event.key === "Escape") {
        closePdfModal();
        return;
      }
      if (event.key !== "Tab") return;
      var focusable = overlay.querySelectorAll("a[href], button");
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }
});
