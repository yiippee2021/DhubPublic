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

  // PDF viewer modal — keeps PDF links (e.g. the GR download buttons) inside the site
  // instead of navigating away or handing off to an external app/viewer.
  var pdfTriggers = document.querySelectorAll(".js-pdf-modal");
  if (pdfTriggers.length) {
    var overlay = document.createElement("div");
    overlay.className = "pdf-modal-overlay";
    overlay.innerHTML =
      '<div class="pdf-modal" role="dialog" aria-modal="true" aria-label="Document viewer">' +
      '<div class="pdf-modal-bar">' +
      '<a class="pdf-modal-download" download>&#11015; Download</a>' +
      '<button type="button" class="pdf-modal-close" aria-label="Close">&times;</button>' +
      "</div>" +
      '<iframe class="pdf-modal-frame" title="PDF document"></iframe>' +
      "</div>";
    document.body.appendChild(overlay);

    var frame = overlay.querySelector(".pdf-modal-frame");
    var downloadLink = overlay.querySelector(".pdf-modal-download");
    var closeBtn = overlay.querySelector(".pdf-modal-close");

    function openPdfModal(href) {
      frame.src = href;
      downloadLink.href = href;
      overlay.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closePdfModal() {
      overlay.classList.remove("open");
      document.body.style.overflow = "";
      frame.src = "";
    }

    pdfTriggers.forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        openPdfModal(link.getAttribute("href"));
      });
    });
    closeBtn.addEventListener("click", closePdfModal);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closePdfModal();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overlay.classList.contains("open")) closePdfModal();
    });
  }
});
