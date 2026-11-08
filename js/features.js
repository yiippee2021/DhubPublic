// D-HUB Group: enquiry guide, checklist ticks and question search.
// Plain browser JavaScript with no dependencies. Each feature runs only where its markup exists.
(function () {
  "use strict";

  var CONTACT = "contact.html";

  // Suggestions for the "Which service do I need?" guide. Descriptions repeat wording already on the site.
  var GUIDE = {
    society: {
      "deemed-conveyance": {
        service: "Deemed Conveyance (MOFA)",
        anchor: "services.html#deemed-conveyance",
        text: "Revenue record verification, Competent Authority proceedings under MOFA Section 11, and registered conveyance deed execution for Societies where the promoter has not conveyed title."
      },
      "feasibility": {
        service: "Redevelopment Feasibility Study",
        anchor: "services.html#feasibility",
        text: "FSI/TDR computation, carpet-area projections, corpus fund estimation, development-potential assessment, and self-redevelopment versus builder-led comparative analysis."
      },
      "tender-design": {
        service: "Tender Design & Developer Evaluation",
        anchor: "services.html#tender-design",
        text: "Professional tender documentation, evaluation criteria, developer shortlisting, background verification, and comparative bid analysis to support Managing Committee decision-making."
      },
      "legal-scrutiny": {
        service: "Legal Scrutiny & Agreement Review",
        anchor: "services.html#legal-liaison",
        text: "Developer agreement vetting, redevelopment deed review, deemed conveyance petition drafting, Society bye-law compliance, and housing litigation support."
      },
      "title": {
        service: "Revenue Record & Title Resolution",
        anchor: "services.html#title-resolution",
        text: "7/12 discrepancy resolution, Urban Land Ceiling (ULC) advisory, title search, land-area enhancement coordination, and legacy title-issue management for complex schemes."
      },
      "structural": {
        service: "Structural Audit & Assessment",
        anchor: "services.html#structural-audit",
        text: "Independent structural audits for redevelopment eligibility, building age certification, and technical reports for Managing Committee and statutory authority submissions."
      },
      "not-sure": {
        service: "Other",
        anchor: "",
        text: "Send us a short description and any documents you have. We will tell you which service fits."
      }
    },
    builder: {
      "design-feasibility": {
        service: "Design & Feasibility Consultancy",
        anchor: "builders.html#design-feasibility",
        text: "FSI/TDR computation, layout planning and development-potential assessment for first-time and greenfield sites, supporting your project's initial design and investment decisions."
      },
      "statutory-approvals": {
        service: "Statutory Approvals & Plan Sanction",
        anchor: "builders.html#statutory-approvals",
        text: "Liaison with MBMC, TMC and BMC for plan sanction, Intimation of Disapproval (IOD), Commencement Certificate and Occupation/Completion Certificate."
      },
      "pmc-construction": {
        service: "Construction PMC",
        anchor: "builders.html#pmc-construction",
        text: "Progress monitoring, contractor and vendor coordination, and cost, quality and timeline control from groundbreaking through to handover."
      },
      "mahareras-compliance": {
        service: "MahaRERA Registration & Compliance",
        anchor: "builders.html#mahareras-compliance",
        text: "Project registration, ongoing compliance monitoring, and regulatory documentation under the Maharashtra Real Estate (Regulation and Development) Act, 2016."
      },
      "institutional-advisory": {
        service: "Institutional & Commercial Project Advisory",
        anchor: "builders.html#institutional-advisory",
        text: "Tailored PMC and design consultancy for malls, retail developments, schools, colleges and other institutional buildings, from concept through to statutory handover."
      },
      "not-sure": {
        service: "Other",
        anchor: "",
        text: "Send us a short description and any documents you have. We will tell you which service fits."
      }
    }
  };

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Enquiry form: open with the service chosen in the guide (contact.html?service=...).
  function preselectService() {
    var select = document.getElementById("service");
    var wanted = new URLSearchParams(window.location.search).get("service");
    if (!select || !wanted) return;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === wanted) {
        select.value = wanted;
        return;
      }
    }
  }

  // "Which service do I need?" on the services page.
  function renderSuggestion(choice) {
    var link = CONTACT + "?service=" + encodeURIComponent(choice.service);
    var more = choice.anchor
      ? '<a class="btn btn-outline-dark" href="' + choice.anchor + '">Read about this service</a>'
      : "";
    return '<div class="guide-card">' +
      '<p class="guide-kicker">Suggested starting point</p>' +
      "<h3>" + escapeHtml(choice.service) + "</h3>" +
      "<p>" + escapeHtml(choice.text) + "</p>" +
      '<p class="guide-actions"><a class="btn btn-primary" href="' + link + '">Send an enquiry for this service</a>' + more + "</p>" +
      '<p class="guide-note">A starting point, not legal advice. We confirm the scope after reviewing your documents.</p>' +
      "</div>";
  }

  function setupGuide() {
    var wrap = document.getElementById("guide-form");
    var button = document.getElementById("guide-submit");
    var result = document.getElementById("guide-result");
    if (!wrap || !button || !result) return;
    var needs = {
      society: document.getElementById("need-society"),
      builder: document.getElementById("need-builder")
    };

    function checked(name) {
      var input = wrap.querySelector('input[name="' + name + '"]:checked');
      return input ? input.value : "";
    }

    wrap.addEventListener("change", function (event) {
      if (event.target.name !== "audience") return;
      needs.society.hidden = event.target.value !== "society";
      needs.builder.hidden = event.target.value !== "builder";
      result.innerHTML = "";
    });

    button.addEventListener("click", function () {
      var who = checked("audience");
      var need = who ? checked("need-" + who) : "";
      if (!need) {
        result.innerHTML = '<p class="guide-note">Please answer both questions to see a suggestion.</p>';
        return;
      }
      result.innerHTML = renderSuggestion(GUIDE[who][need]);
    });
  }

  // Checklist ticks, saved per browser under a key built from each item's text.
  function hash(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  function storeRead(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storeWrite(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      // Storage is blocked: ticks still work for this visit.
    }
  }

  function setupChecklists() {
    var printButton = document.getElementById("print-checklist");
    var clearButton = document.getElementById("clear-checklist");
    if (!printButton || !clearButton) return;
    var prefix = "dhub-tick:" + window.location.pathname + ":";
    var groups = [];

    function paint(group) {
      var done = group.boxes.filter(function (box) { return box.checked; }).length;
      group.progress.textContent = done + " of " + group.boxes.length + " ticked";
      group.boxes.forEach(function (box) {
        box.parentNode.classList.toggle("ticked", box.checked);
      });
    }

    document.querySelectorAll(".resource-section").forEach(function (section) {
      if (section.parentElement.closest(".resource-section")) return; // counted with the parent section
      var items = section.querySelectorAll("li");
      if (!items.length) return;
      var group = { progress: document.createElement("p"), boxes: [] };
      group.progress.className = "checklist-progress";
      group.progress.setAttribute("aria-live", "polite");
      var heading = section.querySelector("h2");
      if (heading) heading.insertAdjacentElement("afterend", group.progress);
      items.forEach(function (item) {
        var text = item.textContent.replace(/\s+/g, " ").trim();
        var key = prefix + hash(text.slice(0, 200));
        var box = document.createElement("input");
        box.type = "checkbox";
        box.className = "tick-box";
        box.dataset.key = key;
        box.checked = storeRead(key) === "1";
        box.setAttribute("aria-label", "Done: " + text.slice(0, 90));
        item.classList.add("has-tick");
        item.insertBefore(box, item.firstChild);
        box.addEventListener("change", function () {
          storeWrite(key, box.checked ? "1" : "0");
          paint(group);
        });
        group.boxes.push(box);
      });
      paint(group);
      groups.push(group);
    });

    clearButton.addEventListener("click", function () {
      groups.forEach(function (group) {
        group.boxes.forEach(function (box) {
          if (box.checked) {
            box.checked = false;
            storeWrite(box.dataset.key, "0");
          }
        });
        paint(group);
      });
    });

    printButton.addEventListener("click", function () {
      window.print();
    });
  }

  // Question search for the FAQ and the GR Q&A. Each question is its h3 plus the text up to the next question.
  function applyQuestionFilter(root, query, countElement) {
    var q = query.trim().toLowerCase();
    var total = 0;
    var shown = 0;
    root.querySelectorAll("h3").forEach(function (heading) {
      var group = [heading];
      var next = heading.nextElementSibling;
      while (next && next.tagName !== "H2" && next.tagName !== "H3" && !next.classList.contains("resource-section")) {
        group.push(next);
        next = next.nextElementSibling;
      }
      var text = group.map(function (el) { return el.textContent; }).join(" ").toLowerCase();
      var match = !q || text.indexOf(q) !== -1;
      group.forEach(function (el) { el.hidden = !match; });
      total += 1;
      if (match) shown += 1;
    });
    root.querySelectorAll(".resource-section").forEach(function (section) {
      section.hidden = Boolean(q) && !section.querySelector("h3:not([hidden])");
    });
    if (countElement) {
      countElement.textContent = q ? shown + " of " + total + " questions match" : "";
    }
  }

  function setupSearch() {
    var faqSearch = document.getElementById("faq-search");
    if (faqSearch) {
      var faqCount = document.getElementById("faq-count");
      faqSearch.addEventListener("input", function () {
        applyQuestionFilter(document, faqSearch.value, faqCount);
      });
    }

    var grSearch = document.getElementById("gr-search");
    if (grSearch) {
      var grCount = document.getElementById("gr-count");
      var filterGr = function () {
        var panel = document.querySelector(".lang-panel.active") || document;
        applyQuestionFilter(panel, grSearch.value, grCount);
      };
      grSearch.addEventListener("input", filterGr);
      document.querySelectorAll(".lang-tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          window.setTimeout(filterGr, 0);
        });
      });
    }
  }

  function init() {
    preselectService();
    setupGuide();
    setupChecklists();
    setupSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
