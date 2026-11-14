// ---------- Global state ----------
var scheduleObject = null;
var games = [];
var gameIndex = 0;

var highlightItems = [];
var highlightIndex = 0;

var SCHEDULE_URL = "https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD";
var CONTENT_URL = "https://statsapi.mlb.com/api/v1/game/[gamePk]/content";

// ---------- Date pulldowns ----------
var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n) { return n < 10 ? "0" + n : String(n); }

// Fill a <select> with options from "first" to "last", zero-padded (e.g. 01, 02 ... 12)
function fillSelect(id, first, last, selected) {
    var select = document.getElementById(id);
    for (var value = first; value <= last; value++) {
        var option = document.createElement("option");
        option.value = pad(value);
        option.text = pad(value);
        if (value === selected) { option.selected = true; }
        select.appendChild(option);
    }
}

// Read the three pulldowns
function getSelectedDate() {
    return {
        y: document.getElementById("yearSelect").value,
        m: document.getElementById("monthSelect").value,
        d: document.getElementById("daySelect").value
    };
}

function showFeedback(kind, message) {
    var box = document.getElementById("dateFeedback");
    box.className = kind;
    var icon = kind === "ok" ? "i-check" : "i-alert";
    box.innerHTML = message ? '<svg class="i"><use href="#' + icon + '"/></svg><span></span>' : "";
    if (message) { box.querySelector("span").innerText = message; }
}

// Called whenever a pulldown changes. Shows a friendly date; no blocking validation.
function updateDateFeedback() {
    var sel = getSelectedDate();
    var y = +sel.y, m = +sel.m - 1, d = +sel.d;
    var date = new Date(y, m, d);

    if (date.getMonth() === m && date.getDate() === d) {
        showFeedback("ok", date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
    } else {
        showFeedback("bad", MONTHS[m] + " " + d + " is not a calendar date, so no games will likely be found.");
    }
}

// ---------- Custom dropdown panels ----------
// The real <select> stays in the page and always holds the chosen value.
// This builds a nicer looking button + panel on top of it and keeps them in sync.
var openDropdown = null;

function closeDropdown() {
    if (!openDropdown) { return; }
    openDropdown.panel.hidden = true;
    openDropdown.button.setAttribute("aria-expanded", "false");
    openDropdown.wrap.classList.remove("open");
    openDropdown = null;
}

// columns = grid columns in the panel, cell = cell width (px), height = cell height (px)
function buildDropdown(id, columns, cell, height, showMonthNames) {
    var select = document.getElementById(id);
    var wrap = select.parentNode;
    var pick = wrap.parentNode;
    var row = pick.parentNode;

    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    var button = document.createElement("button");
    button.type = "button";
    button.className = "dd-btn";
    button.id = id + "Button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    wrap.appendChild(button);
    pick.querySelector("label").htmlFor = button.id;

    var panel = document.createElement("div");
    panel.className = "dd-panel";
    panel.setAttribute("role", "listbox");
    panel.hidden = true;
    panel.style.setProperty("--cols", columns);
    panel.style.setProperty("--cell", cell + "px");
    panel.style.setProperty("--h", height + "px");
    row.appendChild(panel);

    var cells = [];
    for (var i = 0; i < select.options.length; i++) {
        var optionCell = document.createElement("button");
        optionCell.type = "button";
        optionCell.className = "dd-opt";
        optionCell.setAttribute("role", "option");
        optionCell.innerText = select.options[i].text;
        if (showMonthNames) {
            var sub = document.createElement("span");
            sub.className = "sub";
            sub.innerText = MONTHS[i].substring(0, 3);
            optionCell.appendChild(sub);
        }
        optionCell.onclick = choose.bind(null, i);
        panel.appendChild(optionCell);
        cells.push(optionCell);
    }

    // Show the current <select> value on the button and highlight it in the panel
    function sync() {
        button.innerText = select.value;
        cells.forEach(function (item, index) {
            var isSelected = index === select.selectedIndex;
            item.classList.toggle("selected", isSelected);
            item.setAttribute("aria-selected", isSelected);
        });
    }

    function choose(index) {
        select.selectedIndex = index;
        sync();
        closeDropdown();
        button.focus();
        select.dispatchEvent(new Event("change"));
    }

    button.onclick = function () {
        var wasOpen = openDropdown && openDropdown.panel === panel;
        closeDropdown();
        if (wasOpen) { return; }

        panel.hidden = false;
        // line the panel up under its number, but keep it inside the row
        var left = Math.min(pick.offsetLeft, row.clientWidth - panel.offsetWidth);
        panel.style.left = Math.max(0, left) + "px";
        panel.style.top = (pick.offsetTop + pick.offsetHeight + 12) + "px";

        button.setAttribute("aria-expanded", "true");
        wrap.classList.add("open");
        openDropdown = { panel: panel, button: button, wrap: wrap };
        cells[select.selectedIndex].focus();
    };

    sync();
}

// ---------- Page setup ----------
window.onload = function () {
    // Year 2021-2025, Month 01-12, Day 01-31. Start on the example date: 05/19/2023
    fillSelect("yearSelect", 2021, 2025, 2023);
    fillSelect("monthSelect", 1, 12, 5);
    fillSelect("daySelect", 1, 31, 19);
    buildDropdown("yearSelect", 3, 84, 52, false);
    buildDropdown("monthSelect", 4, 64, 58, true);
    buildDropdown("daySelect", 7, 46, 42, false);
    updateDateFeedback();

    // click outside or press Escape to close an open panel
    document.addEventListener("click", function (event) {
        if (!event.target.closest(".dd-btn, .dd-panel")) { closeDropdown(); }
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && openDropdown) {
            var button = openDropdown.button;
            closeDropdown();
            button.focus();
        }
    });

    document.getElementById("yearSelect").onchange = updateDateFeedback;
    document.getElementById("monthSelect").onchange = updateDateFeedback;
    document.getElementById("daySelect").onchange = updateDateFeedback;

    document.getElementById("retrieveButton").onclick = retrieveSchedule;
    document.getElementById("nextGameButton").onclick = nextGame;
    document.getElementById("prevGameButton").onclick = previousGame;
    document.getElementById("nextHighlightButton").onclick = nextHighlight;
    document.getElementById("prevHighlightButton").onclick = previousHighlight;
    document.getElementById("playButton").onclick = playHighlight;
    updateButtons();
};

function setStatus(message) {
    document.getElementById("statusMessage").innerText = message;
}

// Disable prev/next buttons at the ends of each list
function updateButtons() {
    document.getElementById("prevGameButton").disabled = games.length === 0 || gameIndex === 0;
    document.getElementById("nextGameButton").disabled = games.length === 0 || gameIndex >= games.length - 1;
    document.getElementById("prevHighlightButton").disabled = highlightItems.length === 0 || highlightIndex === 0;
    document.getElementById("nextHighlightButton").disabled = highlightItems.length === 0 || highlightIndex >= highlightItems.length - 1;
    document.getElementById("playButton").disabled = highlightItems.length === 0;
}

// ---------- Stage 1: schedule for the selected date ----------
function retrieveSchedule() {
    closeDropdown();
    var sel = getSelectedDate();
    var dateText = sel.y + "-" + sel.m + "-" + sel.d;
    var url = SCHEDULE_URL.replace(/YYYY-MM-DD/g, dateText);

    setStatus("Retrieving games for " + dateText + "...");

    var request = new XMLHttpRequest();
    request.open("GET", url, true);

    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            if (request.status === 200) {
                scheduleObject = JSON.parse(request.responseText);

                if (scheduleObject.dates.length > 0 && scheduleObject.dates[0].games.length > 0) {
                    games = scheduleObject.dates[0].games;
                    gameIndex = 0;
                    setStatus("");
                    showGame();
                } else {
                    games = [];
                    clearGame();
                    setStatus("No games were found for " + dateText + ". Try another date.");
                }
            } else {
                setStatus("Could not retrieve MLB data (status " + request.status + ").");
            }
        }
    };

    request.send();
}

// ---------- Game display ----------
function clearGame() {
    document.getElementById("homeTeam").innerText = "";
    document.getElementById("awayTeam").innerText = "";
    document.getElementById("gameCount").innerText = "";
    highlightItems = [];
    highlightIndex = 0;
    showHighlight();
    updateButtons();
}

function showGame() {
    var game = games[gameIndex];
    var away = document.getElementById("awayTeam");
    var home = document.getElementById("homeTeam");
    away.innerText = game.teams.away.team.name;
    home.innerText = game.teams.home.team.name;
    document.getElementById("gameCount").innerText = "Game " + (gameIndex + 1) + " of " + games.length;

    // replay the slide-in so the change is visible
    [away, home].forEach(function (box) {
        box.classList.remove("swap");
        void box.offsetWidth;
        box.classList.add("swap");
    });

    updateButtons();
    retrieveHighlights(game.gamePk);
}

function nextGame() {
    if (games.length === 0) { return; }
    if (gameIndex < games.length - 1) {
        gameIndex++;
        showGame();
    }
}

function previousGame() {
    if (games.length === 0) { return; }
    if (gameIndex > 0) {
        gameIndex--;
        showGame();
    }
}

// ---------- Stage 2: highlights for the selected game ----------
function retrieveHighlights(gamePk) {
    var url = CONTENT_URL.replace("[gamePk]", gamePk);
    var requestedIndex = gameIndex;   // lets us ignore out-of-date replies

    highlightItems = [];
    highlightIndex = 0;
    document.getElementById("highlightName").innerText = "Loading highlights...";
    document.getElementById("highlightCount").innerText = "";
    document.getElementById("progress").innerHTML = "";
    updateButtons();

    var request = new XMLHttpRequest();
    request.open("GET", url, true);

    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            if (requestedIndex !== gameIndex) { return; }

            if (request.status === 200) {
                var gameObject = JSON.parse(request.responseText);

                if (gameObject.highlights &&
                    gameObject.highlights.highlights &&
                    gameObject.highlights.highlights.items) {
                    highlightItems = gameObject.highlights.highlights.items;
                }
            } else {
                setStatus("Could not retrieve highlights (status " + request.status + ").");
            }
            highlightIndex = 0;
            showHighlight();
        }
    };

    request.send();
}

// ---------- Highlight display ----------
function showHighlight() {
    var box = document.getElementById("highlightName");
    var count = document.getElementById("highlightCount");
    var bar = document.getElementById("progress");
    bar.innerHTML = "";

    if (highlightItems.length === 0) {
        box.innerText = "No highlights available";
        count.innerText = "";
    } else {
        box.innerText = highlightItems[highlightIndex].headline;
        count.innerText = "Highlight " + (highlightIndex + 1) + " of " + highlightItems.length;
        for (var i = 0; i < highlightItems.length; i++) {
            var seg = document.createElement("span");
            seg.className = i === highlightIndex ? "now" : (i < highlightIndex ? "seen" : "");
            bar.appendChild(seg);
        }
    }
    updateButtons();
}

function nextHighlight() {
    if (highlightIndex < highlightItems.length - 1) {
        highlightIndex++;
        showHighlight();
    }
}

function previousHighlight() {
    if (highlightIndex > 0) {
        highlightIndex--;
        showHighlight();
    }
}

// ---------- Play the MP4 in a new tab ----------
function playHighlight() {
    if (highlightItems.length === 0) {
        setStatus("There is no highlight to play for this game.");
        return;
    }

    var playbacks = highlightItems[highlightIndex].playbacks;

    if (playbacks && playbacks.length > 0) {
        var tab = window.open(playbacks[0].url, "_blank");
        if (tab) { tab.focus(); }
    } else {
        setStatus("This highlight has no video.");
    }
}
