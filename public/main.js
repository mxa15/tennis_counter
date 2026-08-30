const params = new URLSearchParams(window.location.search);

const page = params.get("page");

const friendids = [];

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
    changesection(page);
  } else {
    history.pushState({}, "", "?page=startseite");
    changesection("startseite");
  }
  let tournaments = document.cookie
    .split("; ")
    .find((row) => row.startsWith("tournaments="))
    ?.split("=")[1];

  if (tournaments) {
    console.log("hallo");

    const datalist = document.getElementById("tournaments");
    tournaments = JSON.parse(decodeURIComponent(tournaments));
    tournaments.forEach((t) => {
      datalist.innerHTML += `<option value="${t}"></option>`;
    });
  }

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
  output.innerHTML += "<h3>anfragen</h3>";
  if (friendrequests.length > 0) {
    friendrequests.forEach((request) => {
      if (search) {
        if (request.username.toLowerCase().startsWith(search.toLowerCase())) {
          output.innerHTML += `
            <div class="friend"  id="${request.id}">
              <p>${escapeHTML(request.username)}</p>
              <button onclick="confirmFriend('${request.id}')"><img src="/public/accept-user.png" alt="add" /></button>
            </div>`;
        }
      } else {
        output.innerHTML += `
          <div class="friend"  id="${request.id}">
            <p>${escapeHTML(request.username)}</p>
            <button onclick="confirmFriend('${request.id}')" style="z-index: 50"><img src="/public/accept-user.png" alt="add" /></button>
          </div>`;
      }
    });
  }
  if (search) {
    output.innerHTML += "<h3>andere</h3>";
    const user_results = await getUsersByName(search);
    console.log(user_results);

    if (typeof user_results == "string") return console.log(user_results);

    user_results.forEach((result) => {
      if (!friendrequests.some((f) => f.username == result.username)) {
        output.innerHTML += `
        <div class="friend" id="${result.id}">
          <p>${escapeHTML(result.username)}</p>
          <button><img src="/public/add-user.png" alt="add" onclick="addfriend('${result.id}')"/></button>
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
    add_friendelement(friend.username, friend.id);
    friendids.push(friend.id);
  });
  addmatches(friendids, "livematches", "live");
  addmatches(friendids, "finishedmatches", "finished");
}

get_friends();

const open_sidebarbutton = document.getElementById("open_sidebar");
const close_sidebarbutton = document.getElementById("close_sidebar");
const sidebar = document.getElementById("sidebar");
const under_sidebar = document.getElementById("under_sidebar");
const loginbutton = document.getElementById("loginbutton");
const profilebutton = document.getElementById("profilebutton");
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
        loginbutton.style.display = "block";
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
    data.status == "no user" ||
    data.status == "no match" ||
    data.status == "invalid"
  )
    return "failed";

  return data.matches;
}

function addmatches(id, tableid, status) {
  const table = document.getElementById(tableid);
  getmatches(id, status).then((matches) => {
    if (matches === "failed") return;

    matches.forEach((match) => {
      const div = document.createElement("div");
      div.classList.add("matches");
      let servers = ["", ""];
      if (match.points.server == "player1") {
        servers[0] = "🟡";
      } else if (match.points.server == "player2") {
        servers[1] = "🟡";
      }
      const matchstatus = new Map([
        ["created", "Erstellt"],
        ["live", "Live"],
        ["finished", "Fertig"],
      ]);
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
      if (match.username === "du") {
        div.innerHTML = `
          <div class="matchinfo">${escapeHTML(matchstatus.get(match.status))} | ${getDate(match.created_at)} ${new Date(match.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} | ${match.username}</div>
          <div class="matchpoints" onclick="location.href = '/match/${match.code}'">
            <div>${servers[0]}</div>
            <div>${escapeHTML(match.data.player1)}</div>
            <div>${sets[0][0]}</div>
            <div>${sets[1][0]}</div>
            <div>${sets[2][0]}</div>
            <div>${sets[3][0]}</div>
            <div>${sets[4][0]}</div>
            <div>${games[0]}</div>

            <div>${servers[1]}</div>
            <div>${escapeHTML(match.data.player2)}</div>
            <div>${sets[0][1]}</div>
            <div>${sets[1][1]}</div>
            <div>${sets[2][1]}</div>
            <div>${sets[3][1]}</div>
            <div>${sets[4][1]}</div>
            <div>${games[1]}</div>
          </div>
        `;
      } else {
        div.innerHTML = `
          <div class="matchinfo">${escapeHTML(matchstatus.get(match.status))} | ${getDate(match.created_at)} ${new Date(match.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} | ${match.username}</div>
          <div class="matchpoints" onclick="location.href = '/view_match?code=${match.code}'">
            <div>${servers[0]}</div>
            <div>${escapeHTML(match.data.player1)}</div>
            <div>${sets[0][0]}</div>
            <div>${sets[1][0]}</div>
            <div>${sets[2][0]}</div>
            <div>${sets[3][0]}</div>
            <div>${sets[4][0]}</div>
            <div>${games[0]}</div>

            <div>${servers[1]}</div>
            <div>${escapeHTML(match.data.player2)}</div>
            <div>${sets[0][1]}</div>
            <div>${sets[1][1]}</div>
            <div>${sets[2][1]}</div>
            <div>${sets[3][1]}</div>
            <div>${sets[4][1]}</div>
            <div>${games[1]}</div>
          </div>
        `;
      }
      table.appendChild(div);
    });
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
  profilebutton.style.display = "block";

  profilename.textContent = user.username;
}

open_sidebarbutton.addEventListener("click", () => {
  opensidebar();
});

close_sidebarbutton.addEventListener("click", () => {
  closesidebar();
});

under_sidebar.addEventListener("click", () => {
  closesidebar();
});

function opensidebar() {
  sidebar.classList.add("open");
  under_sidebar.style.visibility = "visible";
  under_sidebar.classList.add("sidebar_open");
}

function closesidebar() {
  sidebar.classList.remove("open");
  under_sidebar.classList.remove("sidebar_open");
  setTimeout(() => {
    under_sidebar.style.visibility = "hidden";
  }, 300);
}

function changesection(id) {
  document.querySelectorAll("section").forEach((section) => {
    section.style.display = "none";
  });

  document.getElementById(id).style.display = "block";
  closesidebar();
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

  const data = {
    player1: p1,
    player2: p2,
    tournament: tournament,
    set: document.getElementById("set").value,
    max_sets: document.getElementById("max_sets").value,
    third_set: document.getElementById("3rd_set").value,
    advantage: document.getElementById("advantage").value,
    beginner: document.getElementById("beginner").value,
    position: {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
    },
  };

  const response = await fetch("/api/creatematch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const code = await response.json();

  if (code.status == "no user") {
    location.href = "/login";
    return;
  }

  location.href = "/match/" + code.code;
}

class SearchInput extends HTMLElement {
  connectedCallback() {
    const placeholder = this.getAttribute("placeholder");
    const inputID = this.getAttribute("inputID");

    this.innerHTML = `
      <div class="search_div">
        <img src="/public/search.png" alt="" class="search_img" />
        <input type="text" placeholder="${placeholder}" class="search" id="${inputID}" enterkeyhint="search"/>
      </div>
    `;
  }
}

customElements.define("search-input", SearchInput);

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

async function delete_friend(id) {
  if (!confirm("von freunde entfernen?")) {
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
  }, 1000);
}

function add_friendelement(name, userid) {
  const output = document.getElementById("friendoutput");
  output.innerHTML += `
        <div class="friend" id="${userid}">
          <p>${escapeHTML(name)}</p>
          <button onclick="delete_friend('${userid}')"><img src="/public/remove-user.png" alt="add"/></button>
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
  }
}

function addfavoritName() {
  console.log("hallo");

  const output = document.getElementById("favoritNameDiv");
  const name = document.getElementById("favoritNameInput").value;

  output.innerHTML += `
    <div class="favoritnames">
      <h3>${name}</h3>
      <button><img src="/public/close.png" alt="" /></button>
    </div>`;
}
