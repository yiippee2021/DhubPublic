// D-HUB Group — shared behaviour

// Set this to the URL where php/send-mail.php is hosted (a PHP-capable
// server — GitHub Pages cannot run it). e.g. "https://mail.dhubgroup.in/send-mail.php"
var CONTACT_FORM_ENDPOINT = "https://dhubgroup.in/send-mail.php";

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
});
