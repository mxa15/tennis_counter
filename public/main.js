const params = new URLSearchParams(window.location.search);

const page = params.get("page");

const friendids = [];

const matchstatus = new Map([
  ["created", "Erstellt"],
  ["live", "Live"],
  ["finished", "Fertig"],
]);

document.addEventListener("DOMContentLoaded", () => {
  if (
    [
      "startseite",
      "neue_partie",
      "freunde",
      "partien",
      "einstellungen",
      "profile",
    ].includes(page)
  ) {
    changesection(page, true);
  } else {
    history.pushState({}, "", "?page=startseite");
    changesection("startseite");
  }

  const datalist = document.getElementById("tournaments");

  const tournaments = localStorage.getItem("tournaments")
    ? JSON.parse(localStorage.getItem("tournaments"))
    : [];

  tournaments.forEach((tournament) => {
    datalist.innerHTML += `<option value="${escapeHTML(tournament)}"><option>`;
  });

  const newfriend_search = document.getElementById("newfriend_search");

  newfriend_search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      uptdate_newfrienddiv(newfriend_search.value);
      newfriend_search.blur();
      newfriend_search.value = "";
    }
  });
});

let friendrequests = [];

async function get_friendrequests() {
  const response = await fetch("/api/getfriendreq");
  const data = await response.json();

  if (data.status !== "ok") return console.log(data.status);

  friendrequests = data.requests;
}

async function set_newfrienddiv(search) {
  const output = document.getElementById("newfriend_searchoutput");
  output.innerHTML = "";
  if (search) {
    const user_results = await getUsersByName(search);
    console.log(user_results);

    if (typeof user_results == "string") return console.log(user_results);

    user_results.forEach((result) => {
      let img;
      let onclick;
      if (result.friendstatus == "friend") {
        img = "/public/images/remove-user.png";
        onclick = `delete_friend(${result.id}, 'von freunden entfernen?')`;
        console.log("1");
      } else if (result.friendstatus == "my request") {
        img = "/public/images/close.png";
        onclick = `delete_friend(${result.id}, 'anfrage abbrechen?')`;
        console.log("2");
      } else if (result.friendstatus == "his request") {
        img = "/public/images/accept-user.png";
        onclick = `confirmFriend(${result.id})`;
        console.log("3");
      } else {
        img = "/public/images/add-user.png";
        onclick = `addfriend(${result.id})`;
        console.log("4");
      }
      if (!friendrequests.some((f) => f.username == result.username)) {
        output.innerHTML += `
        <div class="friend" id="${result.id}">
          <p class="big-text">${escapeHTML(result.username)}</p>
          <button><img src="${img}" alt="add" onclick="${onclick}"/></button>
        </div>
        `;
      }
    });
  }
}

async function getUsersByName(name) {
  const response = await fetch("/api/getUsersByName/" + name);
  const data = await response.json();
  console.log(data);

  if (data.status !== "ok") return data.status;

  return data.users;
}

async function uptdate_newfrienddiv(search) {
  loading_newfrienddiv.style.display = "flex";
  await get_friendrequests();
  await set_newfrienddiv(search);
  loading_newfrienddiv.style.display = "none";
}

async function get_friends() {
  const response = await fetch("/api/getFriends/name");
  const data = await response.json();

  if (data.status !== "ok") return console.log(data.status);
  const output = document.getElementById("friendoutput");

  output.innerHTML = "";

  data.friends.forEach((friend) => {
    add_friendelement(
      friend.username,
      friend.id,
      "/public/images/remove-user.png",
      "von freunden entfernen?",
    );
    friendids.push(friend.id);
  });
  await get_friendrequests();
  if (friendrequests.length > 0) {
    output.innerHTML += "freundesanfragen";
    friendrequests.forEach((request) => {
      output.innerHTML += `
        <div class="friend"  id="${request.id}">
          <p class="big-text">${escapeHTML(request.username)}</p>
          <button onclick="confirmFriend('${request.id}')"><img src="/public/images/accept-user.png" alt="add" /></button>
        </div>`;
    });
  }
  const r2 = await fetch("/api/getMyFriendreq");
  const d2 = await r2.json();
  if (d2.req.length > 0) {
    output.innerHTML += "meine anfragen";
    d2.req.forEach((req) => {
      add_friendelement(
        req.username,
        req.id,
        "/public/images/close.png",
        "anfrage abbrechen?",
      );
    });
  }
  addmatches(friendids, "livematches", "live");
  addmatches(friendids, "finishedmatches", "finished");
}

get_friends();

const settings_img = document.getElementById("settings_img");
const profilename = document.getElementById("profilename");
const logoutbtn = document.getElementById("logout");
const deletebtn = document.getElementById("delete_user");
const loadin_screen = document.getElementById("loading");
const loading_newfrienddiv = document.getElementById("loading_newfrienddiv");

const pointsystem = ["0", "15", "30", "40", "ad"];

let user = null;

function check_user() {
  loadin_screen.style.display = "flex";
  fetch("/api/check_user")
    .then((response) => response.json())
    .then((data) => {
      if (data.failed) {
        settings_img.src = "/public/images/login.png";
        loadin_screen.style.display = "none";
        return;
      }
      login_user(data);
      loadin_screen.style.display = "none";
    });
}

check_user();

async function getmatches(ids, status) {
  const response = await fetch("/api/getmatches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_ids: ids,
      status: status,
    }),
  });
  const data = await response.json();

  if (
    data.status == "no accound" ||
    data.status == "no match" ||
    data.status == "invalid"
  )
    return "failed";

  return data.matches;
}

async function addmatches(id, tableid, status) {
  const table = document.getElementById(tableid);
  const matches = await getmatches(id, status);

  if (matches === "failed") {
    const info = document.createElement("p");
    info.classList.add("smal-text");
    info.innerText = "keine Matches gefunden";
    table.appendChild(info);
    return;
  }
  matches.forEach((match) => {
    const div = document.createElement("div");
    div.classList.add("matches");
    let servers = ["", ""];
    if (match.points.server == "player1") {
      servers[0] = "🟡";
    } else if (match.points.server == "player2") {
      servers[1] = "🟡";
    }
    let sets = [
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
    ];
    let i = 0;
    match.points.sets.forEach((set) => {
      sets[i] = set;
      i++;
    });
    let games = ["", ""];
    if (match.points.tiebrake[0] > 0 || match.points.tiebrake[1] > 0) {
      games[0] = match.points.tiebrake[0];
      games[1] = match.points.tiebrake[1];
    } else {
      games[0] = pointsystem[match.points.points[0]];
      games[1] = pointsystem[match.points.points[1]];
    }
    if (match.status == "finished" || match.status == "created") {
      games = ["", ""];
    }
    if (match.username === "du") {
      div.innerHTML = `
          <div class="smal-text">${escapeHTML(matchstatus.get(match.status))} | ${getDate(match.created_at)} ${new Date(match.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} | ${escapeHTML(match.username)}</div>
          <div class="matchpoints" onclick="location.href = '/match/${match.code}'">
            <div>${servers[0]}</div>
            <div>${escapeHTML(match.data.player1)}</div>
            <div>${escapeHTML(sets[0][0])}</div>
            <div>${escapeHTML(sets[1][0])}</div>
            <div>${escapeHTML(sets[2][0])}</div>
            <div>${escapeHTML(sets[3][0])}</div>
            <div>${escapeHTML(sets[4][0])}</div>
            <div>${escapeHTML(games[0])}</div>

            <div>${servers[1]}</div>
            <div>${escapeHTML(match.data.player2)}</div>
            <div>${escapeHTML(sets[0][1])}</div>
            <div>${escapeHTML(sets[1][1])}</div>
            <div>${escapeHTML(sets[2][1])}</div>
            <div>${escapeHTML(sets[3][1])}</div>
            <div>${escapeHTML(sets[4][1])}</div>
            <div>${escapeHTML(games[1])}</div>
          </div>
        `;
    } else {
      div.innerHTML = `
          <div class="smal-text">${escapeHTML(matchstatus.get(match.status))} | ${getDate(match.created_at)} ${new Date(match.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} | ${escapeHTML(match.username)}</div>
          <div class="matchpoints" onclick="location.href = '/view_match?code=${match.code}'">
            <div>${servers[0]}</div>
            <div>${escapeHTML(match.data.player1)}</div>
            <div>${escapeHTML(sets[0][0])}</div>
            <div>${escapeHTML(sets[1][0])}</div>
            <div>${escapeHTML(sets[2][0])}</div>
            <div>${escapeHTML(sets[3][0])}</div>
            <div>${escapeHTML(sets[4][0])}</div>
            <div>${escapeHTML(games[0])}</div>

            <div>${servers[1]}</div>
            <div>${escapeHTML(match.data.player2)}</div>
            <div>${escapeHTML(sets[0][1])}</div>
            <div>${escapeHTML(sets[1][1])}</div>
            <div>${escapeHTML(sets[2][1])}</div>
            <div>${escapeHTML(sets[3][1])}</div>
            <div>${escapeHTML(sets[4][1])}</div>
            <div>${escapeHTML(games[1])}</div>
          </div>
        `;
    }
    table.appendChild(div);
  });
}

addmatches(["my_id"], "mymatches", "all");

function getDate(dateString) {
  const timeZone = "Europe/Rome";

  const date = new Date(dateString);
  const today = new Date();

  const dateStr = date.toLocaleDateString("en-CA", { timeZone });
  const todayStr = today.toLocaleDateString("en-CA", { timeZone });

  const dateDay = new Date(dateStr);
  const todayDay = new Date(todayStr);

  const diff = Math.round((dateDay - todayDay) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "heute";
  if (diff === -1) return "gestern";
  if (diff === -2) return "vorgestern";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Rome",
  });
}

function login_user(userdata) {
  if (user) return;

  user = userdata;

  profilename.textContent = user.username;
}

function changesection(id, first) {
  if (id == "einstellungen" && !user && !first) {
    location.href = "/login";
  }
  history.pushState({}, "", "?page=" + id);
  const buttons = document.querySelectorAll("#nav button");
  buttons.forEach((btn) => {
    btn.classList.remove("selected");
  });
  const button = document.getElementById("change_" + id);
  button.classList.add("selected");

  document.querySelectorAll("section").forEach((section) => {
    section.style.display = "none";
  });

  document.getElementById(id).style.display = "block";
}

logoutbtn.addEventListener("click", () => {
  logout();
});

deletebtn.addEventListener("click", () => {
  delete_user();
});

function logout() {
  loadin_screen.style.display = "flex";
  fetch("/api/logout")
    .then((response) => response.json())
    .then((data) => {
      if (data.status == "ok") {
        location.href = "/startseite";
        return;
      }
      loadin_screen.style.display = "none";
    });
}

function delete_user() {
  const password = prompt("zum löschen passwort eingeben");

  if (!password) {
    return;
  }
  loadin_screen.style.display = "flex";
  fetch("/api/delete_user", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: password,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      const status = data.status;
      loadin_screen.style.display = "none";

      if (status == "ok") {
        location.href = "/startseite";
      }
    });
}

async function start_match() {
  loadin_screen.style.display = "flex";
  let p1 = document.getElementById("player1").value;
  let p2 = document.getElementById("player2").value;
  if (p1 == "" || p2 == "") {
    p1 = "player1";
    p2 = "player2";
  }

  let tournament = document.getElementById("tournament").value;

  if (tournament == "") {
    tournament = null;
  }

  let position;
  let posdata;

  if (document.getElementById("aloowposition").checked) {
    try {
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      posdata = {
        aloowed: true,
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };
    } catch (error) {
      console.log(error);
      posdata = {
        allowed: false,
        error: error.message,
      };
    }
  } else {
    posdata = {
      allowed: false,
      error: "user has not allowed",
    };
  }

  const data = {
    player1: p1,
    player2: p2,
    tournament: tournament,
    set: document.getElementById("set").value,
    max_sets: document.getElementById("max_sets").value,
    third_set: document.getElementById("3rd_set").value,
    advantage: document.getElementById("advantage").value,
    beginner: document.getElementById("beginner").value,
    position: posdata,
  };

  const response = await fetch("/api/creatematch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const code = await response.json();

  if (code.status == "no accound") {
    location.href = "/login";
    return;
  }

  let tournaments = localStorage.getItem("tournaments")
    ? JSON.parse(localStorage.getItem("tournaments"))
    : [];

  if (tournament && !tournaments.includes(tournament)) {
    tournaments.push(tournament);
    localStorage.setItem("tournaments", JSON.stringify(tournaments));
  }

  location.href = "/match/" + code.code;
}

function openPopUp(text, color = "gray", time = 1500) {
  const popup = document.createElement("div");
  popup.classList.add("pop-up");
  popup.innerHTML = text;
  popup.style.background = color;

  const container = document.body || document.documentElement;
  container.appendChild(popup);

  setTimeout(() => {
    popup.classList.add("open");
  }, 100);

  setTimeout(() => {
    popup.classList.remove("open");
    setTimeout(() => {
      popup.remove();
    }, 500);
  }, time + 100);
}

const newfriend_div = document.querySelector(".newfriend_div");

function open_newfrienddiv() {
  if (newfriend_div.classList.contains("newfriend_div_open")) return;
  uptdate_newfrienddiv();
  newfriend_div.classList.add("newfriend_div_open");
  document.getElementById("newfriend_open_div").style.display = "block";
}

function close_newfrienddiv() {
  event.stopPropagation();

  document.getElementById("newfriend_open_div").style.display = "none";

  newfriend_div.classList.remove("newfriend_div_open");
}

document.addEventListener(
  "pointerdown",
  function (event) {
    if (
      !newfriend_div.contains(event.target) &&
      newfriend_div.classList.contains("newfriend_div_open")
    ) {
      event.preventDefault();
    }
  },
  true,
);

document.addEventListener(
  "click",
  function (event) {
    if (
      !newfriend_div.contains(event.target) &&
      newfriend_div.classList.contains("newfriend_div_open")
    ) {
      close_newfrienddiv();

      event.stopPropagation();
      event.preventDefault();
    }
  },
  true,
);

async function delete_friend(id, messsage) {
  if (!confirm(messsage)) {
    return;
  }

  const response = await fetch("/api/deleteFriend/" + id, { method: "DELETE" });
  const data = await response.json();

  console.log(data.status);

  if (data.status !== "ok") return;

  const friend = document.getElementById(id);

  friend.classList.add("delete_friend");
  setTimeout(() => {
    friend.remove();
    get_friends();
  }, 1000);
}

function add_friendelement(name, userid, img, message, onclick) {
  const output = document.getElementById("friendoutput");
  output.innerHTML += `
        <div class="friend" id="${userid}">
          <p class="big-text">${escapeHTML(name)}</p>
          <button onclick="delete_friend('${userid}', '${message}')"><img src="${img}" alt="add"/></button>
        </div>
  `;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

async function server_addfriend(id) {
  const response = await fetch("/api/addfriend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friendID: id,
    }),
  });
  const data = await response.json();

  return data.status;
}

async function addfriend(id) {
  const friendelement = document.getElementById(id);
  setTimeout(() => {
    friendelement.remove();
  }, 1000);
  friendelement.classList.add("delete_friend");
  const status = await server_addfriend(id);
  console.log(status);
  get_friends();
}

async function confirmFriend(id) {
  const friendelement = document.getElementById(id);
  setTimeout(() => {
    friendelement.remove();
  }, 1000);
  friendelement.classList.add("delete_friend");
  const response = await fetch("/api/confirmFriend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      friend_id: id,
    }),
  });
  const data = await response.json();
  console.log(data.status);

  if (data.status == "ok") {
    get_friends();
    friendrequests = [];
  }
}

async function addfavoritName() {
  const input = document.getElementById("favoritNameInput");
  const name = String(input.value || "").trim();

  if (!name) {
    openPopUp("name darf nicht leer sein", "red");
    return;
  }

  const response = await fetch("/api/favoritNames", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name,
    }),
  });
  const result = await response.json();

  if (result.status !== "ok") {
    openPopUp("name existiert schon", "red");
    return;
  }

  writefavoritNames();
  input.value = "";
}

async function getfavoritNames() {
  const response = await fetch("/api/favoritNames");
  const data = await response.json();

  if (data.status !== "ok") {
    return [];
  }

  if (!Array.isArray(data.names)) {
    return [];
  }

  return data.names;
}

async function deletefavoritName(name) {
  const object = document.getElementById("name-" + name);

  if (object) {
    object.classList.add("delete_friend");

    setTimeout(() => {
      object.remove();
    }, 1000);
  }

  const response = await fetch("/api/favoritNames", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name,
    }),
  });
  const data = await response.json();

  if (data.status !== "ok") {
    openPopUp("name konnte nicht gelöscht werden", "red");
    return;
  }

  writefavoritNames();
}

async function writefavoritNames() {
  const names = await getfavoritNames();
  const output = document.getElementById("favoritNameDiv");
  const list = document.getElementById("favoritNames");

  if (!output || !list) return;

  output.innerHTML = "";
  list.innerHTML = "";

  names.forEach((name) => {
    const safeName = String(name || "").replace(/['"`]/g, "");

    output.innerHTML += `
    <div class="friend" id="name-${escapeHTML(safeName)}">
      <p class="big-text">${escapeHTML(safeName)}</p>
      <button onclick="deletefavoritName('${escapeHTML(safeName)}')"><img src="/public/images/close.png" alt="" /></button>
    </div>`;

    list.innerHTML += "<option value='" + escapeHTML(safeName) + "'>";
  });
}

writefavoritNames();

const darkmode = document.getElementById("darkmode");

darkmode.addEventListener("change", () => {
  setTheme(darkmode.value);
});

function setTheme(theme) {
  if (theme !== "device") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }
  localStorage.setItem("theme", theme);
}

function loadTheme() {
  let theme = localStorage.getItem("theme");

  if (theme) {
    darkmode.value = theme;
    if (theme == "device") {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        theme = "dark";
      } else {
        theme = "light";
      }
    }
    document.documentElement.setAttribute("data-theme", theme);
  }
}

loadTheme();

async function search_match(search) {
  const output = document.getElementById("matchSearchResults");
  output.innerHTML = `
    <div
      class="loader"
      style="background: transparent"
    >
      <div class="loadingcircle">
        <div id="c1" class="c"></div>
        <div id="c2" class="c"></div>
        <div id="c3" class="c"></div>
        <div id="c4" class="c"></div>
        <div id="c5" class="c"></div>
        <div id="c6" class="c"></div>
        <div id="c7" class="c"></div>
        <div id="c8" class="c"></div>
        <div id="c9" class="c"></div>
        <div id="c10" class="c"></div>
        <div id="c11" class="c"></div>
        <div id="c12" class="c"></div>
        <div id="c13" class="c"></div>
        <div id="c14" class="c"></div>
      </div>
    </div>
  `;
  if (search == "/mymatches") {
    writeMyMatches();
    return;
  }
  const response = await fetch("/api/searchMatch", {
    method: "POST",
    body: search,
  });
  const data = await response.json();
  if (data.status == "ok") {
    output.innerHTML = `<p class="smal-text">suchergebnisse für "${escapeHTML(search)}"`;
    data.matches.forEach((match) => {
      let url = match.my
        ? "/match/" + match.code
        : "/view_match?code=" + match.code;
      let game = [0, 0];
      if (match.points.tiebrake[0] > 0 || match.points.tiebrake[1] > 0) {
        game = [match.points.tiebrake[0], match.points.tiebrake[1]];
      } else {
        game = [match.points.points[0], match.points.points[1]];
      }
      if (match.status == "finished" || match.status == "created") {
        game = ["", ""];
      } else {
        game = [pointsystem[game[0]], pointsystem[game[1]]];
      }
      const server = ["", ""];
      if (match.points.server == "player1") {
        server[0] = "🟡";
      } else if (match.points.server == "player2") {
        server[1] = "🟡";
      }
      let sets = [
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
      ];
      let i = 0;
      match.points.sets.forEach((set) => {
        sets[i] = set;
        i++;
      });
      const tournament = match.data.tournament ? match.data.tournament : "";
      output.innerHTML += `
        <div class="big-matches" onclick="location.href = '${url}'">
          <p class="smal-text">${escapeHTML(matchstatus.get(match.status))} | ${getDate(match.created_at)} ${new Date(match.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} ${escapeHTML(tournament)} | ${escapeHTML(match.username)}</p>
          <div class="big-matches-points">
            <span>${server[0]}</span><span>${server[1]}</span> 
            <span>${escapeHTML(match.data.player1)}</span><span>${escapeHTML(match.data.player2)}</span>
            <span>${escapeHTML(sets[0][0])}</span><span>${escapeHTML(sets[0][1])}</span> 
            <span>${escapeHTML(sets[1][0])}</span><span>${escapeHTML(sets[1][1])}</span>
            <span>${escapeHTML(sets[2][0])}</span><span>${escapeHTML(sets[2][1])}</span> 
            <span>${escapeHTML(sets[3][0])}</span><span>${escapeHTML(sets[3][1])}</span>
            <span>${escapeHTML(sets[4][0])}</span><span>${escapeHTML(sets[4][1])}</span> 
            <span>${escapeHTML(game[0])}</span> <span>${escapeHTML(game[1])}</span>
          </div>
        </div>`;
    });
  } else {
    output.innerHTML = `<p class="smal-text">keine übereinstimung mit "${escapeHTML(search)}"`;
  }
}

async function writeMyMatches() {
  const response = await fetch("/api/getmatches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_ids: ["my_id"],
      status: "all",
    }),
  });
  const data = await response.json();
  const output = document.getElementById("matchSearchResults");
  if (data.status == "ok") {
    output.innerHTML = "meine partien";
    data.matches.forEach((match) => {
      let url = match.my
        ? "/match/" + match.code
        : "/view_match?code=" + match.code;
      let game = [0, 0];
      if (match.points.tiebrake[0] > 0 || match.points.tiebrake[1] > 0) {
        game = [match.points.tiebrake[0], match.points.tiebrake[1]];
      } else {
        game = [match.points.points[0], match.points.points[1]];
      }
      if (match.status == "finished" || match.status == "created") {
        game = ["", ""];
      } else {
        game = [pointsystem[game[0]], pointsystem[game[1]]];
      }
      const server = ["", ""];
      if (match.points.server == "player1") {
        server[0] = "🟡";
      } else if (match.points.server == "player2") {
        server[1] = "🟡";
      }
      let sets = [
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
        ["", ""],
      ];
      let i = 0;
      match.points.sets.forEach((set) => {
        sets[i] = set;
        i++;
      });
      const tournament = match.data.tournament ? match.data.tournament : "";
      output.innerHTML += `
        <div class="big-matches" onclick="location.href = '${url}'">
          <p class="smal-text">${escapeHTML(matchstatus.get(match.status))} | ${getDate(match.created_at)} ${new Date(match.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} ${escapeHTML(tournament)} | ${escapeHTML(match.username)}</p>
          <div class="big-matches-points">
            <span>${server[0]}</span><span>${server[1]}</span> 
            <span>${escapeHTML(match.data.player1)}</span><span>${escapeHTML(match.data.player2)}</span>
            <span>${escapeHTML(sets[0][0])}</span><span>${escapeHTML(sets[0][1])}</span> 
            <span>${escapeHTML(sets[1][0])}</span><span>${escapeHTML(sets[1][1])}</span>
            <span>${escapeHTML(sets[2][0])}</span><span>${escapeHTML(sets[2][1])}</span> 
            <span>${escapeHTML(sets[3][0])}</span><span>${escapeHTML(sets[3][1])}</span>
            <span>${escapeHTML(sets[4][0])}</span><span>${escapeHTML(sets[4][1])}</span> 
            <span>${escapeHTML(game[0])}</span> <span>${escapeHTML(game[1])}</span>
          </div>
        </div>`;
    });
  } else {
    output.innerHTML = "du hast keine partien";
  }
}

writeMyMatches();
