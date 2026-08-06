function login() {
  const name = document.getElementById("name");
  const password = document.getElementById("password");
  const subtitle = document.getElementById("subtitle");

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
        subtitle.innerHTML = "falsches password";
        subtitle.style.color = "red";
        password.value = "";
        setTimeout(() => {
          subtitle.innerHTML = "login";
          subtitle.style.color = "black";
        }, 1000);
      } else if (status == "not found") {
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
