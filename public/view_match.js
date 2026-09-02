const params = new URLSearchParams(window.location.search);

const matchcode = params.get("code");
const loadin_screen = document.getElementById("loading");
loadin_screen.style.display = "flex";
let matchsettings = null;
const tabele = {
  servers: [
    document.getElementById("server1"),
    document.getElementById("server2"),
  ],
  names: [document.getElementById("name1"), document.getElementById("name2")],
  set1: [document.getElementById("_1set1"), document.getElementById("_1set2")],
  set2: [document.getElementById("_2set1"), document.getElementById("_2set2")],
  set3: [document.getElementById("_3set1"), document.getElementById("_3set2")],
  pastset: [
    document.getElementById("_4set1"),
    document.getElementById("_4set2"),
  ],
  thisset: [
    document.getElementById("_5set1"),
    document.getElementById("_5set2"),
  ],
  game: [document.getElementById("game1"), document.getElementById("game2")],
};

const header = document.querySelector("header");
const info = document.getElementById("info");

const observer = new ResizeObserver(() => {
  info.style.marginTop = header.offsetHeight + 30 + "px";
  console.log(header.offsetHeight);
});

observer.observe(header);

const protocol = location.protocol === "https:" ? "wss:" : "ws:";

const socket = new WebSocket(`${protocol}//${location.host}`);

socket.onopen = () => {
  console.log("WebSocket verbunden");
  socket.send(
    JSON.stringify({
      type: "loginViewer",
      data: {
        matchcode: matchcode,
      },
    }),
  );
};

socket.onmessage = async (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === "getmatchData" || type === "updateMatch") {
    matchsettings = data.matchsettings;
    console.log(matchsettings);
    update_tabelle();
    tabele.names[0].textContent = matchsettings.data.player1;
    tabele.names[1].textContent = matchsettings.data.player2;
    loadin_screen.style.display = "none";

    const response = await fetch("/api/SQL", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: "SELECT username FROM users WHERE id = $1",
        params: [matchsettings.owner_id],
      }),
    });
    const dataoutput = await response.json();

    let owner_name;

    if (dataoutput.status == "ok") {
      owner_name = dataoutput.rows[0].username;
    } else {
      console.log(dataoutput.status);
      owner_name = "fehler";
    }

    const setToWin = matchsettings.data.max_sets == 3 ? 2 : 3;
    const withAdvantage = matchsettings.data.advantage ? "ja" : "nein";
    const lastSet =
      matchsettings.data.third_set == "set"
        ? "normaler Satz"
        : "Tiebreak bis " + matchsettings.data.third_set;
    info.innerHTML = `
<span>Matchcode:</span> <span>${matchsettings.code}</span>
<span>Zähler:</span> <span>${owner_name}</span>
<span>Satz:</span> <span>bis ${matchsettings.data.set}</span>
<span>Gewinnsätze:</span> <span>${setToWin}</span>
<span>Mit Vorteil:</span> <span>${withAdvantage}</span>
<span>Letzter Satz:</span> <span>${lastSet}</span>`;

    if (matchsettings.data.position.aloowed) {
      const lat = Number(matchsettings.data.position.lat);
      const lon = Number(matchsettings.data.position.lon);

      document.getElementById("posbtn").addEventListener("click", () => {
        window.open(`https://www.google.com/maps?q=${lat},${lon}`, "_blank");
      });
    }
  }
};

const pointsystem = ["0", "15", "30", "40", "ad"];

function update_tabelle() {
  const games = [
    pointsystem[matchsettings.points.points[0]],
    pointsystem[matchsettings.points.points[1]],
  ];
  if (
    (matchsettings.points.sets[matchsettings.points.sets.length - 1][0] == 6 &&
      matchsettings.points.sets[matchsettings.points.sets.length - 1][1] ==
        6) ||
    (matchsettings.points.sets[matchsettings.points.sets.length - 1][0] == 4 &&
      matchsettings.points.sets[matchsettings.points.sets.length - 1][1] == 4 &&
      matchsettings.data.set == 4) ||
    matchsettings.points.championstiebrake == true
  ) {
    tabele.game[0].innerHTML = matchsettings.points.tiebrake[0];
    tabele.game[1].innerHTML = matchsettings.points.tiebrake[1];
  } else {
    tabele.game[0].innerHTML = games[0];
    tabele.game[1].innerHTML = games[1];
  }

  if (matchsettings.points.server == "player1") {
    tabele.servers[0].innerHTML = "🟡";
    tabele.servers[1].innerHTML = "";
  } else {
    tabele.servers[0].innerHTML = "";
    tabele.servers[1].innerHTML = "🟡";
  }

  if (matchsettings.points.sets.length == 1) {
    u_sets(
      ["", ""],
      ["", ""],
      ["", ""],
      ["", ""],
      [matchsettings.points.sets[0][0], matchsettings.points.sets[0][1]],
    );
  } else if (matchsettings.points.sets.length == 2) {
    u_sets(
      ["", ""],
      ["", ""],
      ["", ""],
      [matchsettings.points.sets[0][0], matchsettings.points.sets[0][1]],
      [matchsettings.points.sets[1][0], matchsettings.points.sets[1][1]],
    );
  } else if (matchsettings.points.sets.length == 3) {
    u_sets(
      ["", ""],
      ["", ""],
      [matchsettings.points.sets[0][0], matchsettings.points.sets[0][1]],
      [matchsettings.points.sets[1][0], matchsettings.points.sets[1][1]],
      [matchsettings.points.sets[2][0], matchsettings.points.sets[2][1]],
    );
  } else if (matchsettings.points.sets.length == 4) {
    u_sets(
      ["", ""],
      [matchsettings.points.sets[0][0], matchsettings.points.sets[0][1]],
      [matchsettings.points.sets[1][0], matchsettings.points.sets[1][1]],
      [matchsettings.points.sets[2][0], matchsettings.points.sets[2][1]],
      [matchsettings.points.sets[3][0], matchsettings.points.sets[3][1]],
    );
  } else if (matchsettings.points.sets.length == 5) {
    u_sets(
      [matchsettings.points.sets[0][0], matchsettings.points.sets[0][1]],
      [matchsettings.points.sets[1][0], matchsettings.points.sets[1][1]],
      [matchsettings.points.sets[2][0], matchsettings.points.sets[2][1]],
      [matchsettings.points.sets[3][0], matchsettings.points.sets[3][1]],
      [matchsettings.points.sets[4][0], matchsettings.points.sets[4][1]],
    );
  }

  function u_sets(s1, s2, s3, s4, s5) {
    tabele.thisset[0].innerHTML = s5[0];
    tabele.thisset[1].innerHTML = s5[1];
    tabele.pastset[0].innerHTML = s4[0];
    tabele.pastset[1].innerHTML = s4[1];
    tabele.set3[0].innerHTML = s3[0];
    tabele.set3[1].innerHTML = s3[1];
    tabele.set2[0].innerHTML = s2[0];
    tabele.set2[1].innerHTML = s2[1];
    tabele.set1[0].innerHTML = s1[0];
    tabele.set1[1].innerHTML = s1[1];
  }
  update_course();
}

function update_course() {
  const course = Array.isArray(matchsettings.course)
    ? matchsettings.course
    : [];

  const course_and_now = structuredClone(course);

  course_and_now.push({
    points: matchsettings.points,
    status: matchsettings.status,
  });

  const course_games_set = [];

  let game_now = [];
  let thie = false;

  course_and_now.forEach((ausgabe) => {
    if (ausgabe.points.tiebrake[0] > 0 || ausgabe.points.tiebrake[1] > 0) {
      thie = true;
      game_now.push(ausgabe.points);
      return;
    }
    if (thie) {
      course_games_set.push(game_now);
      game_now = [];
      thie = false;
    }

    if (ausgabe.points.points[0] == 0 && ausgabe.points.points[1] == 0) {
      course_games_set.push(game_now);
      game_now = [];
    } else {
      game_now.push(ausgabe.points);
    }
  });
  course_games_set.push(game_now);

  const course_games = course_games_set.filter((part) => part.length > 0);

  let output = ``;

  let index = 0;

  course_games.forEach((cg) => {
    index += 1;
    let c1 = "";
    let c2 = "";
    if (cg[0].server == "player1") {
      c1 += "||";
      c2 += "&nbsp;|";
    } else {
      c2 += "||";
      c1 += "&nbsp;|";
    }
    let games =
      "&nbsp;&nbsp;&nbsp;" +
      cg[0].sets[cg[0].sets.length - 1][0] +
      " : " +
      cg[0].sets[cg[0].sets.length - 1][1];
    if (games == "0 : 0" && cg[0].sets.length > 1) {
      games =
        cg[0].sets[cg[0].sets.length - 2][0] +
        " : " +
        cg[0].sets[cg[0].sets.length - 2][1];
    }
    cg.forEach((c) => {
      if (c.tiebrake[0] > 0 || c.tiebrake[1] > 0) {
        if (String(c.tiebrake[0]).length <= 1) {
          c1 += c.tiebrake[0] + "&nbsp;&nbsp;|&nbsp;";
        } else {
          c1 += c.tiebrake[0] + "&nbsp;|&nbsp;";
        }
        if (String(c.tiebrake[1]).length <= 1) {
          c2 += c.tiebrake[1] + "&nbsp;&nbsp;|&nbsp;";
        } else {
          c2 += c.tiebrake[1] + "&nbsp;|&nbsp;";
        }
        return;
      }
      if (c.points[0] == 0) {
        c1 += pointsystem[c.points[0]] + "&nbsp;|";
      } else {
        c1 += pointsystem[c.points[0]] + "|";
      }
      if (c.points[1] == 0) {
        c2 += pointsystem[c.points[1]] + "&nbsp;|";
      } else {
        c2 += pointsystem[c.points[1]] + "|";
      }
    });
    output += `<br>
${games}<br><br>
${c1}<br>
${c2}<br>`;
  });

  const p = document.querySelector("p");
  p.style.lineHeight = "1";
  p.innerHTML = output;
  window.scrollTo(0, document.body.scrollHeight);
}

async function shareMatch() {
  const url = new URL(window.location.href);
  const viewURL = url.origin + "/view_match?code=" + matchsettings.code;
  try {
    await navigator.share({
      title: "Live Tennis Spiel",
      text: `schau dir das Tennis Spiel zwischen ${matchsettings.data.player1} und ${matchsettings.data.player2} live an.`,
      url: viewURL,
    });
  } catch (err) {
    console.log("Teilen abgebrochen");
  }
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
