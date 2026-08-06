function login() {
  const name = document.getElementById("name");
  const password = document.getElementById("password");
  const subtitle = document.getElementById("subtitle");
  const loadin_screen = document.getElementById("loading");

  loadin_screen.style.display = "flex";
  fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: name.value,
      password: password.value,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      const status = data.status;

      if (status == "ok") {
        location.href = "/startseite";
      } else if (status == "incorect password") {
        loadin_screen.style.display = "none";
        subtitle.innerHTML = "falsches password";
        subtitle.style.color = "red";
        password.value = "";
        setTimeout(() => {
          subtitle.innerHTML = "login";
          subtitle.style.color = "black";
        }, 1000);
      } else if (status == "not found") {
        loadin_screen.style.display = "none";
        subtitle.innerHTML = "user nicht gefunden";
        subtitle.style.color = "red";
        name.value = "";
        password.value = "";
        setTimeout(() => {
          subtitle.innerHTML = "login";
          subtitle.style.color = "black";
        }, 1000);
      }
    });
}
