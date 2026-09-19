// D-HUB Group — shared behaviour

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

      var subject = encodeURIComponent("Enquiry from D-HUB Group website — " + name);
      var bodyLines = [
        "Name: " + name,
        "Email: " + email,
        "Phone: " + (form.querySelector("#phone").value.trim() || "Not provided"),
        "Service of interest: " + (form.querySelector("#service").value || "Not specified"),
        "",
        message
      ];
      var body = encodeURIComponent(bodyLines.join("\n"));
      window.location.href = "mailto:info@dhubgroup.in?subject=" + subject + "&body=" + body;

      status.className = "form-status success";
      status.textContent = "Thank you. Your default e-mail application will now open so you may send your enquiry to us.";
      form.reset();
    });
  }
});
