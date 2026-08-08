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

async function getmatches(id) {
  const response = await fetch(`/api/getmatches/${id}`);
  const data = await response.json();

  if (data.status == "no user") return "no user";

  return data.matches;
}

function addmatches(id, tableid) {
  const table = document.getElementById(tableid);
  getmatches(id).then((matches) => {
    console.log(matches);

    matches.forEach((match) => {
      const div = document.createElement("div");
      div.classList.add("matches");
      let r1 = "";
      let r2 = "————————————————————";
      let r3 = "";
      let r4 = "";
      r1 += `${match.status}|`;
      console.log(r1);

      const day = getDayStatus(match.created_at);
      if (day == "anderer Tag")
        day = new Date(match.created_at).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "Europe/Rome",
        });
      r1 += day + "&nbsp;";
      r1 += new Date(match.created_at).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      r3 += match.data.player1;
      r4 += match.data.player2;
      if (r3.length < r4.length) {
        r3 += "&nbsp;".repeat(r4.length - r3.length);
      } else if (r4.length < r3.length) {
        r4 += "&nbsp;".repeat(r3.length - r4.length);
      }
      r3 += "&nbsp;|";
      r4 += "&nbsp;|";
      match.points.sets.forEach((set) => {
        if (String(set[0]).length == 2) {
          r3 += set[0] + "|";
          if (String(set[1]).length == 2) {
            r4 += set[1] + "|";
          } else {
            r4 += set[1] + "&nbsp;|";
          }
          return;
        }
        if (String(set[1]).length == 2) {
          r4 += set[0] + "|";
          if (String(set[0]).length == 2) {
            r3 += set[1] + "|";
          } else {
            r3 += set[1] + "&nbsp;|";
          }
          return;
        }
        r3 += set[0] + "|";
        r4 += set[1] + "|";
      });
      if (match.points.points[0] > 0 || match.points.points[1] > 0) {
        r3 += pointsystem[match.points.points[0]];
        r4 += pointsystem[match.points.points[1]];
      }
      div.innerHTML = `${r1}<br>${r2}<br>${r3}<br>${r4}`;
      table.appendChild(div);
    });
  });
}

function getDayStatus(dateString) {
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

  return "anderer Tag";
}

addmatches("my_id", "mymatches");

function login_user(userdata) {
  if (user) return;

  user = userdata;
  profilebutton.style.display = "block";

  profilename.innerHTML = user.username;
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
    return console.log("abbruch");
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
  let p1 = document.getElementById("player1").value;
  let p2 = document.getElementById("player2").value;
  if (p1 == "" || p2 == "") {
    p1 = "player1";
    p2 = "player2";
  }
  const data = {
    player1: p1,
    player2: p2,
    set: document.getElementById("set").value,
    max_sets: document.getElementById("max_sets").value,
    third_set: document.getElementById("3rd_set").value,
    advantage: document.getElementById("advantage").value,
    beginner: document.getElementById("beginner").value,
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
