// D-HUB Group: Maintenance Arrears Calculator (Society Help Desk tool).
// Everything here runs in the visitor's browser. The only thing sent to our server is the contact
// details in step 1, and only so they can be saved. Figures and statements are never sent.
(function () {
  "use strict";

  // Contact step switch. false: the figures open straight away; no contact details are asked for or sent.
  // true: the contact step comes first (needs php/config.php on the server). Keep in step with
  // DHUB_CONTACT_SAVING_ON in php/calculator-register.php.
  var CONTACT_STEP_ON = false;
  var REGISTER_URL = "/php/calculator-register.php";
  var UNLOCK_KEY = "dhubCalcUnlocked";
  var MAX_RANGES = 3;
  var MAX_MONTHS = 360;
  var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var LIBRARIES = {
    xlsx: "../assets/vendor/xlsx.full.min.js",
    jspdf: "../assets/vendor/jspdf.umd.min.js",
    autotable: "../assets/vendor/jspdf.plugin.autotable.min.js"
  };
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var AMOUNT_FORMAT = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var pendingStatement = null;   // worked out, waiting for the visitor to accept the disclaimer
  var shownStatement = null;     // the statement currently on the page
  var focusBeforeModal = null;
  var rangeSerial = 0;
  var loadedLibraries = {};

  function $(id) {
    return document.getElementById(id);
  }

  // Builds an element. Text is always set with textContent, so typed names are never read as HTML.
  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      if (key === "text") {
        node.textContent = props[key];
      } else if (key === "className") {
        node.className = props[key];
      } else {
        node.setAttribute(key, props[key]);
      }
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function setStatus(node, text, kind) {
    node.textContent = text;
    node.className = "form-status" + (kind ? " " + kind : "");
  }

  // Amounts are kept in paise (hundredths of a rupee) as whole numbers, so the arithmetic does not drift.
  function amountToPaise(value) {
    if (value === "" || value === null) {
      return null;
    }
    var n = Number(value);
    if (!isFinite(n) || n < 0 || n > 1000000000) {
      return null;
    }
    return Math.round(n * 100);
  }

  function formatAmount(paise) {
    return AMOUNT_FORMAT.format(paise / 100);
  }

  function parseRate(value) {
    if (value === "" || value === null) {
      return null;
    }
    var n = Number(value);
    return isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
  }

  // Months are counted as whole numbers (year x 12 + month), so ranges can be compared and summed.
  function monthIndex(value) {
    var match = /^(\d{4})-(\d{2})$/.exec(value || "");
    if (!match) {
      return null;
    }
    var month = Number(match[2]);
    if (month < 1 || month > 12) {
      return null;
    }
    return Number(match[1]) * 12 + (month - 1);
  }

  function monthValue(index) {
    var month = (index % 12) + 1;
    return Math.floor(index / 12) + "-" + (month < 10 ? "0" : "") + month;
  }

  function monthLabel(index) {
    return MONTH_NAMES[index % 12] + " " + Math.floor(index / 12);
  }

  function normaliseMobile(text) {
    if (!text) {
      return null;
    }
    if (!/^[0-9+()\s-]+$/.test(text)) {
      return false;
    }
    var digits = text.replace(/\D/g, "");
    if (digits.length === 12 && digits.indexOf("91") === 0) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.charAt(0) === "0") {
      digits = digits.slice(1);
    }
    return /^[6-9][0-9]{9}$/.test(digits) ? digits : false;
  }

  // Loads a vendored library once, when it is first needed (so the page stays light).
  function loadLibrary(src) {
    if (!loadedLibraries[src]) {
      loadedLibraries[src] = new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = src;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          delete loadedLibraries[src];
          reject(new Error("Could not load " + src));
        };
        document.head.appendChild(script);
      });
    }
    return loadedLibraries[src];
  }

  // ---------- Step 1: contact details ----------

  function isUnlocked() {
    try {
      return window.sessionStorage.getItem(UNLOCK_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function showCalculator(moveFocus) {
    $("gate").hidden = true;
    $("calculator").hidden = false;
    if (moveFocus) {
      $("calc-title").focus();
    }
  }

  function unlock() {
    try {
      window.sessionStorage.setItem(UNLOCK_KEY, "1");
    } catch (e) {
      // Storage is blocked: step 1 will simply show again on the next visit.
    }
    showCalculator(true);
  }

  function onGateSubmit(event) {
    event.preventDefault();
    var status = $("gate-status");
    var button = $("gate-submit");
    var name = $("gate-name").value.trim();
    var mobileText = $("gate-mobile").value.trim();
    var email = $("gate-email").value.trim().toLowerCase();
    var mobile = normaliseMobile(mobileText);
    var problems = [];

    if (!mobileText && !email) {
      problems.push("Give a mobile number or an e-mail address, or both.");
    }
    if (mobileText && mobile === false) {
      problems.push("Enter a valid 10-digit mobile number, starting with 6, 7, 8 or 9.");
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      problems.push("Enter a valid e-mail address.");
    }
    if (name.length > 120) {
      problems.push("Keep the name under 120 characters.");
    }
    if (problems.length) {
      setStatus(status, problems.join(" "), "error");
      return;
    }

    button.disabled = true;
    setStatus(status, "Saving your details…", "");
    fetch(REGISTER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        mobile: mobile || "",
        email: email,
        marketing: $("gate-marketing").checked,
        website: $("gate-website").value
      })
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          unlock();
        } else {
          setStatus(status, result.data.message || "Sorry, your details could not be saved. Please try again.", "error");
        }
      })
      .catch(function () {
        setStatus(status, "Sorry, we could not reach the server. Please try again.", "error");
      })
      .then(function () {
        button.disabled = false;
      });
  }

  // ---------- Step 2: the figures ----------

  function rangeCards() {
    return Array.prototype.slice.call(document.querySelectorAll("#range-list .range-card"));
  }

  function renumberRanges() {
    var cards = rangeCards();
    cards.forEach(function (card, i) {
      card.querySelector(".range-title").textContent = "Range " + (i + 1);
      card.querySelector(".range-remove").hidden = i === 0;
    });
    $("add-range").disabled = cards.length >= MAX_RANGES;
  }

  function addRange(fromValue) {
    rangeSerial += 1;
    var n = rangeSerial;
    var fromId = "range-from-" + n;
    var toId = "range-to-" + n;
    var rateId = "range-rate-" + n;

    var from = el("input", { type: "month", id: fromId, className: "range-from", required: "required" });
    from.value = fromValue || "";
    var to = el("input", { type: "month", id: toId, className: "range-to", required: "required" });
    var rate = el("input", {
      type: "number", id: rateId, className: "range-rate", min: "0", max: "100",
      step: "0.01", inputmode: "decimal", required: "required"
    });

    var row = el("div", { className: "form-row-3" }, [
      el("div", { className: "form-group" }, [el("label", { "for": fromId, text: "From (month)" }), from]),
      el("div", { className: "form-group" }, [el("label", { "for": toId, text: "To (month)" }), to]),
      el("div", { className: "form-group" }, [el("label", { "for": rateId, text: "Rate of interest (% a year)" }), rate])
    ]);
    var card = el("div", { className: "range-card" }, [
      el("h3", { className: "range-title", text: "Range" }),
      row,
      el("button", { type: "button", className: "btn-link range-remove", text: "Remove this range" })
    ]);
    $("range-list").appendChild(card);
    return card;
  }

  function onAddRange() {
    var cards = rangeCards();
    var last = cards[cards.length - 1];
    var lastTo = last ? monthIndex(last.querySelector(".range-to").value) : null;
    var card = addRange(lastTo === null ? "" : monthValue(lastTo + 1));
    renumberRanges();
    card.querySelector(".range-to").focus();
  }

  function onRangeListClick(event) {
    if (!event.target.classList.contains("range-remove")) {
      return;
    }
    var card = event.target.closest(".range-card");
    if (card) {
      card.parentNode.removeChild(card);
      renumberRanges();
    }
  }

  // Reads and checks every field. Returns the figures plus a list of problems in plain words.
  function readForm() {
    var errors = [];
    var member = $("member-name").value.trim();
    var room = $("room-number").value.trim();
    if (!member) {
      errors.push("Enter the member's name.");
    }
    if (!room) {
      errors.push("Enter the room or flat number.");
    }
    var pending = amountToPaise($("pending").value);
    if (pending === null) {
      errors.push("Enter the pending maintenance as a number (0 if nothing is pending).");
    }
    var monthly = amountToPaise($("monthly").value);
    if (monthly === null) {
      errors.push("Enter the monthly maintenance as a number (0 if there is none).");
    }

    var ranges = [];
    var previousTo = null;
    rangeCards().forEach(function (card, i) {
      var label = "Range " + (i + 1);
      var from = monthIndex(card.querySelector(".range-from").value);
      var to = monthIndex(card.querySelector(".range-to").value);
      var rate = parseRate(card.querySelector(".range-rate").value);
      var problem = null;
      if (from === null || to === null) {
        problem = label + ": choose both the from and to months.";
      } else if (to < from) {
        problem = label + ": the 'to' month cannot be earlier than the 'from' month.";
      } else if (rate === null) {
        problem = label + ": enter a rate of interest between 0 and 100.";
      } else if (previousTo !== null && from !== previousTo + 1) {
        problem = label + " must start in the month after Range " + i + " ends.";
      }
      if (problem) {
        errors.push(problem);
        previousTo = null;
        return;
      }
      ranges.push({ from: from, to: to, rate: rate });
      previousTo = to;
    });

    if (!ranges.length && !errors.length) {
      errors.push("Add at least one interest range.");
    }
    if (ranges.length) {
      var months = ranges[ranges.length - 1].to - ranges[0].from + 1;
      if (months > MAX_MONTHS) {
        errors.push("The statement can cover at most " + MAX_MONTHS + " months. Shorten the ranges.");
      }
    }
    return { errors: errors, member: member, room: room, pending: pending, monthly: monthly, ranges: ranges };
  }

  // Month by month: opening + monthly maintenance = amount carried in; interest = carried in x rate / 12.
  function buildStatement(input) {
    var rows = [];
    var opening = input.pending;
    input.ranges.forEach(function (range, r) {
      // Rate in hundredths of a per cent. Interest in paise = base x rate / 1200 = base x rate100 / 120000, rounded half up.
      var rate100 = Math.round(range.rate * 100);
      for (var m = range.from; m <= range.to; m++) {
        var base = opening + input.monthly;
        var interest = Math.floor((base * rate100 + 60000) / 120000);
        var closing = base + interest;
        rows.push({
          no: rows.length + 1,
          month: monthLabel(m),
          range: r + 1,
          rate: range.rate,
          opening: opening,
          maintenance: input.monthly,
          interest: interest,
          closing: closing
        });
        opening = closing;
      }
    });
    var totals = rows.reduce(function (sum, row) {
      sum.maintenance += row.maintenance;
      sum.interest += row.interest;
      return sum;
    }, { maintenance: 0, interest: 0 });
    var final = rows.length ? rows[rows.length - 1].closing : input.pending;
    return {
      member: input.member,
      room: input.room,
      pending: input.pending,
      monthly: input.monthly,
      ranges: input.ranges,
      rows: rows,
      totals: totals,
      final: final,
      generated: new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short"
      }).format(new Date()) + " IST"
    };
  }

  function renderStatement(stmt) {
    shownStatement = stmt;

    var summary = $("statement-summary");
    summary.textContent = "";
    [
      ["Member", stmt.member],
      ["Room or flat number", stmt.room],
      ["Initial opening balance (pending maintenance)", "₹ " + formatAmount(stmt.pending)],
      ["Monthly maintenance", "₹ " + formatAmount(stmt.monthly)],
      ["Final amount at the end of the period", "₹ " + formatAmount(stmt.final)],
      ["Generated", stmt.generated]
    ].forEach(function (item) {
      summary.appendChild(el("div", { className: "summary-item" }, [
        el("dt", { text: item[0] }),
        el("dd", { text: item[1] })
      ]));
    });

    var rangesBody = $("ranges-table").querySelector("tbody");
    rangesBody.textContent = "";
    stmt.ranges.forEach(function (range, i) {
      rangesBody.appendChild(el("tr", {}, [
        el("td", { text: "Range " + (i + 1) }),
        el("td", { text: monthLabel(range.from) }),
        el("td", { text: monthLabel(range.to) }),
        el("td", { className: "num", text: String(range.to - range.from + 1) }),
        el("td", { className: "num", text: String(range.rate) })
      ]));
    });

    var body = $("statement").querySelector("tbody");
    body.textContent = "";
    stmt.rows.forEach(function (row) {
      body.appendChild(el("tr", {}, [
        el("td", { text: String(row.no) }),
        el("td", { text: row.month }),
        el("td", { text: String(row.range) }),
        el("td", { className: "num", text: String(row.rate) }),
        el("td", { className: "num", text: formatAmount(row.opening) }),
        el("td", { className: "num", text: formatAmount(row.maintenance) }),
        el("td", { className: "num", text: formatAmount(row.interest) }),
        el("td", { className: "num", text: formatAmount(row.closing) })
      ]));
    });

    var foot = $("statement").querySelector("tfoot");
    foot.textContent = "";
    foot.appendChild(el("tr", {}, [
      el("td", { colspan: "5", text: "Totals for the period" }),
      el("td", { className: "num", text: formatAmount(stmt.totals.maintenance) }),
      el("td", { className: "num", text: formatAmount(stmt.totals.interest) }),
      el("td", { className: "num", text: "" })
    ]));
    foot.appendChild(el("tr", {}, [
      el("td", { colspan: "7", text: "Final amount at the end of the selected period" }),
      el("td", { className: "num", text: formatAmount(stmt.final) })
    ]));
  }

  // ---------- Disclaimer ----------

  function openDisclaimer() {
    focusBeforeModal = document.activeElement;
    $("disclaimer").hidden = false;
    $("disclaimer-accept").focus();
  }

  function hideDisclaimer() {
    $("disclaimer").hidden = true;
  }

  function closeDisclaimer() {
    hideDisclaimer();
    if (focusBeforeModal && focusBeforeModal.focus) {
      focusBeforeModal.focus();
    }
  }

  function trapFocus(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDisclaimer();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    var buttons = Array.prototype.slice.call($("disclaimer").querySelectorAll("button"));
    var first = buttons[0];
    var last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onCalculate(event) {
    event.preventDefault();
    var input = readForm();
    var box = $("calc-errors");
    if (input.errors.length) {
      box.textContent = "";
      box.appendChild(el("p", { text: "Please fix these before we calculate:" }));
      var list = el("ul");
      input.errors.forEach(function (message) {
        list.appendChild(el("li", { text: message }));
      });
      box.appendChild(list);
      box.hidden = false;
      box.focus();
      return;
    }
    box.hidden = true;
    pendingStatement = buildStatement(input);
    openDisclaimer();
  }

  function onAcceptDisclaimer() {
    hideDisclaimer();
    if (!pendingStatement) {
      return;
    }
    renderStatement(pendingStatement);
    $("results").hidden = false;
    setStatus($("export-status"), "", "");
    $("results-title").focus();
  }

  function clearStatement() {
    $("statement-summary").textContent = "";
    $("ranges-table").querySelector("tbody").textContent = "";
    $("statement").querySelector("tbody").textContent = "";
    $("statement").querySelector("tfoot").textContent = "";
  }

  // Clears the statement and the figures from the page, as the disclaimer says. Nothing is kept.
  function onRecalculate() {
    shownStatement = null;
    pendingStatement = null;
    clearStatement();
    $("results").hidden = true;
    rangeCards().forEach(function (card) {
      card.parentNode.removeChild(card);
    });
    $("calc-form").reset();
    addRange("");
    renumberRanges();
    $("calc-errors").hidden = true;
    setStatus($("export-status"), "", "");
    $("calc-form").scrollIntoView({ block: "start" });
    $("member-name").focus();
  }

  // ---------- Downloads (built in the browser from the statement on the page) ----------

  function fileName(stmt, extension) {
    var room = stmt.room.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "room";
    var stamp = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
    return "maintenance-arrears-statement-" + room + "-" + stamp + "." + extension;
  }

  function excelSheet(stmt) {
    var rows = [];
    var money = [];
    function push(cells) {
      rows.push(cells);
      return rows.length - 1;
    }
    function rupees(paise) {
      return paise / 100;
    }

    push(["D-HUB Project Management Consultancy: Maintenance Arrears Calculator"]);
    push(["Not legal advice. Worked out at run time from the figures entered. D-HUB does not save this statement."]);
    push([]);
    push(["Member name", stmt.member]);
    push(["Room or flat number", stmt.room]);
    push(["Generated", stmt.generated]);
    money.push([push(["Initial opening balance (pending maintenance), Rs", rupees(stmt.pending)]), 1]);
    money.push([push(["Monthly maintenance, Rs", rupees(stmt.monthly)]), 1]);
    push([]);
    push(["Range", "From", "To", "Months", "Rate (% a year)"]);
    stmt.ranges.forEach(function (range, i) {
      push(["Range " + (i + 1), monthLabel(range.from), monthLabel(range.to), range.to - range.from + 1, range.rate]);
    });
    push([]);
    push(["No.", "Month", "Range", "Rate (% a year)", "Opening balance (Rs)", "Monthly maintenance (Rs)", "Interest (Rs)", "Closing total (Rs)"]);
    stmt.rows.forEach(function (row) {
      var r = push([row.no, row.month, row.range, row.rate, rupees(row.opening), rupees(row.maintenance), rupees(row.interest), rupees(row.closing)]);
      [4, 5, 6, 7].forEach(function (c) {
        money.push([r, c]);
      });
    });
    var totals = push(["", "Totals for the period", "", "", "", rupees(stmt.totals.maintenance), rupees(stmt.totals.interest), ""]);
    money.push([totals, 5], [totals, 6]);
    var final = push(["", "Final amount at the end of the selected period (Rs)", "", "", "", "", "", rupees(stmt.final)]);
    money.push([final, 7]);
    push([]);
    push(["Prepared with the D-HUB Maintenance Arrears Calculator. Figures are an estimate, not legal advice."]);
    return { rows: rows, money: money };
  }

  function exportExcel(stmt) {
    var status = $("export-status");
    setStatus(status, "Preparing your Excel file…", "");
    loadLibrary(LIBRARIES.xlsx).then(function () {
      var XLSX = window.XLSX;
      var sheet = excelSheet(stmt);
      var ws = XLSX.utils.aoa_to_sheet(sheet.rows);
      sheet.money.forEach(function (pair) {
        var ref = XLSX.utils.encode_cell({ r: pair[0], c: pair[1] });
        if (ws[ref] && typeof ws[ref].v === "number") {
          ws[ref].z = "#,##0.00";
        }
      });
      ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 26 }, { wch: 18 }, { wch: 20 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Statement");
      XLSX.writeFile(wb, fileName(stmt, "xlsx"));
      setStatus(status, "Your Excel file is ready.", "success");
    }).catch(function () {
      setStatus(status, "The Excel file could not be prepared. Please try again.", "error");
    });
  }

  function exportPdf(stmt) {
    var status = $("export-status");
    setStatus(status, "Preparing your PDF…", "");
    loadLibrary(LIBRARIES.jspdf).then(function () {
      return loadLibrary(LIBRARIES.autotable);
    }).then(function () {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ unit: "mm", format: "a4" });
      var header = [
        ["D-HUB Project Management Consultancy", 14, 16, 14, "bold"],
        ["Maintenance Arrears Calculator: statement", 14, 23, 11, "bold"],
        ["Not legal advice. Worked out at run time from the figures entered. D-HUB does not save this statement.", 14, 29, 8.5, "normal"]
      ];
      header.forEach(function (line) {
        doc.setFont("helvetica", line[4]);
        doc.setFontSize(line[3]);
        doc.text(line[0], line[1], line[2]);
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Member: " + stmt.member, 14, 37);
      doc.text("Room or flat number: " + stmt.room, 110, 37);
      doc.text("Generated: " + stmt.generated, 14, 43);
      doc.text("Initial opening balance (pending maintenance): Rs " + formatAmount(stmt.pending), 14, 49);
      doc.text("Monthly maintenance: Rs " + formatAmount(stmt.monthly), 14, 55);

      doc.autoTable({
        startY: 61,
        head: [["Range", "From", "To", "Months", "Rate (% a year)"]],
        body: stmt.ranges.map(function (range, i) {
          return ["Range " + (i + 1), monthLabel(range.from), monthLabel(range.to), String(range.to - range.from + 1), String(range.rate)];
        }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [11, 61, 92] }
      });

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 6,
        head: [["No.", "Month", "Range", "Rate %", "Opening (Rs)", "Maintenance (Rs)", "Interest (Rs)", "Closing (Rs)"]],
        body: stmt.rows.map(function (row) {
          return [String(row.no), row.month, String(row.range), String(row.rate),
            formatAmount(row.opening), formatAmount(row.maintenance), formatAmount(row.interest), formatAmount(row.closing)];
        }),
        foot: [
          [{ content: "Totals for the period", colSpan: 5 }, formatAmount(stmt.totals.maintenance), formatAmount(stmt.totals.interest), ""],
          [{ content: "Final amount at the end of the selected period", colSpan: 7 }, formatAmount(stmt.final)]
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [11, 61, 92] },
        footStyles: { fillColor: [243, 246, 248], textColor: [11, 61, 92] },
        columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
        margin: { left: 14, right: 14 }
      });

      doc.save(fileName(stmt, "pdf"));
      var names = stmt.member + " " + stmt.room;
      if (/[^\x00-\x7F]/.test(names)) {
        setStatus(status, "Your PDF is ready. Names in other scripts may not print correctly in the PDF. Use the Excel file for those.", "success");
      } else {
        setStatus(status, "Your PDF is ready.", "success");
      }
    }).catch(function () {
      setStatus(status, "The PDF could not be prepared. Please try again.", "error");
    });
  }

  // ---------- Set up ----------

  // Shows the contact step only when CONTACT_STEP_ON is true. Otherwise the figures open straight away.
  function applyContactMode() {
    if (CONTACT_STEP_ON) {
      $("calc-title").textContent = "Step 2 of 2: Enter the figures";
      if (isUnlocked()) {
        showCalculator(false);
      } else {
        $("gate").hidden = false;
      }
      return;
    }
    $("disclaimer-contacts").textContent = "At present D-HUB is not saving any contact details either. D-HUB is not saving any details of any data which is calculated and given out.";
    showCalculator(false);
  }

  function init() {
    $("gate-form").addEventListener("submit", onGateSubmit);
    $("calc-form").addEventListener("submit", onCalculate);
    $("add-range").addEventListener("click", onAddRange);
    $("range-list").addEventListener("click", onRangeListClick);
    $("disclaimer-cancel").addEventListener("click", closeDisclaimer);
    $("disclaimer-accept").addEventListener("click", onAcceptDisclaimer);
    document.addEventListener("keydown", function (event) {
      if (!$("disclaimer").hidden) {
        trapFocus(event);
      }
    });
    $("btn-recalc").addEventListener("click", onRecalculate);
    $("btn-excel").addEventListener("click", function () {
      if (shownStatement) {
        exportExcel(shownStatement);
      }
    });
    $("btn-pdf").addEventListener("click", function () {
      if (shownStatement) {
        exportPdf(shownStatement);
      }
    });

    addRange("");
    renumberRanges();
    applyContactMode();
  }

  init();
})();
