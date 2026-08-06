const url = window.location.pathname.split("/");
const code = url[2];
const loadin_screen = document.getElementById("loading");
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
const pointbtn1 = document.getElementById("point1");
const pointbtn2 = document.getElementById("point2");
const returnbtn = document.getElementById("return");
const returnimg = document.getElementById("returnimg");

returnbtn.addEventListener("click", () => {
  returnimg.classList.remove("rotate");
  void returnimg.offsetWidth;
  returnimg.classList.add("rotate");
  server_return();
});

pointbtn1.addEventListener("click", () => {
  addpoint(0, 1);
});

pointbtn2.addEventListener("click", () => {
  addpoint(1, 0);
});

const pointsystem = ["0", "15", "30", "40", "ad"];

async function getdata() {
  loadin_screen.style.display = "flex";
  const response = await fetch("/api/getmatchdata", {
    headers: {
      "X-page-URL": window.location.pathname,
    },
  });
  const data = await response.json();

  loadin_screen.style.display = "none";
  if (data.status == "no user") {
    location.href = "/login";
    return;
  }
  if (data.status == "no match") {
    location.href = "/startseite";
    return;
  }

  matchsettings = data.match;
  if (matchsettings.status == "created") matchsettings.course = [];

  tabele.names[0].innerHTML = matchsettings.data.player1;
  tabele.names[1].innerHTML = matchsettings.data.player2;
  update_tabelle(false);
  if (matchsettings.status == "finished") {
    finish_match();
  }
}

getdata();

function addpoint(winner, loser) {
  const advantage = matchsettings.data.advantage == "true";
  const set = matchsettings.data.set;
  const max_sets = matchsettings.data.max_sets;
  const third_set = matchsettings.data.third_set;
  const winnergame = tabele.game[winner];
  const points = matchsettings.points;

  console.log(points.server);

  matchsettings.course.push({
    points: structuredClone(matchsettings.points),
    status: matchsettings.status,
  });

  winnergame.classList.remove("animate");

  void winnergame.offsetWidth;

  winnergame.classList.add("animate");

  if (matchsettings.status == "created") {
    matchsettings.status = "live";
  }

  if (points.championstiebrake) {
    points.tiebrake[winner] += 1;
    const total = points.tiebrake[0] + points.tiebrake[1];
    if (total % 2 !== 0) {
      points.server = points.server == "player1" ? "player2" : "player1";
    }
    if (
      (points.tiebrake[winner] >= 10 &&
        points.tiebrake[winner] - points.tiebrake[loser] >= 2) ||
      (points.tiebrake[winner] >= 7 &&
        points.tiebrake[winner] - points.tiebrake[loser] >= 2 &&
        third_set == 7)
    ) {
      finish_match();
    }
    update_tabelle(true);
    return;
  }
  if (
    (points.sets[points.sets.length - 1][0] == 6 &&
      points.sets[points.sets.length - 1][1] == 6) ||
    (points.sets[points.sets.length - 1][0] == 4 &&
      points.sets[points.sets.length - 1][1] == 4 &&
      set == 4)
  ) {
    points.tiebrake[winner] += 1;

    const total = points.tiebrake[0] + points.tiebrake[1];
    if (total % 2 !== 0) {
      points.server = points.server == "player1" ? "player2" : "player1";
    }
    if (
      points.tiebrake[winner] >= 7 &&
      points.tiebrake[winner] - points.tiebrake[loser] >= 2
    ) {
      points.sets[points.sets.length - 1][winner] += 1;
      finish_set();
      points.tiebrake = [0, 0];
      points.server = points.server == "player1" ? "player2" : "player1";
    }
    update_tabelle(true);
    return;
  }
  if (points.points[loser] == 4) {
    points.points[loser] = 3;
  } else {
    points.points[winner] += 1;
  }

  if (
    (points.points[winner] == 4 && (points.points[loser] <= 2 || !advantage)) ||
    points.points[winner] == 5
  ) {
    points.sets[points.sets.length - 1][winner] += 1;
    points.points = [0, 0];
    points.server = points.server == "player1" ? "player2" : "player1";
  }
  if (
    (points.sets[points.sets.length - 1][winner] == 6 &&
      points.sets[points.sets.length - 1][loser] <= 4) ||
    points.sets[points.sets.length - 1][winner] == 7 ||
    (set == 4 &&
      ((points.sets[points.sets.length - 1][winner] == 4 &&
        points.sets[points.sets.length - 1][loser] <= 2) ||
        points.sets[points.sets.length - 1][winner] == 5))
  ) {
    finish_set();
  }
  function finish_set() {
    points.set_win[winner] += 1;
    if (
      (points.set_win[winner] == 2 && max_sets == 3) ||
      (points.set_win[winner] == 3 && max_sets == 5)
    ) {
      finish_match();
    } else if (
      ["7", "10"].includes(third_set) &&
      ((points.set_win[0] == 1 && points.set_win[1] == 1 && max_sets == 3) ||
        (points.set_win[0] == 2 && points.set_win[1] == 2 && max_sets == 5))
    ) {
      points.championstiebrake = true;
    } else {
      points.sets.push([0, 0]);
    }
  }
  update_tabelle(true);
}

function update_tabelle(point) {
  const games = [
    pointsystem[matchsettings.points.points[0]],
    pointsystem[matchsettings.points.points[1]],
  ];
  if (
    (matchsettings.points.sets[matchsettings.points.sets.length - 1][0] == 6 &&
      matchsettings.points.sets[matchsettings.points.sets.length - 1][1] ==
        6) ||
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
  if (point) {
    update_server();
  }
  update_course();
}

function update_course() {
  const course_and_now = structuredClone(matchsettings.course);
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

function finish_match() {
  matchsettings.status = "finished";
  pointbtn1.style.visibility = "hidden";
  pointbtn2.style.visibility = "hidden";
  tabele.game[0].style.visibility = "hidden";
  tabele.game[1].style.visibility = "hidden";
}

async function update_server() {
  const response = await fetch("/api/updatematch", {
    method: "POST",
    headers: {
      "X-page-URL": window.location.pathname,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(matchsettings),
  });
}

async function server_return() {
  const response = await fetch("/api/match_return", {
    headers: {
      "X-page-URL": window.location.pathname,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (data.failed) return;

  matchsettings = data;
  if (
    matchsettings.status == "live" &&
    pointbtn1.style.visibility == "hidden"
  ) {
    pointbtn1.style.visibility = "visible";
    pointbtn2.style.visibility = "visible";
    tabele.game[0].style.visibility = "visible";
    tabele.game[1].style.visibility = "visible";
  }
  update_tabelle(false);
}
